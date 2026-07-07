import crypto from 'node:crypto'
import { challenge } from './store.js'

const supportedActivities = new Set(challenge.supportedActivities)

function getEnv(name) {
  return String(process.env[name] || '').trim()
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
}

function getAttributeMap(order) {
  const attributes = [...(order.note_attributes || []), ...(order.noteAttributes || [])]
  return attributes.reduce((map, entry) => {
    const key = normalizeKey(entry?.name || entry?.key)
    if (!key) return map
    map[key] = String(entry?.value || '').trim()
    return map
  }, {})
}

function firstDefined(...values) {
  return values.find((value) => String(value || '').trim())
}

function inferActivityType(order, attributes) {
  const explicit = firstDefined(
    attributes.activity_type,
    attributes.activity,
    attributes.challenge_activity,
    attributes.selected_activity,
  )
  if (explicit) {
    const matchedExplicit = challenge.supportedActivities.find(
      (activity) => activity.toLowerCase() === explicit.toLowerCase(),
    )
    if (matchedExplicit) {
      return matchedExplicit
    }
  }

  const candidateText = [
    order?.line_items?.map((item) => `${item?.title || ''} ${item?.variant_title || ''}`).join(' '),
    order?.tags,
    order?.note,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const matched = challenge.supportedActivities.find((activity) => candidateText.includes(activity.toLowerCase()))
  return matched || 'Other'
}

function inferPlannedActivityDate(order, attributes) {
  const explicit = firstDefined(
    attributes.planned_activity_date,
    attributes.activity_date,
    attributes.challenge_date,
    attributes.planned_date,
  )
  if (explicit && /^\d{4}-\d{2}-\d{2}$/.test(explicit)) {
    return explicit
  }

  const orderDate = String(order?.created_at || '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
    return orderDate
  }

  return challenge.startDate
}

function inferShirtSize(attributes) {
  const size = firstDefined(attributes.t_shirt_size, attributes.tshirt_size, attributes.shirt_size, attributes.size)
  return ['S', 'M', 'L', 'XL'].includes(size) ? size : 'M'
}

function joinAddress(address) {
  if (!address) return ''
  return [address.address1, address.address2, address.city, address.province, address.zip, address.country]
    .filter(Boolean)
    .join(', ')
}

function normalizePhone(phone) {
  return String(phone || '')
    .replace(/[^\d+]/g, '')
    .trim()
}

export function getShopifyStatus() {
  const configured = Boolean(getEnv('SHOPIFY_STORE_DOMAIN') && getEnv('SHOPIFY_API_SECRET'))
  return {
    enabled: configured,
    mode: configured ? 'Live Provider' : 'Local Log',
    provider: configured ? 'Shopify' : 'Not Connected',
    webhookTopic: getEnv('SHOPIFY_WEBHOOK_TOPIC') || 'orders/create',
    storeDomain: getEnv('SHOPIFY_STORE_DOMAIN') || '',
  }
}

export function verifyShopifyWebhook(rawBody, hmacHeader) {
  const secret = getEnv('SHOPIFY_API_SECRET')
  if (!secret || !hmacHeader) return false

  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
  const digestBuffer = Buffer.from(digest)
  const headerBuffer = Buffer.from(String(hmacHeader))
  if (digestBuffer.length !== headerBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(digestBuffer, headerBuffer)
}

export function mapShopifyOrderToRegistration(order) {
  const attributes = getAttributeMap(order)
  const shippingAddress = order.shipping_address || order.customer?.default_address || {}
  const billingAddress = order.billing_address || {}

  const firstName = firstDefined(
    attributes.full_name,
    attributes.name,
    order.customer?.first_name && order.customer?.last_name
      ? `${order.customer.first_name} ${order.customer.last_name}`
      : '',
    shippingAddress.name,
    billingAddress.name,
  )
  const email = firstDefined(attributes.email, order.email, order.contact_email, order.customer?.email)
  const phone = normalizePhone(
    firstDefined(attributes.phone, shippingAddress.phone, billingAddress.phone, order.phone, order.customer?.phone),
  )
  const address = firstDefined(attributes.address, joinAddress(shippingAddress), joinAddress(billingAddress))
  const registrationSource = `Shopify order ${order.name || order.order_number || order.id}`

  return {
    name: firstName || 'Shopify Participant',
    email: email || '',
    phone: phone || '',
    address: address || 'Address pending confirmation from Shopify order.',
    tshirtSize: inferShirtSize(attributes),
    selectedChallenge: inferActivityType(order, attributes),
    plannedActivityDate: inferPlannedActivityDate(order, attributes),
    photoDataUrl: '',
    instagram: firstDefined(attributes.instagram, attributes.instagram_handle),
    facebook: firstDefined(attributes.facebook, attributes.facebook_profile),
    strava: firstDefined(attributes.strava, attributes.strava_profile),
    website: firstDefined(attributes.website),
    source: registrationSource,
    sourceReference: `shopify-order-${order.id}`,
    sourceMetadata: {
      shopifyOrderId: String(order.id || ''),
      shopifyOrderName: String(order.name || order.order_number || ''),
      shopifyTopic: getEnv('SHOPIFY_WEBHOOK_TOPIC') || 'orders/create',
      challengeId: firstDefined(attributes.challenge_id, attributes.challenge),
      lineItems: (order.line_items || []).map((item) => ({
        id: item.id,
        title: item.title,
        variantTitle: item.variant_title,
        sku: item.sku,
        quantity: item.quantity,
      })),
    },
  }
}
