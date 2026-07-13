# TWA Release Blueprint

This document covers the Android Trusted Web Activity release path for `Pedals Power`.

## What is already prepared in this repo

- PWA manifest via `vite-plugin-pwa`
- release icon generator: `scripts/generate-release-assets.mjs`
- Bubblewrap starter config: `twa-manifest.json`
- Digital Asset Links starter file: `public/.well-known/assetlinks.json`
- Play Store graphic outputs under `public/store`

## Required before building an Android bundle

You need a hosted HTTPS deployment of Pedals Power.

The TWA cannot point to localhost, a tunnel URL, or a temporary preview URL for release.

You need:

- one production host such as `42hy.shop`
- working HTTPS
- the PWA deployed there
- `/.well-known/assetlinks.json` served from that domain

## 1. Generate icons and listing assets

Run:

```bash
npm run generate:release-assets
```

This creates:

- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/maskable-512.png`
- `public/store/play-store-icon-512.png`
- `public/store/play-store-feature-graphic-1024x500.png`

## 2. Update the hosted domain in `twa-manifest.json`

Replace:

- `REPLACE_WITH_HOSTED_DOMAIN`

With your real host, for example:

- `42hy.shop`

The final values should look like:

```json
{
  "packageId": "app.pedalspower.twa",
  "host": "42hy.shop",
  "iconUrl": "https://42hy.shop/icons/icon-512.png",
  "maskableIconUrl": "https://42hy.shop/icons/maskable-512.png"
}
```

## 3. Generate a signing key

If you do not already have one:

```bash
keytool -genkey -v -keystore pedalspower-release.jks -alias pedalspower -keyalg RSA -keysize 2048 -validity 10000
```

Keep the `.jks` file and passwords secure.

## 4. Get the SHA-256 certificate fingerprint

Run:

```bash
keytool -list -v -keystore pedalspower-release.jks -alias pedalspower
```

Copy the `SHA256` fingerprint.

## 5. Update `assetlinks.json`

Edit:

- `public/.well-known/assetlinks.json`

Replace:

- `REPLACE_WITH_RELEASE_CERT_SHA256`

With the signing certificate SHA-256 fingerprint.

## 6. Install Bubblewrap

Use the official Bubblewrap CLI:

```bash
npm install -g @bubblewrap/cli
```

## 7. Initialize the Android project

From the repo root:

```bash
bubblewrap init --manifest twa-manifest.json
```

This creates the Android wrapper project.

## 8. Build the Android App Bundle

Inside the Bubblewrap-generated Android project:

```bash
bubblewrap build
```

The release output will be an Android App Bundle:

- `.aab`

That is the file uploaded to the Play Console.

## 9. Verify the live TWA link association

Before uploading to Play:

1. Deploy the site
2. Confirm the following URL works:

```text
https://YOUR_HOST/.well-known/assetlinks.json
```

3. Confirm the host serves your PWA manifest and icons

## 10. Play Console upload

Use:

- package name: `app.pedalspower.twa`
- release file: the generated `.aab`

## Important limits

- TWA release testing cannot be completed purely on localhost
- a stable HTTPS production-like domain is required
- Play Store submission also requires a real Play Console account
