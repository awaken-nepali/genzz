import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TimeCounterService } from '../utils/time-counter.service';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as FormData from 'form-data';

@Injectable()
export class FacebookService {
  private readonly pageId: string;
  private readonly accessToken: string;
  private readonly graphApiUrl = 'https://graph.facebook.com/v18.0';
  private readonly logger = new Logger(FacebookService.name);
  private getDefaultHashtags(): string {
    const timeMessage = this.timeCounterService.getDramaticJusticeMessage();
    return `${timeMessage}\n\n#GenZProtestSeptember8 #PunishTheCulprit #KPOli #RameshLekhak #CPNUML #NepalCongress`;
  }

  constructor(
    private configService: ConfigService,
    private timeCounterService: TimeCounterService,
  ) {
    this.pageId = this.configService.get<string>('FACEBOOK_PAGE_ID');
    this.accessToken = this.configService.get<string>(
      'FACEBOOK_USER_ACCESS_TOKEN',
    );
  }

  async post(message: string) {
    const url = `${this.graphApiUrl}/${this.pageId}/feed`;
    const finalMessage =
      `${message || ''}`

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
      const finalMessage =
        `${message || ''}\n\n${this.getDefaultHashtags()}`.trim();

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
      const finalMessage =
        `${content || ''}`;
      let photoUploadResponse, photoId;
      const photoIds: string[] = [];
      if (image) {
        try {
          const images = image.split(',');

          for (const img of images) {
            const photoUploadUrl = `https://graph.facebook.com/v19.0/${this.configService.getOrThrow(
              'FACEBOOK_PAGE_ID',
            )
              }/photos`;

            // Check if it's a localhost URL or no hostname - read from public directory
            const isLocalhost =
              img.includes('localhost') ||
              img.includes('127.0.0.1') ||
              !img.includes('://');
            let photoUploadResponse;

            if (isLocalhost) {
              // Extract path from URL and read from public directory
              const url = new URL(
                img.startsWith('http') ? img : `http://localhost:3000${img}`,
              );
              const publicPath = path.join(
                process.cwd(),
                'public',
                url.pathname.replace(/^\//, ''),
              );

              const form = new FormData();
              form.append('source', fs.createReadStream(publicPath));
              form.append('published', 'false');
              form.append(
                'access_token',
                this.configService.getOrThrow('FACEBOOK_USER_ACCESS_TOKEN'),
              );

              photoUploadResponse = await axios.post(photoUploadUrl, form, {
                headers: form.getHeaders(),
              });
            } else {
              // Use URL for external images
              photoUploadResponse = await axios.post(photoUploadUrl, null, {
                params: {
                  url: img,
                  published: false,
                  access_token: this.configService.getOrThrow(
                    'FACEBOOK_USER_ACCESS_TOKEN',
                  ),
                },
              });
            }
            console.log('photoUploadResponse', photoUploadResponse);
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
      const finalDescription =
        `${description || ''}`;

      const form = new FormData();
      form.append('description', finalDescription);
      form.append(
        'access_token',
        this.configService.getOrThrow('FACEBOOK_USER_ACCESS_TOKEN'),
      );

      // Check if it's a localhost URL or no hostname - read from public directory
      const isLocalhost =
        videoUrl.includes('localhost') ||
        videoUrl.includes('127.0.0.1') ||
        !videoUrl.includes('://');

      if (isLocalhost) {
        // Extract path from URL and read from public directory
        let localPath = videoUrl;
        if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
          try {
            const url = new URL(videoUrl);
            localPath = url.pathname; // like /videos/file.mp4
          } catch (e) {
            // If URL parsing fails, use the original string
            localPath = videoUrl;
          }
        }

        const normalized = localPath.replace(/^\/+/, '');
        const pathWithPrefix = normalized.startsWith('videos/')
          ? normalized
          : `videos/${normalized}`;
        const absolute = path.join(process.cwd(), 'public', pathWithPrefix);

        console.log('Video upload debug:', {
          originalUrl: videoUrl,
          localPath,
          normalized,
          pathWithPrefix,
          absolute,
          fileExists: fs.existsSync(absolute),
        });

        form.append('source', fs.createReadStream(absolute));
      } else {
        // Use URL for external videos
        form.append('file_url', videoUrl);
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
