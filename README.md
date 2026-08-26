# Standalone Server Deployment Guide

This directory (`server-standalone`) contains everything you need to deploy the AI Hair Style Recommendation server separately from the mobile application.

## Directory Structure

We have extracted the necessary directories to run the server independently:
- `server/`: Contains the core API logic, tRPC routes, and Express setup.
- `shared/`: Contains types and utilities shared between the frontend and backend.
- `database/`: Contains the SQLite database setup and schemas.

## Prerequisites

Make sure you have Node.js and a package manager installed on your server (like `pnpm`, `npm`, or `yarn`). 

## Setup & Running

1. **Navigate into this directory**:
   ```bash
   cd server-standalone
   ```

2. **Install dependencies**:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Set up Environment Variables**:
   Create a `.env` file in `server-standalone/` with the following contents (modify as needed for production):
   ```env
   NODE_ENV=production
   PORT=8081
   # Add your OpenAI/Cloudflare API keys and Database URLs here as required by the app
   ```

4. **Run for Development**:
   ```bash
   npm run dev
   # or
   pnpm dev
   ```
   This will start the server using `tsx watch` for hot-reloading.

5. **Build and Run for Production**:
   First, build the project using esbuild:
   ```bash
   npm run build
   # or
   pnpm build
   ```
   This will output a bundled `dist/index.js` file.

   Then, run the compiled file:
   ```bash
   npm run start
   # or
   pnpm start
   ```

## Connecting the Client

Once your standalone server is running on a live domain (e.g., `https://api.yourdomain.com`), you need to update the client application to point to this new URL.

In your main app directory (`d:\kunj\Ai-Hair-Style-Recommendation`), update the `apiBaseUrl` or tRPC client configuration to point to your live server URL instead of `localhost`.

### Example Client Update (in your app's trpc configuration):
Change the URL from `http://localhost:8081/api/trpc` to `https://api.yourdomain.com/api/trpc`.
