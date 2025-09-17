import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { TwitterApi } from 'twitter-api-v2';
import { truncate } from 'lodash';

@Injectable()
export class TwitterService {
  private twitterClient: TwitterApi;

  constructor(private configService: ConfigService) {
    this.twitterClient = new TwitterApi({
      appKey: this.configService.get<string>('TWITTER_API_KEY'),
      appSecret: this.configService.get<string>('TWITTER_API_SECRET_KEY'),
      accessToken: this.configService.get<string>('TWITTER_ACCESS_TOKEN'),
      accessSecret: this.configService.get<string>('TWITTER_ACCESS_TOKEN_SECRET'),
    });
  }

  async post(tweet: string) {
    const rwClient = this.twitterClient.readWrite;
    try {
      await rwClient.v2.tweet(tweet);
      console.log('Tweet posted successfully');
    } catch (error) {
      console.error('Error posting tweet:', error);
    }
  }


  async postToTwitter(
    post: any,
    in_reply_to_status_id?: string,
  ) {
    try {
      const { content: tweetText, image: mediaUrl, comment } = post;
      const texts = tweetText.split('\n');
      const hashtags = texts.pop();
      const maxTweetLength = 280;
      const separator = '\n';
      const reservedLength = hashtags.length + separator.length + 3; // 3 for the ellipsis
      // Trim the tweet text to make room for ellipsis and hashtags
      const trimmedTweet = tweetText.slice(0, maxTweetLength - reservedLength);

      // Add ellipsis and then the hashtags
      let text = in_reply_to_status_id
        ? tweetText
        : trimmedTweet +
        (in_reply_to_status_id ? '' : '...') +
        separator +
        hashtags;
      const images = mediaUrl?.split(',') || [];

      let mediaIds = [];
      if (images.length) {
        for (const img of images) {
          try {
            const response = await axios.get(img, {
              responseType: 'arraybuffer',
            });

            const mediaBuffer = Buffer.from(response.data, 'binary');

            const mediaId = await this.twitterClient.v1.uploadMedia(
              mediaBuffer,
              {
                type: 'jpg', // Change to 'png' or 'gif' based on the file type
              },
            );
            mediaIds.push(mediaId);
          } catch (err) {
            console.log(err);
          }
        }
      }

      const response = await this.twitterClient.v2.tweet(
        truncate(text, { length: 280 }),
        {
          media: mediaIds.length
            ? {
              media_ids: mediaIds.slice(0, 4) as
                | [string]
                | [string, string]
                | [string, string, string]
                | [string, string, string, string],
            }
            : undefined,
          reply: in_reply_to_status_id && {
            in_reply_to_tweet_id: in_reply_to_status_id,
          },
        },
      );
      if (!in_reply_to_status_id) {
        await this.postToTwitter({ content: post.comment }, response.data.id);
      }
      console.log('Tweet posted:', response);
    } catch (err) {
      console.error('Error posting tweet:', err);
    }
  }

}
