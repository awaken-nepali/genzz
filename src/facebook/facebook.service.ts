import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';

@Injectable()
export class FacebookService {
  private readonly pageId: string;
  private readonly accessToken: string;
  private readonly graphApiUrl = 'https://graph.facebook.com/v18.0';
  private readonly logger = new Logger(FacebookService.name);
  private readonly defaultHashtags =
    '#GenZProtestSeptember8 #PunishTheCulprit #KPOli #RameshLekhak #CPNUML #NepalCongress';

  constructor(private configService: ConfigService) {
    this.pageId = this.configService.get<string>('FACEBOOK_PAGE_ID');
    this.accessToken = this.configService.get<string>('FACEBOOK_USER_ACCESS_TOKEN');
  }

  async post(message: string) {
    const url = `${this.graphApiUrl}/${this.pageId}/feed`;
    const finalMessage = `${message || ''}\n\n${this.defaultHashtags}`.trim();

    try {
      const response = await axios.post(url, {
        message: finalMessage,
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
        'FACEBOOK_PAGE_ID',
      )}/feed`;
      const finalMessage = `${message || ''}\n\n${this.defaultHashtags}`.trim();

      const { data } = await axios.post(url, null, {
        params: {
          message: finalMessage,
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
      const finalMessage = `${content || ''}\n\n${this.defaultHashtags}`.trim();
      let photoUploadResponse, photoId;
      const photoIds: string[] = [];
      if (image) {
        try {
          const images = image.split(',');

          for (const img of images) {
            const photoUploadUrl = `https://graph.facebook.com/v19.0/${this.configService.getOrThrow(
              'FACEBOOK_PAGE_ID',
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
        'FACEBOOK_PAGE_ID',
      )}/feed`;
      const postResponse = await axios.post(postUrl, null, {
        params: {
          message: finalMessage,
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

  async postToFacebookVideo({
    videoUrl,
    description,
  }: {
    videoUrl: string;
    description?: string;
  }): Promise<any> {
    try {
      const url = `https://graph.facebook.com/v19.0/${this.configService.getOrThrow(
        'FACEBOOK_PAGE_ID',
      )}/videos`;
      const finalDescription = `${description || ''}\n\n${this.defaultHashtags}`.trim();

      const form = new FormData();
      form.append('description', finalDescription);
      form.append('access_token', this.configService.getOrThrow('FACEBOOK_USER_ACCESS_TOKEN'));

      if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
        form.append('file_url', videoUrl);
      } else {
        const absolute = path.isAbsolute(videoUrl)
          ? videoUrl
          : path.join(process.cwd(), 'public', 'videos', videoUrl.replace(/^\/+/, ''));
        form.append('source', fs.createReadStream(absolute));
      }

      const { data } = await axios.post(url, form, {
        headers: form.getHeaders(),
      });

      this.logger.log(`Posted video to Facebook: ${JSON.stringify(data)}`);
      return data;
    } catch (error) {
      this.logger.error(
        'Failed to post video to Facebook',
        error?.response?.data || error.message,
      );
      throw error;
    }
  }
}
