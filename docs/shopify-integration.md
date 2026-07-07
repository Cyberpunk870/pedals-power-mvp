# Shopify Integration

This app now supports Shopify as an inbound registration source through a verified webhook.

## What is already done in code

- Verified Shopify webhook endpoint: `POST /api/integrations/shopify/webhook`
- HMAC signature validation using `X-Shopify-Hmac-SHA256`
- Order-to-registration mapping
- Idempotent registration handling by Shopify order ID
- Normal Pedals Power email and SMS confirmation flow after successful webhook registration

## Required environment values

Add these values to `.env`:

```env
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_API_SECRET=replace-with-shopify-api-secret
SHOPIFY_ADMIN_ACCESS_TOKEN=replace-with-admin-access-token
SHOPIFY_WEBHOOK_TOPIC=orders/create
```

Notes:

- `SHOPIFY_API_SECRET` is required for webhook verification.
- `SHOPIFY_ADMIN_ACCESS_TOKEN` is reserved for future admin-side API calls and webhook automation.
- For development stores, the recommended webhook topic is `orders/create`.
- For production stores, the recommended webhook topic is `orders/paid`.

## Shopify admin steps

1. Open Shopify admin.
2. Go to `Settings > Apps`.
3. Open `Develop apps`.
4. Click `Build apps in Dev Dashboard`.
5. Create a new custom app for `Pedals Power`.
6. Configure Admin API access.
7. Enable at least `read_orders`.
8. Install the app.
9. Copy the store domain, app secret, and admin access token into `.env`.
10. Add an HTTPS webhook subscription for `orders/create` in development stores, or `orders/paid` in production.
11. Point the webhook URL to:

```text
https://YOUR-PUBLIC-DOMAIN/api/integrations/shopify/webhook
```

## Local development

Shopify cannot deliver webhooks directly to plain localhost.

Use a public HTTPS tunnel for local testing, for example:

```bash
cloudflared tunnel --url http://localhost:4000
```

Then use the generated HTTPS URL as the webhook target.

## How the order is mapped

Pedals Power reads the Shopify order and uses:

- customer name
- email
- phone
- shipping address or billing address
- note attributes

Supported note attribute keys:

- `activity_type`
- `planned_activity_date`
- `tshirt_size`
- `challenge_id`
- `instagram`
- `facebook`
- `strava`
- `website`

## Recommended Shopify product setup

For the MVP, use this structure:

1. One challenge product in Shopify.
2. T-shirt size as a product variant.
3. Challenge ID stored in SKU, variant title, or note attributes.
4. Activity choice completed inside Pedals Power after registration.

This is the cleanest setup because Shopify handles payment and order creation, while Pedals Power handles the challenge workflow.

## Testing checklist

1. Start the API and app with `npm run dev:full`.
2. Expose the API through an HTTPS tunnel.
3. Update the Shopify webhook URL to the tunnel URL.
4. In development stores, create a test order path that triggers `orders/create`.
5. In production-like testing, place a paid order that triggers `orders/paid`.
6. Confirm the webhook returns `200`.
7. Confirm a participant appears in Pedals Power.
8. Confirm email and SMS logs or live sends are created.

## Current limitation

If the Shopify order does not include a real email or phone number, Pedals Power rejects the webhook with `422`, because registration confirmation depends on valid contact data.
