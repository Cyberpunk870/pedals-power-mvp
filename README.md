# Pedals Power

`Pedals Power` is a standalone, mobile-first movement challenge app. It is intentionally separate from `bitewise`, `homeo-hub`, and any related cloud account, Vercel project, Firebase project, or Google Cloud project.

The current repository focuses on an independent participant journey:

- Registration
- Optional backend Shopify order sync via webhook
- Social profile linking
- Local or live registration confirmations by email and SMS
- Activity proof submission with tracker screenshot and participant activity photo
- Poster generation from the selected submission
- Certificate generation without participant imagery

## What is in this repo

- React frontend for the participant flow
- Express API with `zod` validation
- In-memory storage for local MVP use
- SVG-based poster and certificate generation
- Provider-ready messaging hooks for:
  - SMTP email
  - Twilio SMS
- PWA/TWA-ready frontend metadata

## Ownership model

This project is designed to run under its own independent credentials. Use fresh accounts and credentials that are not tied to Bitewise or any related organization.

Examples:

- SMTP account owned for `Pedals Power`
- Twilio account owned for `Pedals Power`
- Separate deployment target if you later host it on Vercel, Render, Railway, Firebase, or another platform

## Local run

```bash
npm install
npm run dev:full
```

Default endpoints:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`

If either port is already in use, stop the conflicting local process first.

## Messaging setup

Real delivery is optional. If credentials are missing, the app still works and logs local message records instead.

Create a `.env` file from `.env.example` and fill only the providers you want to enable.

## Shopify backend sync

The backend still exposes a verified Shopify webhook endpoint for admin-side sync:

- `POST /api/integrations/shopify/webhook`

Use it with a standalone Shopify custom app owned for `Pedals Power` only if you want Shopify to feed registrations into the backend. The participant-facing app no longer depends on Shopify login or Shopify checkout.

Required vars:

- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_ADMIN_ACCESS_TOKEN`
- `SHOPIFY_WEBHOOK_TOPIC`

Recommended topic for local development:

- `orders/create`

Recommended topic for production:

- `orders/paid`

If used, order data is mapped into a participant registration using:

- customer name
- email
- phone
- shipping or billing address
- note attributes such as `activity_type`, `planned_activity_date`, `tshirt_size`, and `challenge_id`

The webhook flow is idempotent by `shopify-order-{order.id}`, so Shopify retries do not create duplicate participants.

For the best participant UX, use the in-app Pedals Power registration flow as the primary entrypoint and keep Shopify as an optional backend/admin integration.

## Firebase setup

To enable persistent storage outside local memory, create a brand-new Firebase project under a new standalone Google account for `Pedals Power`.

Required vars:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`

With those values present, the backend will use:

- Firestore for registrations, participants, activities, notifications, and asset metadata
- Firebase Storage for generated poster and certificate files

Without them, the app stays in local in-memory mode.

### Email via SMTP

Required vars:

- `EMAIL_PROVIDER=smtp`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`

### SMS via Twilio

Required vars:

- `SMS_PROVIDER=twilio`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

## Build

```bash
npm run build
npm run preview
```

## TWA / Play Store

This repo includes the starter artifacts for Android Trusted Web Activity packaging and Play Store prep.

Generate release assets:

```bash
npm run generate:release-assets
```

Key files:

- `twa-manifest.json`
- `public/.well-known/assetlinks.json`
- `docs/twa-release.md`
- `docs/play-store-listing.md`
- `public/store/play-store-icon-512.png`
- `public/store/play-store-feature-graphic-1024x500.png`

Current production host target in repo metadata:

- `42hy.shop`

## Main files

- `src/App.tsx`: participant flow and UI
- `src/App.css`: component styling
- `src/index.css`: global theme and typography
- `src/api.ts`: frontend API client
- `src/types.ts`: shared types
- `server/index.js`: API routes and validation
- `server/store.js`: in-memory workflow state and asset generation
- `server/messaging.js`: SMTP and Twilio message delivery hooks
- `vite.config.ts`: Vite and PWA configuration
- `twa-manifest.json`: starter TWA metadata
