import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { TwitterService } from '../twitter/twitter.service';
import { FacebookService } from '../facebook/facebook.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly twitterService: TwitterService,
    private readonly facebookService: FacebookService,
  ) { }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    console.log('Running a task every minute');

    // 1. Fetch data from Firebase
    const firestore = this.firebaseService.getFirestore();

    try {
      // Pull top candidates by priority; filter for isPosted missing or false
      const postsSnapshot = await firestore.collection('posts').limit(50).get();

      if (postsSnapshot.empty) {
        console.log('No posts found in Firebase collection');
        return;
      }

      // Build candidate list of unposted items and pick one at random
      const candidates = postsSnapshot.docs.filter((doc) => {
        const data: any = doc.data();
        return data?.isPosted === undefined || data?.isPosted !== true;
      });

      if (!candidates.length) {
        console.log(
          'All candidate posts already marked as posted; nothing to post',
        );
        return;
      }

      const selectedDoc =
        candidates[Math.floor(Math.random() * candidates.length)];
      const postData: any = selectedDoc.data();
      console.log('Selected Firebase Document ID:', selectedDoc.id);
      console.log(
        'Selected Firebase Document Data:',
        JSON.stringify(postData, null, 2),
      );

      // If URL exists, fetch metadata and update the document (only if fields missing)
      if (postData.url) {
        try {
          const { data: html } = await axios.get(postData.url, {
            timeout: 8000,
          });
          const dom = new JSDOM(html, { url: postData.url });
          const reader = new Readability(dom.window.document);
          const article = reader.parse();
          const updatedFields: any = {};
          if (article?.title && !postData.title)
            updatedFields.title = article.title;
          if (article?.excerpt && !postData.content)
            updatedFields.content = article.excerpt;
          if (Object.keys(updatedFields).length) {
            await selectedDoc.ref.update(updatedFields);
            postData.title = updatedFields.title ?? postData.title;
            postData.content = updatedFields.content ?? postData.content;
            console.log('Updated document with URL metadata:', updatedFields);
          }
        } catch (e) {
          console.error(
            'Failed to fetch URL metadata',
            (e && (e.response?.status || e.message)) || e,
          );
        }
      }

      // Build content and images
      const messageContent =
        `${postData.title || ''}\n\n${postData.content || ''}`.trim();
      const imagesArray: string[] = Array.isArray(postData.images)
        ? postData.images.filter(Boolean)
        : [];
      const imageCsv = imagesArray.join(',');
      // Post to Twitter (supports images)
      try {
        await this.twitterService.postToTwitter({
          content: messageContent,
          image: imageCsv,
        });
        console.log('Successfully posted to Twitter');
      } catch (e) {
        console.error('Failed to post on Twitter', e);
      }
      // Post to Facebook (supports images)
      try {
        if (imagesArray.length) {
          await this.facebookService.postToFacebookWithImage({
            image: imageCsv,
            content: messageContent,
          });
        } else {
          await this.facebookService.post(messageContent);
        }
        console.log('Successfully posted to Facebook');
      } catch (e) {
        console.error('Failed to post on Facebook', e);
      }

      // Update post document to mark as posted
      try {
        await selectedDoc.ref.update({ isPosted: true, postedAt: new Date() });
        console.log(`Marked document ${selectedDoc.id} as posted`);
      } catch (e) {
        console.error('Failed to update post document as posted', e);
      }
    } catch (error) {
      console.error('Error fetching data from Firebase:', error);

      // Fallback to placeholder data if Firebase fails
      const postData = {
        title: 'Hello World!',
        content:
          'This is a test post from my new NestJS social poster service.',
      };
      console.log('Using fallback data:', postData);
      // this.postToSocialMedia(postData);
    }
  }

  @Cron('0 0 * * *')
  async resetIsPostedAtMidnight() {
    console.log('Resetting isPosted to false for all posts at midnight');
    const firestore = this.firebaseService.getFirestore();
    const batch = firestore.batch();
    try {
      const snapshot = await firestore
        .collection('posts')
        .where('isPosted', '==', true)
        .get();

      if (snapshot.empty) {
        console.log('No posts to reset');
        return;
      }

      snapshot.forEach((doc) => {
        batch.update(doc.ref, { isPosted: false });
      });

      await batch.commit();
      console.log(`Reset ${snapshot.size} posts to isPosted=false`);
    } catch (e) {
      console.error('Failed to reset isPosted flags', e);
    }
  }

  private async postToSocialMedia(postData: any) {
    // Deprecated: kept for backward compatibility; new flow posts inline with images support
    const message =
      `${postData?.title || ''}\n\n${postData?.content || ''}`.trim();
    await this.twitterService.post(message);
    await this.facebookService.post(message);
  }

  // Manual HTML parsing helpers removed in favor of Readability
}
