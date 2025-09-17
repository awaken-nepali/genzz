import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class FacebookService {
  private readonly pageId: string;
  private readonly accessToken: string;
  private readonly graphApiUrl = 'https://graph.facebook.com/v18.0';
  private readonly logger = new Logger(FacebookService.name);

  constructor(private configService: ConfigService) {
    this.pageId = this.configService.get<string>('FACEBOOK_PAGE_ID');
    this.accessToken = this.configService.get<string>('FACEBOOK_USER_ACCESS_TOKEN');
  }

  async post(message: string) {
    const url = `${this.graphApiUrl}/${this.pageId}/feed`;

    try {
      const response = await axios.post(url, {
        message,
        access_token: this.accessToken,
      });
      console.log('Post created on Facebook:', response.data);
      return response.data;
    } catch (error) {
      console.error(
        'Error posting to Facebook:',
        error.response ? error.response.data : error.message,
      );
      throw error;
    }
  }

  async postToFacebook(message: string): Promise<any> {
    try {
      const url = `https://graph.facebook.com/v19.0/${this.configService.getOrThrow(
        'APP_FACEBOOK_PAGE_ID',
      )}/feed`;

      const { data } = await axios.post(url, null, {
        params: {
          message: 'from tjhe api',
          access_token: this.configService.getOrThrow(
            'FACEBOOK_USER_ACCESS_TOKEN',
          ),
        },
      });

      this.logger.log(`Posted to Facebook: ${JSON.stringify(data)}`);
      return data;
    } catch (error) {
      this.logger.error(
        'Failed to post to Facebook',
        error?.response?.data || error.message,
      );
      throw error;
    }
  }

  async postToFacebookWithImage({
    image,
    content,
  }: {
    image: string;
    content: string;
  }): Promise<any> {
    try {
      let photoUploadResponse, photoId;
      const photoIds: string[] = [];
      if (image) {
        try {
          const images = image.split(',');

          for (const img of images) {
            const photoUploadUrl = `https://graph.facebook.com/v19.0/${this.configService.getOrThrow(
              'APP_FACEBOOK_PAGE_ID',
            )}/photos`;

            const photoUploadResponse = await axios.post(photoUploadUrl, null, {
              params: {
                url: img,
                published: false,
                access_token: this.configService.getOrThrow(
                  'FACEBOOK_USER_ACCESS_TOKEN',
                ),
              },
            });

            photoIds.push(photoUploadResponse.data.id);
          }
        } catch (e) {
          console.log(e);
        }
      }
      // Step 2: Create post with attached photo
      const postUrl = `https://graph.facebook.com/v19.0/${this.configService.getOrThrow(
        'APP_FACEBOOK_PAGE_ID',
      )}/feed`;
      const postResponse = await axios.post(postUrl, null, {
        params: {
          message: content,
          attached_media:
            image && photoIds.length
              ? JSON.stringify(photoIds.map((id) => ({ media_fbid: id })))
              : undefined,
          access_token: this.configService.getOrThrow(
            'FACEBOOK_USER_ACCESS_TOKEN',
          ),
        },
      });

      this.logger.log(
        `Posted image to Facebook: ${JSON.stringify(postResponse.data)}`,
      );
      return postResponse.data;
    } catch (error) {
      this.logger.error(
        'Failed to post image to Facebook',
        error?.response?.data || error.message,
      );
      throw error;
    }
  }


  async postComment(postId, commentText) {
    const url = `https://graph.facebook.com/${postId}/comments?message=${encodeURIComponent(
      commentText,
    )}&access_token=${this.configService.getOrThrow(
      'FACEBOOK_USER_ACCESS_TOKEN',
    )}`;

    // Make a POST request to Facebook Graph API
    const response = await fetch(url, {
      method: 'POST',
    });

    const data = await response.json();
    if (data.error) {
      console.error('Error posting comment:', data.error);
    } else {
      console.log('Successfully posted comment:', data);
    }
  }
}
