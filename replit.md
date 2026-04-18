# Farcaster Mini

A Farcaster Miniapp with Plinks integration, built with Next.js.

## Overview

This is a decentralized communication miniapp that provides secure, private, and reliable messaging capabilities with decentralized architecture and end-to-end encryption.

## Architecture

- **Framework**: Next.js 14 (pages router)
- **Language**: TypeScript
- **Styling**: CSS (globals.css)
- **HTTP Client**: Axios
- **Package Manager**: npm

## Project Structure

```
src/
  components/
    LoginButton.tsx    - Farcaster login button component
  pages/
    _app.tsx           - Next.js app wrapper
    index.tsx          - Home page
    api/
      auth.ts          - Auth API endpoint
  styles/
    globals.css        - Global styles
next.config.js         - Next.js configuration
tsconfig.json          - TypeScript configuration
```

## Running the App

Development server runs on port 5000:
```bash
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:
- `NEXT_PUBLIC_FARCASTER_API_URL` - Farcaster API URL
- `FARCASTER_API_KEY` - Farcaster API key
- `NEXT_PUBLIC_PLINKS_API_URL` - Plinks API URL
- `PLINKS_API_KEY` - Plinks API key
- `NEXT_PUBLIC_APP_URL` - Application URL

## Deployment

Configured for autoscale deployment:
- Build: `npm run build`
- Run: `npm run start`
