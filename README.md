# Social Poster Service

A NestJS-based service that periodically fetches content from a Firebase database and posts it to social media platforms like Twitter and Facebook.

## Description

This service is designed to automate social media posting. It uses a cron job to trigger posting at a regular interval. The content for the posts is fetched from a Firebase Firestore database. The service is built to be extensible, allowing for the future addition of other social media platforms like Reddit.

## Project Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd social-poster-service
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

## Configuration

Configuration for the service is managed through environment variables. Create a `.env` file in the root of the project by copying the `.env.example` file (if it exists) or by creating a new one.

```bash
cp .env.example .env
```

Fill in the `.env` file with your credentials for the following services:

- **Firebase:**
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`

- **Twitter API v2:**
  - `TWITTER_API_KEY`
  - `TWITTER_API_SECRET_KEY`
  - `TWITTER_ACCESS_TOKEN`
  - `TWITTER_ACCESS_TOKEN_SECRET`

- **Facebook Graph API:**
  - `FACEBOOK_APP_ID`
  - `FACEBOOK_APP_SECRET`
  - `FACEBOOK_PAGE_ID`
  - `FACEBOOK_USER_ACCESS_TOKEN`

**Note on `FIREBASE_PRIVATE_KEY`:** The private key from your Firebase service account JSON file should be formatted as a single line with `\n` representing newlines.

## Running the Application

Once the dependencies are installed and the `.env` file is configured, you can run the application in development mode:

```bash
# Watch mode
$ npm run start:dev
```

The service will start, and the cron job will be scheduled to run every minute.

## Project Structure

The project is organized into the following modules:

- `app.module.ts`: The root module of the application.
- `schedule`: Contains the cron job logic for scheduling posts.
- `firebase`: Handles the connection to and data fetching from Firebase Firestore.
- `twitter`: Manages posting to the Twitter API.
- `facebook`: Manages posting to the Facebook Graph API.

Each module contains a service where the core logic for that module resides.

## License

This project is licensed under the MIT License.