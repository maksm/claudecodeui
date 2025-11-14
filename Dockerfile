# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts && apk del python3 make g++

# Copy built assets and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Run the server
CMD ["node", "server/index.js"]

# Testing stage
FROM node:20-alpine AS testing

WORKDIR /app

# Install all dependencies including Playwright browsers
RUN apk add --no-cache python3 make g++ nmap chromium \
    # Install browser dependencies for Playwright on Alpine
    && apk add --no-cache \
        bash \
        ca-certificates \
        freetype \
        freetype-dev \
        harfbuzz \
        ca-certificates \
        libgcc \
        libstdc++ \
        libpng \
        libpng-dev \
        libxcomposite \
        libxcursor \
        libxdamage \
        libxext \
        libxfixes \
        libxi \
        libxrandr \
        libxrender \
        libxscrnsaver \
        libxtst \
        nss \
        xdg-utils

# Install all dependencies (including dev deps for testing)
COPY package*.json ./
RUN npm ci && npx playwright install chromium firefox webkit --with-deps

# Copy built assets and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# Set environment variables for testing
ENV NODE_ENV=test
ENV PORT=3001

# Default to running tests in CI
CMD ["npm", "run", "test:e2e"]
