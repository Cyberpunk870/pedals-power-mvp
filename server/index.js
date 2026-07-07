import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import {
  addActivity,
  addNotificationLog,
  createCertificate,
  createPoster,
  createRegistration,
  getAsset,
  getDashboardData,
  selectActivity,
  updateParticipant,
} from './store.js'
import { getMessagingStatus, sendRegistrationNotifications } from './messaging.js'
import { getShopifyStatus, mapShopifyOrderToRegistration, verifyShopifyWebhook } from './shopify.js'

const app = express()
const PORT = 4000

app.use(cors())

app.post('/api/integrations/shopify/webhook', express.raw({ type: 'application/json', limit: '2mb' }), async (req, res) => {
  const webhookStatus = getShopifyStatus()
  if (!webhookStatus.enabled) {
    res.status(503).json({ error: 'Shopify integration is not configured.' })
    return
  }

  const hmac = req.get('X-Shopify-Hmac-Sha256')
  const topic = req.get('X-Shopify-Topic') || webhookStatus.webhookTopic
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '')

  if (!verifyShopifyWebhook(rawBody, hmac)) {
    res.status(401).json({ error: 'Invalid Shopify webhook signature.' })
    return
  }

  let order
  try {
    order = JSON.parse(rawBody.toString('utf8'))
  } catch {
    res.status(400).json({ error: 'Invalid Shopify payload.' })
    return
  }

  try {
    const registrationPayload = mapShopifyOrderToRegistration(order)
    if (!registrationPayload.email || !registrationPayload.phone) {
      res.status(422).json({
        error: 'Shopify order is missing the email or phone required to create a registration.',
      })
      return
    }
    registrationPayload.sourceMetadata = {
      ...registrationPayload.sourceMetadata,
      shopifyTopic: topic,
    }
    const registrationResult = await createRegistration(registrationPayload)
    const createdParticipant = registrationResult.participant
    if (!createdParticipant) {
      res.status(409).json({ error: 'Unable to create a participant from this Shopify order.' })
      return
    }

    const notificationLogs = registrationResult.created ? await sendRegistrationNotifications(createdParticipant) : []
    await Promise.all(
      notificationLogs.map((entry) =>
        addNotificationLog({
          id: `${entry.channel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          participantId: createdParticipant.id,
          ...entry,
        }),
      ),
    )

    res.status(200).json({
      ok: true,
      participantId: createdParticipant.id,
      registrationId: createdParticipant.registrationId,
      topic,
    })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Shopify webhook processing failed.',
    })
  }
})

app.use(express.json({ limit: '16mb' }))

const activityKinds = ['Cycling', 'Running', 'Walking', 'Swimming', 'Yoga', 'Hiking', 'Gym Workout', 'Other']

const phoneSchema = z
  .string()
  .trim()
  .min(8, 'Phone number is too short.')
  .max(20, 'Phone number is too long.')
  .regex(/^[+\d\s()-]+$/, 'Phone number contains invalid characters.')

const emailSchema = z.string().trim().email('Enter a valid email address.')

const registrationSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.').max(80, 'Name is too long.'),
  email: emailSchema,
  phone: phoneSchema,
  address: z.string().trim().min(8, 'Address is required.').max(180, 'Address is too long.'),
  tshirtSize: z.enum(['S', 'M', 'L', 'XL']),
  selectedChallenge: z.enum(activityKinds),
  plannedActivityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  photoDataUrl: z.string().optional().default(''),
  instagram: z.string().trim().max(120).optional().default(''),
  facebook: z.string().trim().max(120).optional().default(''),
  strava: z.string().trim().max(120).optional().default(''),
  website: z.string().trim().max(160).optional().default(''),
})

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  phone: phoneSchema,
  address: z.string().trim().min(8).max(180),
  selectedChallenge: z.enum(activityKinds),
  plannedActivityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  photoDataUrl: z.string().optional().default(''),
  socials: z.object({
    instagram: z.string().trim().max(120),
    facebook: z.string().trim().max(120),
    strava: z.string().trim().max(120),
    website: z.string().trim().max(160),
  }),
  posterProfile: z.object({
    themeTitle: z.string().trim().min(3).max(40),
    themeSubtitle: z.string().trim().min(3).max(80),
    dateLabel: z.string().trim().min(3).max(80),
    targetLabel: z.string().trim().min(3).max(60),
    callToAction: z.string().trim().min(6).max(140),
    accentMood: z.enum(['Saffron Dusk', 'Midnight Gold', 'Forest Glow']),
  }),
  certificateProfile: z.object({
    achievementLine: z.string().trim().min(12).max(180),
    signatoryName: z.string().trim().min(2).max(60),
    signatoryTitle: z.string().trim().min(2).max(60),
    durationLabel: z.string().trim().min(2).max(24),
    distanceLabel: z.string().trim().min(2).max(24),
  }),
})

const activitySchema = z.object({
  participantId: z.string().trim().min(1),
  source: z.enum(['Manual Upload', 'Imported Activity', 'Pedals Power Tracker', 'External App / Device']),
  activityType: z.enum(activityKinds),
  sourceApp: z.string().trim().max(120).optional().default(''),
  title: z.string().trim().min(3).max(80),
  distanceKm: z.number().positive().max(500),
  durationMinutes: z.number().positive().max(2000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  trackerScreenshotName: z.string().trim().min(3).max(120).optional().default('activity-proof.png'),
  trackerScreenshotDataUrl: z.string().optional().default(''),
  activityPhotoDataUrl: z.string().optional().default(''),
  notes: z.string().trim().max(240).optional().default(''),
})

const posterSchema = z.object({
  participantId: z.string().trim().min(1),
})

const certificateSchema = z.object({
  participantId: z.string().trim().min(1),
})

const activitySelectionSchema = z.object({
  activityId: z.number().int().positive(),
})

function parse(schema, body, res) {
  const result = schema.safeParse(body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0]?.message || 'Invalid request.' })
    return null
  }
  return result.data
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'Pedals Power API' })
})

app.get('/api/dashboard', (_req, res) => {
  getDashboardData(getMessagingStatus()).then((snapshot) => res.json(snapshot))
})

app.get('/api/integrations/shopify/status', (_req, res) => {
  res.json(getShopifyStatus())
})

app.post('/api/registrations', async (req, res) => {
  const payload = parse(registrationSchema, req.body, res)
  if (!payload) return
  const registrationResult = await createRegistration(payload)
  const createdParticipant = registrationResult.participant
  if (!createdParticipant) {
    res.status(500).json({ error: 'Unable to create participant.' })
    return
  }
  const notificationLogs = registrationResult.created ? await sendRegistrationNotifications(createdParticipant) : []
  await Promise.all(
    notificationLogs.map((entry) =>
      addNotificationLog({
        id: `${entry.channel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        participantId: createdParticipant.id,
        ...entry,
      }),
    ),
  )
  res.status(201).json({
    participant: createdParticipant,
    snapshot: await getDashboardData(getMessagingStatus()),
  })
})

app.patch('/api/participants/:id', async (req, res) => {
  const payload = parse(profileSchema, req.body, res)
  if (!payload) return
  const participant = await updateParticipant(req.params.id, payload)
  res.json({
    participant,
    snapshot: await getDashboardData(getMessagingStatus()),
  })
})

app.post('/api/activities', async (req, res) => {
  const payload = parse(activitySchema, req.body, res)
  if (!payload) return
  const activity = await addActivity(payload)
  res.status(201).json({
    activity,
    snapshot: await getDashboardData(getMessagingStatus()),
  })
})

app.post('/api/participants/:id/selected-activity', async (req, res) => {
  const payload = parse(activitySelectionSchema, req.body, res)
  if (!payload) return
  const activity = await selectActivity(req.params.id, payload.activityId)
  res.json({
    activity,
    snapshot: await getDashboardData(getMessagingStatus()),
  })
})

app.post('/api/posters', async (req, res) => {
  const payload = parse(posterSchema, req.body, res)
  if (!payload) return
  const poster = await createPoster(payload)
  if (!poster) {
    res.status(409).json({
      error: 'Select an activity and upload at least one activity proof before generating the poster.',
      snapshot: await getDashboardData(getMessagingStatus()),
    })
    return
  }
  res.status(201).json({
    poster,
    snapshot: await getDashboardData(getMessagingStatus()),
  })
})

app.post('/api/certificates', async (req, res) => {
  const payload = parse(certificateSchema, req.body, res)
  if (!payload) return
  const certificate = await createCertificate(payload.participantId)
  if (!certificate) {
    res.status(409).json({
      error: 'A qualifying selected activity is required before the certificate can be issued.',
      snapshot: await getDashboardData(getMessagingStatus()),
    })
    return
  }
  res.status(201).json({
    certificate,
    snapshot: await getDashboardData(getMessagingStatus()),
  })
})

app.get('/api/assets/:kind/:id/:format', async (req, res) => {
  const asset = await getAsset(req.params.kind, req.params.id, req.params.format)
  if (!asset) {
    res.status(404).json({ error: 'Asset not found.' })
    return
  }
  res.setHeader('Content-Type', asset.contentType)
  res.setHeader('Content-Disposition', `inline; filename="${asset.filename}"`)
  res.send(asset.buffer)
})

app.listen(PORT, () => {
  console.log(`Pedals Power API listening on http://localhost:${PORT}`)
})
