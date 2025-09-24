export default () => ({
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT) || 3000,
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || '',
    RESHARE_ENABLED:
        (process.env.RESHARE_ENABLED || 'false').toLowerCase() === 'true',

    // Firebase
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,

    // Twitter
    TWITTER_API_KEY: process.env.TWITTER_API_KEY,
    TWITTER_API_SECRET_KEY: process.env.TWITTER_API_SECRET_KEY,
    TWITTER_ACCESS_TOKEN: process.env.TWITTER_ACCESS_TOKEN,
    TWITTER_ACCESS_TOKEN_SECRET: process.env.TWITTER_ACCESS_TOKEN_SECRET,

    // Facebook
    FACEBOOK_PAGE_ID: process.env.FACEBOOK_PAGE_ID,
    FACEBOOK_USER_ACCESS_TOKEN: process.env.FACEBOOK_USER_ACCESS_TOKEN,
    FACEBOOK_GRAPH_API_VERSION: process.env.FACEBOOK_GRAPH_API_VERSION || 'v23.0',

    // Sync
    SYNC_GITHUB_CSV_URLS: process.env.SYNC_GITHUB_CSV_URLS,
    SYNC_DEBUG: (process.env.SYNC_DEBUG || 'false').toLowerCase() === 'true',
});
