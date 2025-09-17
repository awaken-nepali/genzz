import { SyncService } from '../src/sync/sync.service';
import { ConfigService } from '@nestjs/config';

class SimpleConfigService implements Partial<ConfigService> {
    get<T = string>(key: string): T | undefined {
        return (process.env[key] as unknown) as T;
    }
    getOrThrow<T = string>(key: string): T {
        const value = process.env[key];
        if (value === undefined) {
            throw new Error(`Missing required env: ${key}`);
        }
        return (value as unknown) as T;
    }
}

type FirestoreDocRef = {
    set: (data: Record<string, any>, _opts?: any) => Promise<void>;
    get: () => Promise<{ data: () => Record<string, any> }>;
};

type FirestoreCollection = {
    doc: (id: string) => FirestoreDocRef;
};

class MockFirestore {
    private storage: Map<string, Record<string, any>> = new Map();

    collection(_name: string): FirestoreCollection {
        return {
            doc: (id: string) => ({
                set: async (data: Record<string, any>) => {
                    const existing = this.storage.get(id) || {};
                    this.storage.set(id, { ...existing, ...data });
                },
                get: async () => ({
                    data: () => this.storage.get(id) || {},
                }),
            }),
        };
    }

    summary() {
        return {
            count: this.storage.size,
            ids: Array.from(this.storage.keys()),
        };
    }
}

class MockFirebaseService {
    private readonly db = new MockFirestore();
    getFirestore() {
        return this.db as any;
    }
}

async function main() {
    // Defaults: use local static server if not provided
    const defaultUrl = 'http://localhost:8001/posts.sample.csv';
    process.env.SYNC_GITHUB_CSV_URLS =
        process.env.SYNC_GITHUB_CSV_URLS || defaultUrl;
    process.env.SYNC_DEBUG = process.env.SYNC_DEBUG || 'true';

    const config = new SimpleConfigService() as ConfigService;
    const firebase = new MockFirebaseService() as any;
    const svc = new SyncService(config, firebase);

    await svc.nightlySync();

    const summary = (firebase as any).db.summary();
    // eslint-disable-next-line no-console
    console.log(
        JSON.stringify(
            {
                upsertedCount: summary.count,
                sampleIds: summary.ids.slice(0, 5),
            },
            null,
            2,
        ),
    );
}

main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
});


