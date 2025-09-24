# Multi-stage Dockerfile for NestJS (social-poster-service)

FROM node:20-alpine AS base
WORKDIR /app

# Install OS deps if needed (uncomment if native deps are added later)
# RUN apk add --no-cache python3 make g++

# 1) Install dependencies (with cache)
FROM base AS deps
COPY package*.json ./
RUN npm ci

# 2) Build the app
FROM deps AS build
COPY nest-cli.json tsconfig*.json ./
COPY src ./src
COPY public ./public
COPY samples ./samples
RUN npm run build

# 3) Production image with only prod deps + built files
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Install only prod deps
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built app and static assets
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

# If you need local sample CSVs in container (dev/testing)
# COPY --from=build /app/samples ./samples

# Health and runtime config
ENV PORT=3000
EXPOSE 3000

# For firebase private key env that contains literal \n
# Example: docker run -e FIREBASE_PRIVATE_KEY="$(cat key | sed ':a;N;$!ba;s/\n/\\n/g')" ...

CMD ["node", "dist/main.js"]


