import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { parse } from 'csv-parse/sync';
import { google } from 'googleapis';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class SyncService {
    private readonly logger = new Logger(SyncService.name);

    constructor(
        private readonly config: ConfigService,
        private readonly firebase: FirebaseService,
    ) { }

    @Cron('0 3 * * *')
    async nightlySync() {
        this.logger.log('Starting nightly sync from sources');
        const firestore = this.firebase.getFirestore();
        const debug =
            (this.config.get<string>('SYNC_DEBUG') || '').toLowerCase() === 'true';

        const rowsFromSheets = []; //await this.fetchFromGoogleSheets();
        const rowsFromGithub = await this.fetchFromGithubCsvs();
        console.log('rowsFromGithub', rowsFromGithub);
        const allRows = [...rowsFromSheets, ...rowsFromGithub];

        const normalized = this.normalizeRows(allRows);
        console.log('Normalized rows:', normalized);
        if (debug) {
            this.logger.log(`Normalized ${normalized.length} rows`);
            const withImages = normalized.filter((r) => (r.images || []).length);
            this.logger.log(
                `Rows containing images: ${withImages.length} → sample: ${JSON.stringify(
                    withImages.slice(0, 3),
                )}`,
            );
        }
        const unique = this.dedupeByUrlOrTitle(normalized);

        // Upsert into Firestore posts collection
        for (const item of unique) {
            try {
                const id = this.generateId(item);
                const ref = firestore.collection('posts').doc(id);
                const payload: Record<string, any> = {
                    images: item.images || [],
                    priority: item.priority ?? 0,
                    isPosted: false,
                    updatedAt: new Date(),
                };
                if (item.title !== undefined) payload.title = item.title;
                if (item.content !== undefined) payload.content = item.content;
                if (item.url !== undefined) payload.url = item.url;
                if (item.videoUrl !== undefined) payload.videoUrl = item.videoUrl;
                await ref.set(payload, { merge: true });
                if (debug) {
                    const saved = await ref.get();
                    const data = saved.data();
                    this.logger.log(
                        `Upserted ${id} with images: ${(data?.images || []).length} → ${JSON.stringify(
                            data?.images || [],
                        )}`,
                    );
                }
            } catch (e) {
                this.logger.error('Failed to upsert item', e?.message || e);
            }
        }

        this.logger.log(`Synced ${unique.length} items`);
    }

    private async fetchFromGoogleSheets(): Promise<any[]> {
        try {
            const spreadsheetId = this.config.get<string>('SYNC_SHEETS_ID');
            const range =
                this.config.get<string>('SYNC_SHEETS_RANGE') || 'Approved!A:Z';
            const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
            const privateKey = this.config
                .get<string>('FIREBASE_PRIVATE_KEY')
                ?.replace(/\\n/g, '\n');

            if (!spreadsheetId || !clientEmail || !privateKey) return [];

            const jwt = new google.auth.JWT({
                email: clientEmail,
                key: privateKey,
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
            });

            const sheets = google.sheets({ version: 'v4', auth: jwt });
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range,
            });
            const values = res.data.values || [];
            if (values.length < 2) return [];
            const headers = values[0].map((h) => `${h}`.trim().toLowerCase());
            return values.slice(1).map((row) => {
                const rec: Record<string, any> = {};
                headers.forEach((h, i) => (rec[h] = row[i]));
                return rec;
            });
        } catch (e) {
            this.logger.error('Sheets fetch failed', e?.message || e);
            return [];
        }
    }

    private async fetchFromGithubCsvs(): Promise<any[]> {
        try {
            const isDev = this.config.get<string>('NODE_ENV') === 'development' || !this.config.get<string>('NODE_ENV');
            const items: any[] = [];

            if (isDev) {
                // In development, read from local samples file
                const csvPath = path.join(process.cwd(), 'samples', 'posts.sample.csv');
                try {
                    const data = fs.readFileSync(csvPath, 'utf8');
                    const records = parse(data, {
                        columns: true,
                        skip_empty_lines: true,
                        trim: true,
                    });
                    console.log('Local CSV records:', records);
                    items.push(...records);
                } catch (e) {
                    this.logger.warn(`Local CSV read failed: ${e?.message || e}`);
                }
            } else {
                // In production, fetch from URLs
                const urls = (
                    this.config.get<string>('SYNC_GITHUB_CSV_URLS') ||
                    'https://raw.githubusercontent.com/awaken-nepali/genzz/refs/heads/main/samples/posts.sample.csv'
                )
                    .split(',')
                    .map((u) => u.trim())
                    .filter(Boolean);
                console.log('urls', urls);
                for (const url of urls) {
                    try {
                        const { data } = await axios.get(url, { responseType: 'text' });
                        console.log('data', data);
                        const records = parse(data, {
                            columns: true,
                            skip_empty_lines: true,
                            trim: true,
                        });
                        console.log('records', records);
                        items.push(...records);
                    } catch (e) {
                        this.logger.warn(`CSV fetch failed for ${url}: ${e?.message || e}`);
                    }
                }
            }
            return items;
        } catch (e) {
            this.logger.error('GitHub CSV fetch failed', e?.message || e);
            return [];
        }
    }

    private normalizeRows(rows: any[]): Array<{
        title?: string;
        content?: string;
        url?: string;
        images?: string[];
        videoUrl?: string;
        priority?: number;
    }> {
        return rows
            .map((r) => ({
                title: r.title || r.Title || undefined,
                content: r.content || r.description || r.Content || undefined,
                url: r.url || r.link || r.URL || undefined,
                images: (r.images || r.Images || '')
                    .toString()
                    .split(',')
                    .map((s: string) => s.trim())
                    .filter(Boolean),
                videoUrl:
                    r.videoUrl ||
                    r.videoURL ||
                    r.VideoUrl ||
                    r.VideoURL ||
                    r.video ||
                    undefined,
                priority: Number.isFinite(Number(r.priority)) ? Number(r.priority) : 0,
            }))
            .filter(
                (r) =>
                    r.title ||
                    r.content ||
                    r.url ||
                    (r.images || []).length ||
                    r.videoUrl,
            );
    }

    private dedupeByUrlOrTitle(items: any[]) {
        const seen = new Set<string>();
        const out: any[] = [];
        for (const it of items) {
            // Create a comprehensive key including all images
            const allImages = (it.images || []).join(',');
            const key = (
                allImages ||
                it.videoUrl ||
                it.url ||
                it.title ||
                ''
            ).toLowerCase();

            console.log('Deduplication check:', {
                url: it.url,
                videoUrl: it.videoUrl,
                images: it.images,
                allImages,
                title: it.title,
                key,
                isDuplicate: seen.has(key)
            });

            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push(it);
        }
        return out;
    }

    private generateId(item: any): string {
        const allImages = (item.images || []).join(',');
        const base = (
            allImages ||
            item.videoUrl ||
            item.url ||
            item.title ||
            `${Date.now()}`
        ).toLowerCase();
        return base
            .replace(/https?:\/\//g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 200);
    }
}
