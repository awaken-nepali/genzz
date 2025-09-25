import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { TwitterService } from '../twitter/twitter.service';
import { FacebookService } from '../facebook/facebook.service';
import { TimeCounterService } from '../utils/time-counter.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly twitterService: TwitterService,
    private readonly facebookService: FacebookService,
    private readonly timeCounterService: TimeCounterService,
    private readonly configService: ConfigService,
  ) { }

  @Cron(CronExpression.EVERY_MINUTE)
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
          'All candidate posts already marked as posted; resetting isPosted to restart cycle',
        );
        try {
          await this.resetIsPostedAtMidnight();
        } catch (e) {
          console.error('Failed to reset isPosted when pool exhausted', e);
        }
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

          // Try to extract a lead image: prefer Open Graph/Twitter meta; fallback to first <img> in article content
          const doc = dom.window.document as Document;
          const ogImage =
            doc
              .querySelector('meta[property="og:image"]')
              ?.getAttribute('content') ||
            doc
              .querySelector('meta[name="twitter:image"]')
              ?.getAttribute('content') ||
            doc.querySelector('link[rel="image_src"]')?.getAttribute('href') ||
            undefined;

          let leadImage: string | undefined = ogImage || undefined;
          if (!leadImage && article?.content) {
            try {
              const contentDoc = new JSDOM(article.content).window.document;
              leadImage =
                contentDoc.querySelector('img')?.getAttribute('src') ||
                undefined;
            } catch {
              // ignore content parsing errors
            }
          }

          if (leadImage) {
            const currentImages: string[] = Array.isArray(postData.images)
              ? postData.images.filter(Boolean)
              : [];
            if (!currentImages.includes(leadImage)) {
              updatedFields.images = [...currentImages, leadImage];
            }
          }
          if (Object.keys(updatedFields).length) {
            await selectedDoc.ref.update(updatedFields);
            postData.title = updatedFields.title ?? postData.title;
            postData.content = updatedFields.content ?? postData.content;
            if (updatedFields.images) postData.images = updatedFields.images;
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
      const imagesArray: string[] = Array.isArray(postData.images)
        ? postData.images.filter(Boolean)
        : [];

      // Get time counter message
      const timeMessage = this.timeCounterService.getDramaticJusticeMessage();

      let messageContent =
        `${postData.title || ''}\n\n${postData.content || ''} \n\n ${postData.url || ''}`.trim();
      if (
        !postData.title &&
        !postData.content &&
        !postData.url &&
        imagesArray.length
      ) {
        messageContent = `${timeMessage}\n\n#GenZProtestSeptember8 #PunishTheCulprit #KPOli #RameshLekhak #CPNUML #NepalCongress`;
      } else {
        // Add time counter to all posts
        messageContent = `${messageContent}\n\n${timeMessage}\n\n${this.timeCounterService.getJusticeHashtags()}`;
      }

      // If videoUrl is present, post video to Facebook from public/videos
      if (postData.videoUrl) {
        let facebookResult = null;
        try {
          const baseUrl =
            this.configService.get<string>('PUBLIC_BASE_URL') ||
            `http://localhost:${this.configService.get<number>('PORT') ?? 3000}`;
          const normalized = `${postData.videoUrl}`.replace(/^\/+/, '');
          const pathWithPrefix = normalized.startsWith('videos/')
            ? normalized
            : `videos/${normalized}`;
          const fileUrl = `${baseUrl}/${pathWithPrefix}`;

          facebookResult = await this.facebookService.postToFacebookVideo({
            videoUrl: fileUrl,
            description: messageContent,
          });
          console.log('Successfully posted video to Facebook');
        } catch (e) {
          console.error('Failed to post video on Facebook', e);
        }

        // After video post, mark as posted and store Facebook post ID
        try {
          const updateData: any = {
            isPosted: true,
            postedAt: new Date(),
          };

          if (facebookResult?.id) {
            updateData.facebookId = facebookResult.id;
          }

          await selectedDoc.ref.update(updateData);
          console.log(`Marked document ${selectedDoc.id} as posted (video)`);
        } catch (e) {
          console.error('Failed to update post document as posted', e);
        }
        return;
      }
      const imageCsv = imagesArray.join(',');

      // Check if this post has been posted before (has social media IDs)
      const hasSocialIds = postData.twitterId || postData.facebookId;
      const reshareEnabled = this.configService.get<boolean>('RESHARE_ENABLED');

      let twitterResult = null;
      let facebookResult = null;

      if (reshareEnabled && hasSocialIds) {
        // Reshare existing posts
        try {
          if (postData.twitterId) {
            twitterResult = await this.twitterService.reshareTweet(
              postData.twitterId,
            );
            console.log('Successfully reshared on Twitter');
          }
        } catch (e) {
          console.error('Failed to reshare on Twitter', e);
        }

        try {
          if (postData.facebookId) {
            facebookResult = await this.facebookService.reshareFacebookPost(
              postData.facebookId,
            );
            console.log('Successfully reshared on Facebook');
          }
        } catch (e) {
          console.error('Failed to reshare on Facebook', e);
        }
      } else {
        // Create new posts
        try {
          twitterResult = await this.twitterService.postToTwitter({
            content: messageContent,
            image: imageCsv,
            url: postData.url,
          });
          console.log('Successfully posted to Twitter');
        } catch (e) {
          console.error('Failed to post on Twitter', e);
        }

        try {
          if (imagesArray.length) {
            facebookResult = await this.facebookService.postToFacebookWithImage(
              {
                image: imageCsv,
                content: messageContent,
              },
            );
          } else {
            facebookResult = await this.facebookService.post(messageContent);
          }
          console.log('Successfully posted to Facebook');
        } catch (e) {
          console.error('Failed to post on Facebook', e);
        }
      }

      // Update post document to mark as posted and store social media IDs
      try {
        const updateData: any = {
          isPosted: true,
          postedAt: new Date(),
        };

        // Store social media post IDs if this was a new post
        if (!hasSocialIds) {
          if (twitterResult?.id) {
            updateData.twitterId = twitterResult.id;
          }
          if (facebookResult?.id) {
            updateData.facebookId = facebookResult.id;
          }
        }

        await selectedDoc.ref.update(updateData);
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

  // Manual trigger for testing
  async manualTrigger() {
    console.log('Manual trigger called');
    return await this.handleCron();
  }

  // Manual HTML parsing helpers removed in favor of Readability
}
