import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { bucket, db, getFirebaseStatus, isFirebaseEnabled } from './firebase.js'

export const brandName = 'Pedals Power'
export const assetTemplateVersion = '2026-07-template-v19'

export const challenge = {
  id: 'PP-ONE-DAY-2026',
  title: 'Pedals Power One-Day Movement Challenge',
  type: 'Single Activity',
  targetKm: 5,
  startDate: '2026-07-01',
  endDate: '2026-07-31',
  shortfallTolerance: 0,
  supportedActivities: ['Cycling', 'Running', 'Walking', 'Swimming', 'Yoga', 'Hiking', 'Gym Workout', 'Other'],
}

const defaultPosterProfile = {
  themeTitle: 'WORLD BICYCLE DAY',
  themeSubtitle: 'VIRTUAL CHALLENGE',
  dateLabel: '1ST JUNE - 7TH JUNE',
  targetLabel: 'TARGET:',
  callToAction: "LET'S PEDAL TOGETHER TOWARDS A FITTER, GREENER TOMORROW!",
  accentMood: 'Midnight Gold',
}

const defaultCertificateProfile = {
  achievementLine: 'For successfully completing World Bicycle Day Virtual Challenge 2026 held on 1st-7th June',
  signatoryName: 'Unique Jain',
  signatoryTitle: 'Founder & CEO',
  durationLabel: 'DURATION',
  distanceLabel: 'DISTANCE',
}

const assets = new Map()
let memoryState = {
  participants: [],
  activities: [],
  registrations: [],
  posterJobs: [],
  certificateJobs: [],
  notifications: [],
}

const collectionNames = {
  participants: 'participants',
  activities: 'activities',
  registrations: 'registrations',
  posterJobs: 'posterJobs',
  certificateJobs: 'certificateJobs',
  notifications: 'notifications',
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const templatesDir = path.resolve(__dirname, '../public/templates')
const templateImageCache = new Map()

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function slug(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatDateLabel(date) {
  const parsed = new Date(`${date}T00:00:00`)
  return parsed
    .toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    .toUpperCase()
}

function formatDuration(minutes) {
  const totalMinutes = Number(minutes) || 0
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0')
  const mins = String(totalMinutes % 60).padStart(2, '0')
  return `${hours}:${mins}:00`
}

function formatShortDateLabel(date) {
  const parsed = new Date(`${date}T00:00:00`)
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function ordinalSuffix(day) {
  if (day >= 11 && day <= 13) return `${day}th`
  const remainder = day % 10
  if (remainder === 1) return `${day}st`
  if (remainder === 2) return `${day}nd`
  if (remainder === 3) return `${day}rd`
  return `${day}th`
}

function formatCertificateDate(date) {
  const parsed = new Date(`${date}T00:00:00`)
  return `${ordinalSuffix(parsed.getDate())} ${parsed.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })}`
}

function formatPosterDate(date) {
  const parsed = new Date(`${date}T00:00:00`)
  return `${ordinalSuffix(parsed.getDate()).toUpperCase()} ${parsed.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  }).toUpperCase()}`
}

function fittedNameSize(name, large = 84, medium = 74, compact = 66) {
  const length = String(name || '').trim().length
  if (length > 24) return compact
  if (length > 18) return medium
  return large
}

function fittedHeadlineSize(text, large = 110, medium = 94, compact = 78) {
  const length = String(text || '').trim().length
  if (length > 16) return compact
  if (length > 10) return medium
  return large
}

function splitPosterName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 2) return [parts.join(' ').toUpperCase()]
  return [
    parts.slice(0, Math.ceil(parts.length / 2)).join(' ').toUpperCase(),
    parts.slice(Math.ceil(parts.length / 2)).join(' ').toUpperCase(),
  ]
}

function splitHeadline(text, maxLineLength = 10) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  if (words.length <= 1) return [words.join(' ').toUpperCase()]
  const lines = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxLineLength || !current) {
      current = next
      continue
    }
    lines.push(current.toUpperCase())
    current = word
  }
  if (current) lines.push(current.toUpperCase())
  return lines.slice(0, 3)
}

function buildCertificateAchievementLine(participant, activity) {
  const activityTitle = String(activity.title || participant.selectedChallenge || 'the challenge').trim()
  return `For successfully completing ${activityTitle} on ${formatCertificateDate(activity.date)}`
}

async function createQrDataUrl(value) {
  return QRCode.toDataURL(value, {
    width: 220,
    margin: 1,
    color: {
      dark: '#09111e',
      light: '#ffffff',
    },
  })
}

function createPngFromSvg(svg) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1400 },
  })
  return resvg.render().asPng()
}

function createSizedPngFromSvg(svg, width) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
  })
  return resvg.render().asPng()
}

async function readTemplateDataUrl(filename) {
  const existing = templateImageCache.get(filename)
  if (existing) return existing

  const fullPath = path.join(templatesDir, filename)
  const buffer = await fs.readFile(fullPath)
  const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`
  templateImageCache.set(filename, dataUrl)
  return dataUrl
}

function createPdfBuffer(lines) {
  return new Promise((resolve) => {
    const chunks = []
    const doc = new PDFDocument({ size: 'A4', margin: 36 })
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))

    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f7f5f1')
    doc.lineWidth(18).strokeColor('#123979').rect(26, 26, doc.page.width - 52, doc.page.height - 52).stroke()
    doc.lineWidth(3).strokeColor('#d7aa44').rect(46, 46, doc.page.width - 92, doc.page.height - 92).stroke()
    doc.lineWidth(1.5).strokeColor('#f0d98f').rect(56, 56, doc.page.width - 112, doc.page.height - 112).stroke()
    doc.fillColor('#123979').fontSize(32).font('Helvetica-Bold').text('CERTIFICATE', 0, 94, { align: 'center' })
    doc.fontSize(16).text('OF ACHIEVEMENT', 0, 134, { align: 'center' })

    let y = 220
    for (const line of lines) {
      doc.fillColor('#2a3a58').fontSize(16).font('Helvetica').text(line, 76, y, { align: 'center' })
      y += 28
    }

    doc.fillColor('#123979').fontSize(12).text('Generated by Pedals Power Firebase-ready MVP.', 0, 720, { align: 'center' })
    doc.end()
  })
}

function createPdfFromPngBuffer(pngBuffer, width, height) {
  return new Promise((resolve) => {
    const chunks = []
    const doc = new PDFDocument({ size: [width, height], margin: 0 })
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.image(pngBuffer, 0, 0, { width, height })
    doc.end()
  })
}

function putAsset({ kind, id, format, buffer, contentType, filename }) {
  assets.set(`${kind}:${id}:${format}`, { buffer, contentType, filename })
}

async function uploadAssetToStorage({ kind, id, format, buffer, contentType, filename }) {
  const storageBucket = bucket()
  if (!storageBucket) return null
  const path = `generated/${kind}/${id}.${format}`
  const file = storageBucket.file(path)
  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      metadata: {
        filename,
      },
    },
  })
  return path
}

async function downloadAssetFromStorage(kind, id, format) {
  const state = await loadState()
  const key = kind === 'poster' ? 'posterJobs' : 'certificateJobs'
  const entry = state[key].find((job) => job.id === id)
  if (!entry?.storagePaths?.[format]) return null
  const storageBucket = bucket()
  if (!storageBucket) return null
  const [buffer] = await storageBucket.file(entry.storagePaths[format]).download()
  return {
    buffer,
    contentType: format === 'pdf' ? 'application/pdf' : 'image/png',
    filename: format === 'pdf' ? `${slug(entry.title || entry.previewTitle || id)}.pdf` : `${slug(entry.title || entry.previewTitle || id)}.png`,
  }
}

export async function getAsset(kind, id, format) {
  const local = assets.get(`${kind}:${id}:${format}`)
  if (local) return local
  if (isFirebaseEnabled()) {
    return downloadAssetFromStorage(kind, id, format)
  }
  return null
}

function inChallengeWindow(date) {
  return date >= challenge.startDate && date <= challenge.endDate
}

function normalizePhone(phone) {
  return String(phone).replace(/[^\d+]/g, '')
}

function defaultPosterProfileFor(participant) {
  return {
    ...defaultPosterProfile,
    dateLabel: defaultPosterProfile.dateLabel,
    targetLabel: defaultPosterProfile.targetLabel,
  }
}

function defaultCertificateProfileFor(participant) {
  return {
    ...defaultCertificateProfile,
    achievementLine: defaultCertificateProfile.achievementLine,
  }
}

function withFixedCertificateSignatory(profile) {
  return {
    ...profile,
    signatoryName: defaultCertificateProfile.signatoryName,
    signatoryTitle: defaultCertificateProfile.signatoryTitle,
  }
}

function sortByDate(items, field) {
  return [...items].sort((a, b) => String(b[field] || '').localeCompare(String(a[field] || '')))
}

async function readCollection(name) {
  const firestore = db()
  if (!firestore) {
    return structuredClone(memoryState[name])
  }

  const snapshot = await firestore.collection(collectionNames[name]).get()
  return snapshot.docs.map((doc) => doc.data())
}

async function writeDocument(name, id, data) {
  const firestore = db()
  if (!firestore) {
    const list = memoryState[name]
    const index = list.findIndex((entry) => String(entry.id) === String(id))
    if (index >= 0) {
      list[index] = structuredClone(data)
    } else {
      list.unshift(structuredClone(data))
    }
    return
  }

  await firestore.collection(collectionNames[name]).doc(String(id)).set(JSON.parse(JSON.stringify(data)))
}

async function writeManyDocuments(name, items) {
  const firestore = db()
  if (!firestore) {
    memoryState[name] = structuredClone(items)
    return
  }

  const batch = firestore.batch()
  const collection = firestore.collection(collectionNames[name])
  items.forEach((item) => {
    batch.set(collection.doc(String(item.id)), JSON.parse(JSON.stringify(item)))
  })
  await batch.commit()
}

async function loadState() {
  const participants = await readCollection('participants')
  const activities = await readCollection('activities')
  const registrations = await readCollection('registrations')
  const posterJobs = await readCollection('posterJobs')
  const certificateJobs = await readCollection('certificateJobs')
  const notifications = await readCollection('notifications')

  return {
    participants,
    activities,
    registrations,
    posterJobs: sortByDate(posterJobs, 'createdAt'),
    certificateJobs: sortByDate(certificateJobs, 'issuedOn'),
    notifications: sortByDate(notifications, 'sentAt'),
  }
}

function participantActivities(state, participantId) {
  return state.activities.filter((activity) => activity.participantId === participantId)
}

function latestParticipantActivity(state, participantId) {
  return participantActivities(state, participantId)
    .slice()
    .sort((a, b) => Number(b.id) - Number(a.id))[0] ?? null
}

function computeParticipantState(participant, selectedActivity) {
  if (!selectedActivity) {
    return {
      ...participant,
      status: participant.status === 'Registered' ? 'Registered' : 'Ready to Finish',
      certificateReady: false,
      selectedActivityId: null,
      progressLabel: `Waiting for a selected ${participant.selectedChallenge.toLowerCase()} activity`,
      validationTitle: 'Select one submitted activity',
      validationDetail: 'Choose the proof entry that should be used for the certificate and poster output.',
    }
  }

  if (selectedActivity.qualifies) {
    return {
      ...participant,
      status: 'Completed',
      certificateReady: true,
      selectedActivityId: selectedActivity.id,
      progressLabel: `${selectedActivity.distanceKm.toFixed(1)} km ${selectedActivity.activityType.toLowerCase()} proof selected`,
      validationTitle: 'Submission validated',
      validationDetail: `${selectedActivity.title} is within the challenge window and can be used for final assets.`,
    }
  }

  return {
    ...participant,
    status: 'Ready to Finish',
    certificateReady: false,
    selectedActivityId: selectedActivity.id,
    progressLabel: `${selectedActivity.distanceKm.toFixed(1)} km ${selectedActivity.activityType.toLowerCase()} proof selected`,
    validationTitle: 'Submission needs review',
    validationDetail: `The chosen activity is below the required ${challenge.targetKm} km distance.`,
  }
}

async function refreshParticipant(participantId) {
  const state = await loadState()
  const participant = state.participants.find((entry) => entry.id === participantId)
  if (!participant) return null
  const selected = participantActivities(state, participantId).find((activity) => activity.selected) ?? latestParticipantActivity(state, participantId)
  const nextParticipant = computeParticipantState(participant, selected)
  await writeDocument('participants', nextParticipant.id, nextParticipant)
  return nextParticipant
}

function makePosterSvg(participant, activity) {
  const accent = {
    'Saffron Dusk': ['#23492f', '#d99835'],
    'Midnight Gold': ['#0e274f', '#ec9c2d'],
    'Forest Glow': ['#263f27', '#c59b44'],
  }[participant.posterProfile.accentMood]

  const [deep, glow] = accent
  const mainImage = activity?.activityPhotoDataUrl || participant.photoDataUrl || ''
  const trackerImage = activity?.trackerScreenshotDataUrl || ''
  const challengeLine = `${participant.selectedChallenge.toUpperCase()} · ${activity ? activity.distanceKm.toFixed(1) : challenge.targetKm} KM`
  const dateLine = esc(participant.posterProfile.dateLabel || formatDateLabel(activity?.date || participant.plannedActivityDate || challenge.startDate))
  const bigDistance = `${activity ? activity.distanceKm.toFixed(1) : challenge.targetKm} KM`
  const callToAction = esc(participant.posterProfile.callToAction || 'LET US MOVE TOGETHER TOWARDS A STRONGER TOMORROW!')
  const headlineTop = esc(participant.posterProfile.themeTitle || 'PEDALS POWER')
  const headlineBottom = esc(participant.posterProfile.themeSubtitle || 'ONE-DAY MOVEMENT CHALLENGE')

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${deep}"/>
          <stop offset="62%" stop-color="#08162c"/>
          <stop offset="100%" stop-color="#13253e"/>
        </linearGradient>
        <radialGradient id="sunset" cx="88%" cy="30%" r="34%">
          <stop offset="0%" stop-color="#ffd991" stop-opacity="0.98"/>
          <stop offset="58%" stop-color="#f9b04f" stop-opacity="0.24"/>
          <stop offset="100%" stop-color="#f9b04f" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="panelGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f8cf86"/>
          <stop offset="100%" stop-color="${glow}"/>
        </linearGradient>
        <linearGradient id="plateBlue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#113a85"/>
          <stop offset="100%" stop-color="#224f98"/>
        </linearGradient>
        <linearGradient id="targetPlate" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(19,35,68,0.96)"/>
          <stop offset="100%" stop-color="rgba(34,52,90,0.96)"/>
        </linearGradient>
        <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000000" flood-opacity="0.34"/>
        </filter>
        <clipPath id="mainPhotoClip">
          <rect x="654" y="158" width="332" height="902" rx="28"/>
        </clipPath>
      </defs>
      <rect width="1080" height="1350" fill="url(#bg)"/>
      <rect width="1080" height="1350" fill="url(#sunset)"/>
      <path d="M0 1184 C178 968 420 864 1080 654 L1080 1350 L0 1350 Z" fill="rgba(7,11,18,0.72)"/>
      <path d="M690 1212 C826 898 926 744 1080 618 L1080 1350 L652 1350 Z" fill="rgba(241,160,58,0.3)"/>
      <rect x="34" y="34" width="1012" height="1282" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3"/>
      ${mainImage ? `<image href="${mainImage}" x="654" y="158" width="332" height="902" preserveAspectRatio="xMidYMid slice" clip-path="url(#mainPhotoClip)"/>` : ''}

      <text x="92" y="130" font-family="Arial" font-size="24" letter-spacing="16" fill="#f3e8d8">${headlineTop}</text>
      <text x="92" y="260" font-family="Arial" font-size="136" font-weight="900" fill="#f7f4ee">${esc(participant.selectedChallenge.toUpperCase())}</text>
      <text x="92" y="346" font-family="Arial" font-size="54" font-weight="800" letter-spacing="5" fill="${glow}">${headlineBottom}</text>
      <line x1="92" y1="390" x2="286" y2="390" stroke="#2f95ff" stroke-width="4"/>
      <line x1="450" y1="390" x2="612" y2="390" stroke="#2f95ff" stroke-width="4"/>
      <text x="314" y="401" font-family="Arial" font-size="42" font-weight="700" fill="#f3eee4">${dateLine}</text>

      <circle cx="936" cy="110" r="74" fill="#ffffff"/>
      <path d="M894 66 L956 66 L992 110 M984 188 L924 188 L890 144" stroke="#111111" stroke-width="8" fill="none"/>
      <rect x="890" y="108" width="92" height="20" fill="#111111"/>
      <rect x="904" y="116" width="64" height="4" fill="#ffffff"/>

      <g filter="url(#shadow)">
        <circle cx="232" cy="668" r="150" fill="#8d6a2d" stroke="#e2ba63" stroke-width="12"/>
        <circle cx="232" cy="668" r="116" fill="#2b2115" stroke="#b28740" stroke-width="7"/>
        <circle cx="232" cy="668" r="68" fill="#7b5928"/>
        <text x="232" y="596" text-anchor="middle" font-family="Arial" font-size="23" font-weight="700" fill="#f8e9c6">${esc(participant.selectedChallenge.toUpperCase())}</text>
        <text x="232" y="686" text-anchor="middle" font-family="Arial" font-size="68" font-weight="900" fill="#fff6e0">FINISHER</text>
        <text x="232" y="736" text-anchor="middle" font-family="Arial" font-size="24" fill="#f8e9c6">${esc(activity ? formatDateLabel(activity.date) : participant.posterProfile.dateLabel)}</text>
      </g>

      <g transform="translate(454 824) rotate(-7)" filter="url(#shadow)">
        <rect width="304" height="112" rx="12" fill="url(#plateBlue)" stroke="#d49f3f" stroke-width="3"/>
        <text x="152" y="42" text-anchor="middle" font-family="Georgia" font-size="24" fill="#ffffff">${esc(participant.name.split(' ').slice(0, 2).join(' ').toUpperCase())}</text>
        <text x="152" y="76" text-anchor="middle" font-family="Georgia" font-size="24" fill="#ffffff">${esc(participant.name.split(' ').slice(2).join(' ').toUpperCase() || challengeLine)}</text>
        <text x="152" y="100" text-anchor="middle" font-family="Arial" font-size="17" fill="#ffcf6a">${esc(challengeLine)}</text>
      </g>

      <g transform="translate(430 930) rotate(5)" filter="url(#shadow)">
        <rect width="326" height="196" rx="14" fill="url(#targetPlate)" stroke="#d39d3a" stroke-width="3"/>
        <text x="163" y="48" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="#f3c56b">${esc(participant.posterProfile.targetLabel)}</text>
        <text x="163" y="126" text-anchor="middle" font-family="Arial" font-size="88" font-weight="900" fill="#ffffff">${bigDistance}</text>
        <rect x="100" y="144" width="126" height="30" rx="8" fill="${glow}"/>
        <text x="163" y="165" text-anchor="middle" font-family="Arial" font-size="18" font-weight="800" fill="#14223b">${esc(participant.selectedChallenge.toUpperCase())}</text>
      </g>

      ${trackerImage ? `<rect x="818" y="980" width="164" height="164" fill="#fffef9" rx="10"/><image href="${trackerImage}" x="828" y="990" width="144" height="144" preserveAspectRatio="xMidYMid slice"/>` : `<rect x="818" y="980" width="164" height="164" fill="#fffef9" rx="10"/><text x="900" y="1062" text-anchor="middle" font-family="Arial" font-size="18" fill="#20334f">TRACKER</text><text x="900" y="1090" text-anchor="middle" font-family="Arial" font-size="18" fill="#20334f">SNAPSHOT</text>`}
      <rect x="792" y="1156" width="214" height="50" rx="10" fill="${glow}"/>
      <text x="899" y="1189" text-anchor="middle" font-family="Arial" font-size="23" font-weight="800" fill="#162237">SCAN TO REGISTER</text>

      <text x="92" y="1054" font-family="Arial" font-size="86" font-weight="900" fill="#ffffff">JOIN ME</text>
      <text x="94" y="1106" font-family="Arial" font-size="22" font-style="italic" fill="#f6eee3">${callToAction}</text>
      <text x="94" y="1174" font-family="Arial" font-size="24" fill="${glow}">${esc(participant.phone)}</text>
      <text x="318" y="1174" font-family="Arial" font-size="24" fill="#f5efe6">${esc(participant.socials.website || 'www.yoursite.com')}</text>
      <text x="94" y="1236" font-family="Arial" font-size="22" fill="#f5efe6">${esc(participant.socials.instagram || '@yourhandle')}</text>
      <text x="302" y="1236" font-family="Arial" font-size="22" fill="#f5efe6">${esc(participant.socials.facebook || 'facebook.com/yourpage')}</text>
    </svg>
  `
}


function makeCertificateSvg(participant, activity) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="990" viewBox="0 0 1400 990">
      <defs>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff5d3"/>
          <stop offset="36%" stop-color="#cb9838"/>
          <stop offset="72%" stop-color="#fff6da"/>
          <stop offset="100%" stop-color="#ae7420"/>
        </linearGradient>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="1400" height="990" fill="#fefdfb"/>
      <rect x="30" y="30" width="1340" height="930" fill="none" stroke="#143979" stroke-width="54"/>
      <rect x="80" y="80" width="1240" height="830" fill="none" stroke="url(#gold)" stroke-width="6"/>
      <rect x="92" y="92" width="1216" height="806" fill="none" stroke="#edd98f" stroke-width="2"/>
      <path d="M34 34 L244 34 L100 176 L34 340 Z" fill="#0e2f69"/>
      <path d="M34 34 L208 34 L84 148 Z" fill="url(#gold)"/>
      <ellipse cx="102" cy="122" rx="16" ry="54" transform="rotate(34 102 122)" fill="#fff7df" filter="url(#glow)"/>
      <path d="M1368 780 L1248 780 L1368 644 Z" fill="#0e2f69"/>
      <path d="M1368 960 L1156 960 L1368 756 Z" fill="#0e2f69"/>
      <path d="M1368 960 L1212 960 L1368 826 Z" fill="url(#gold)"/>
      <ellipse cx="1284" cy="874" rx="18" ry="60" transform="rotate(38 1284 874)" fill="#fff7df" filter="url(#glow)"/>

      <text x="700" y="184" text-anchor="middle" font-family="Arial" font-size="96" font-weight="900" fill="#143979">CERTIFICATE</text>
      <text x="700" y="244" text-anchor="middle" font-family="Arial" font-size="42" font-weight="700" fill="#143979">OF ACHIEVEMENT</text>

      <circle cx="1136" cy="166" r="82" fill="#ffffff"/>
      <path d="M1092 116 L1152 116 L1188 160 M1178 248 L1122 248 L1086 204" stroke="#111111" stroke-width="8" fill="none"/>
      <rect x="1100" y="160" width="74" height="16" fill="#111111"/>
      <text x="1137" y="172" text-anchor="middle" font-family="Arial" font-size="11" letter-spacing="2" fill="#ffffff">PEDALS POWER</text>

      <text x="700" y="350" text-anchor="middle" font-family="Arial" font-size="28" fill="#3a4f76">This Certificate Is Given To</text>
      <text x="700" y="474" text-anchor="middle" font-family="Georgia" font-size="84" font-weight="700" fill="#173a73">${esc(participant.name.toUpperCase())}</text>
      <text x="700" y="548" text-anchor="middle" font-family="Arial" font-size="24" fill="#233752">${esc(participant.certificateProfile.achievementLine)}</text>
      <text x="700" y="586" text-anchor="middle" font-family="Arial" font-size="24" fill="#233752">${esc(participant.selectedChallenge)} submission dated ${esc(formatDateLabel(activity.date))}</text>

      <g transform="translate(250 688)">
        <text x="126" y="0" text-anchor="middle" font-family="Georgia" font-size="40" fill="#173a73">${esc(formatDuration(activity.durationMinutes))}</text>
        <line x1="0" y1="16" x2="252" y2="16" stroke="#173a73" stroke-width="3"/>
        <text x="126" y="62" text-anchor="middle" font-family="Arial" font-size="30" font-weight="900" fill="#111111">${esc(participant.certificateProfile.durationLabel)}</text>
      </g>

      <g transform="translate(898 688)">
        <text x="126" y="0" text-anchor="middle" font-family="Georgia" font-size="40" fill="#173a73">${esc(activity.distanceKm.toFixed(2))} KM</text>
        <line x1="0" y1="16" x2="252" y2="16" stroke="#173a73" stroke-width="3"/>
        <text x="126" y="62" text-anchor="middle" font-family="Arial" font-size="30" font-weight="900" fill="#111111">${esc(participant.certificateProfile.distanceLabel)}</text>
      </g>

      <path d="M702 690 C654 726 644 770 650 808 C684 780 716 744 742 694" fill="none" stroke="#173a73" stroke-width="4"/>
      <text x="700" y="814" text-anchor="middle" font-family="Brush Script MT, cursive" font-size="56" fill="#163977">${esc(participant.certificateProfile.signatoryName)}</text>
      <line x1="558" y1="826" x2="842" y2="826" stroke="#111111" stroke-width="2"/>
      <text x="700" y="868" text-anchor="middle" font-family="Arial" font-size="24" font-weight="900" fill="#111111">${esc(participant.certificateProfile.signatoryName.toUpperCase())}</text>
      <text x="700" y="902" text-anchor="middle" font-family="Arial" font-size="22" fill="#233752">${esc(participant.certificateProfile.signatoryTitle)}</text>
    </svg>
  `
}

async function makePosterSvgReference(participant, activity) {
  const medalAsset = await readTemplateDataUrl('poster-medal-clean.png')
  const accent = {
    'Saffron Dusk': ['#23492f', '#d99835'],
    'Midnight Gold': ['#0e274f', '#ec9c2d'],
    'Forest Glow': ['#263f27', '#c59b44'],
  }[participant.posterProfile.accentMood]

  const [deep, glow] = accent
  const mainImage = activity?.activityPhotoDataUrl || participant.photoDataUrl || ''
  const headlineLines = splitHeadline(activity.title || participant.selectedChallenge)
  const headlineTop = headlineLines[0] || participant.selectedChallenge.toUpperCase()
  const headlineMiddle = headlineLines[1] || ''
  const headlineBottom = headlineLines[2] || ''
  const headlineTopSize = fittedHeadlineSize(headlineTop, 102, 84, 68)
  const headlineMiddleSize = fittedHeadlineSize(headlineMiddle, 98, 82, 66)
  const headlineBottomSize = fittedHeadlineSize(headlineBottom, 92, 78, 62)
  const titleBlockOffset = headlineBottom ? 64 : 0
  const medalOffset = headlineBottom ? 76 : 0
  const dateLine = esc(formatPosterDate(activity.date))
  const bigDistance = `${activity ? activity.distanceKm.toFixed(1) : challenge.targetKm} KM`
  const callToAction = esc(participant.posterProfile.callToAction || defaultPosterProfile.callToAction)
  const nameLines = splitPosterName(participant.name)
  const rideDate = esc(formatShortDateLabel(activity.date))
  const phone = '8076388960'
  const website = 'www.pedalspower.com'
  const challengeLabel = esc(`${participant.selectedChallenge.toUpperCase()} CHALLENGE`)
  const medalDate = esc(formatCertificateDate(activity.date))
  const qrValue = participant.socials.website
    || participant.socials.instagram
    || participant.socials.strava
    || `https://42hy.shop/register/${slug(participant.registrationId || participant.id)}`
  const qrCodeDataUrl = await createQrDataUrl(qrValue)

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1350" viewBox="0 0 1240 1350">
      <defs>
        <linearGradient id="bg2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${deep}"/>
          <stop offset="62%" stop-color="#08162c"/>
          <stop offset="100%" stop-color="#13253e"/>
        </linearGradient>
        <radialGradient id="sunset2" cx="87%" cy="30%" r="42%">
          <stop offset="0%" stop-color="#ffd991" stop-opacity="0.98"/>
          <stop offset="58%" stop-color="#f9b04f" stop-opacity="0.34"/>
          <stop offset="100%" stop-color="#f9b04f" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="namePlate2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0b2f69"/>
          <stop offset="100%" stop-color="#264c8f"/>
        </linearGradient>
        <linearGradient id="targetPlate2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(19,35,68,0.96)"/>
          <stop offset="100%" stop-color="rgba(34,52,90,0.96)"/>
        </linearGradient>
        <linearGradient id="bottomBand2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#091829"/>
          <stop offset="100%" stop-color="#112743"/>
        </linearGradient>
        <filter id="shadow2" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000000" flood-opacity="0.34"/>
        </filter>
        <clipPath id="mainPhotoClip2">
          <path d="M651 182 H1124 V1118 H816 C732 1118 680 1092 656 1030 C638 983 637 901 637 812 V240 C637 207 646 191 651 182 Z"/>
        </clipPath>
        <clipPath id="posterFrame2">
          <rect x="28" y="28" width="1184" height="1294" rx="18"/>
        </clipPath>
        <clipPath id="medalFullClip2">
          <rect x="44" y="${418 + medalOffset}" width="468" height="468"/>
        </clipPath>
        <radialGradient id="medalBlend2" cx="50%" cy="48%" r="58%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
          <stop offset="64%" stop-color="#ffffff" stop-opacity="1"/>
          <stop offset="86%" stop-color="#ffffff" stop-opacity="0.78"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
        <mask id="medalSoftMask2">
          <rect x="44" y="${418 + medalOffset}" width="468" height="468" fill="url(#medalBlend2)"/>
        </mask>
      </defs>
      <rect width="1240" height="1350" fill="url(#bg2)" clip-path="url(#posterFrame2)"/>
      <rect width="1240" height="1350" fill="url(#sunset2)" clip-path="url(#posterFrame2)"/>
      <path d="M0 1088 C210 992 430 940 690 902 C890 872 1050 820 1240 716 L1240 1350 L0 1350 Z" fill="rgba(9,13,20,0.78)"/>
      <path d="M700 1180 C856 904 1000 730 1240 610 L1240 1350 L736 1350 Z" fill="rgba(244,150,45,0.34)"/>
      <path d="M0 1242 C184 1248 328 1222 548 1172 C820 1110 1020 1096 1240 1110 L1240 1350 L0 1350 Z" fill="#0b2749"/>
      ${mainImage ? `<image href="${mainImage}" x="636" y="146" width="494" height="978" preserveAspectRatio="xMidYMid slice" clip-path="url(#mainPhotoClip2)"/>` : ''}

      <text x="74" y="150" font-family="Arial Black, Arial" font-size="${headlineTopSize}" font-weight="900" fill="#f4f2ed">${esc(headlineTop)}</text>
      ${headlineMiddle ? `<text x="74" y="248" font-family="Arial Black, Arial" font-size="${headlineMiddleSize}" font-weight="900" fill="#1180ff">${esc(headlineMiddle)}</text>` : ''}
      ${headlineBottom ? `<text x="74" y="332" font-family="Arial Black, Arial" font-size="${headlineBottomSize}" font-weight="900" fill="#1180ff">${esc(headlineBottom)}</text>` : ''}
      <text x="76" y="${332 + titleBlockOffset}" font-family="Arial" font-size="38" font-weight="800" letter-spacing="4" fill="${glow}">${challengeLabel}</text>
      <line x1="92" y1="${384 + titleBlockOffset}" x2="214" y2="${384 + titleBlockOffset}" stroke="#1da3ff" stroke-width="4"/>
      <line x1="406" y1="${384 + titleBlockOffset}" x2="528" y2="${384 + titleBlockOffset}" stroke="#1da3ff" stroke-width="4"/>
      <text x="310" y="${396 + titleBlockOffset}" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="#f3eee4">${dateLine}</text>

      <g transform="translate(980 40)">
        <circle cx="72" cy="72" r="72" fill="#ffffff"/>
        <path d="M28 72 L86 22 L86 54" stroke="#111111" stroke-width="8" fill="none" stroke-linecap="square" stroke-linejoin="miter"/>
        <path d="M116 72 H26" stroke="#111111" stroke-width="8" fill="none" stroke-linecap="square"/>
        <path d="M116 72 L58 122 L58 90" stroke="#111111" stroke-width="8" fill="none" stroke-linecap="square" stroke-linejoin="miter"/>
        <rect x="30" y="64" width="86" height="18" fill="#111111"/>
        <rect x="41" y="70" width="64" height="3" fill="#ffffff"/>
        <text x="73" y="79" text-anchor="middle" font-family="Arial" font-size="7" font-weight="700" letter-spacing="1.2" fill="#ffffff">PEDALS POWER</text>
      </g>

      <g filter="url(#shadow2)">
        <image href="${medalAsset}" x="44" y="${418 + medalOffset}" width="468" height="468" preserveAspectRatio="xMidYMax slice" clip-path="url(#medalFullClip2)" mask="url(#medalSoftMask2)"/>
        <text x="278" y="${856 + medalOffset}" text-anchor="middle" font-family="Georgia" font-size="17" font-style="italic" font-weight="700" fill="#4f3518">${medalDate}</text>
      </g>

      <g transform="translate(604 760) rotate(-7)" filter="url(#shadow2)">
        <rect width="300" height="116" rx="10" fill="url(#namePlate2)" stroke="#d49f3f" stroke-width="3"/>
        <text x="150" y="46" text-anchor="middle" font-family="Georgia" font-size="21" font-weight="700" fill="#ffffff">${esc(nameLines[0] || '')}</text>
        ${nameLines[1] ? `<text x="150" y="80" text-anchor="middle" font-family="Georgia" font-size="21" font-weight="700" fill="#ffffff">${esc(nameLines[1])}</text>` : ''}
      </g>

      <g transform="translate(608 860) rotate(5)" filter="url(#shadow2)">
        <rect width="266" height="164" rx="14" fill="url(#targetPlate2)" stroke="#d39d3a" stroke-width="3"/>
        <text x="30" y="44" font-family="Arial" font-size="22" font-weight="700" fill="#f3c56b">TARGET:</text>
        <text x="133" y="106" text-anchor="middle" font-family="Arial Black, Arial" font-size="58" font-weight="900" fill="#ffffff">${bigDistance}</text>
        <text x="34" y="136" font-family="Arial" font-size="17" fill="#ffdf95">Ride Date</text>
        <text x="34" y="156" font-family="Arial" font-size="18" font-weight="700" fill="#ffffff">${rideDate}</text>
      </g>

      <rect x="898" y="966" width="136" height="136" fill="#ffffff" rx="8"/>
      <image href="${qrCodeDataUrl}" x="908" y="976" width="116" height="116" preserveAspectRatio="xMidYMid meet"/>
      <rect x="868" y="1112" width="222" height="48" rx="10" fill="${glow}"/>
      <text x="979" y="1145" text-anchor="middle" font-family="Arial" font-size="20" font-weight="900" fill="#162237">SCAN TO REGISTER</text>

      <text x="82" y="1028" font-family="Arial Black, Arial" font-size="74" font-style="italic" font-weight="900" fill="#ffffff">JOIN ME</text>
      <text x="92" y="1072" font-family="Arial" font-size="15" font-style="italic" fill="#f6eee3">${callToAction}</text>
      <circle cx="108" cy="1102" r="15" fill="${glow}"/>
      <path d="M101 1096c7 14 13 16 22 7" stroke="#10213a" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M101 1096l5-4 5 10-4 3" fill="#10213a"/>
      <text x="134" y="1108" font-family="Arial" font-size="18" font-weight="700" fill="${glow}">${phone}</text>
      <circle cx="304" cy="1102" r="15" fill="${glow}"/>
      <rect x="294" y="1094" width="20" height="16" rx="2" fill="none" stroke="#10213a" stroke-width="3"/>
      <path d="M295 1096l9 8 9-8" stroke="#10213a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="330" y="1108" font-family="Arial" font-size="18" fill="#f5efe6">${website}</text>

      <rect x="0" y="1220" width="1240" height="130" fill="url(#bottomBand2)"/>
      <g font-family="Arial">
        <circle cx="112" cy="1286" r="28" fill="none" stroke="#0a89ff" stroke-width="4"/>
        <path d="M95 1286h34" stroke="#0a89ff" stroke-width="4"/><circle cx="102" cy="1298" r="8" fill="none" stroke="#0a89ff" stroke-width="3"/><circle cx="122" cy="1298" r="8" fill="none" stroke="#0a89ff" stroke-width="3"/>
        <text x="168" y="1282" font-size="16" fill="#f3eee4">ANYTIME</text><text x="168" y="1308" font-size="16" fill="#f3eee4">ANYWHERE</text>
        <line x1="304" y1="1248" x2="304" y2="1320" stroke="rgba(255,140,42,0.35)" stroke-width="2"/>
        <circle cx="378" cy="1286" r="28" fill="none" stroke="#0a89ff" stroke-width="4"/>
        <path d="M378 1268l0 18 14 10" stroke="#0a89ff" stroke-width="4" fill="none" stroke-linecap="round"/>
        <text x="432" y="1282" font-size="16" fill="#f3eee4">RIDE YOUR</text><text x="432" y="1308" font-size="16" fill="#f3eee4">OWN ROUTE</text>
        <line x1="604" y1="1248" x2="604" y2="1320" stroke="rgba(255,140,42,0.35)" stroke-width="2"/>
        <circle cx="680" cy="1286" r="28" fill="none" stroke="#0a89ff" stroke-width="4"/>
        <path d="M668 1290l10 10 16-20" stroke="#0a89ff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="734" y="1282" font-size="16" fill="#f3eee4">EARN EXCLUSIVE</text><text x="734" y="1308" font-size="16" fill="#f3eee4">FINISHER MEDAL</text>
        <line x1="944" y1="1248" x2="944" y2="1320" stroke="rgba(255,140,42,0.35)" stroke-width="2"/>
        <circle cx="1010" cy="1286" r="28" fill="none" stroke="#0a89ff" stroke-width="4"/>
        <circle cx="1002" cy="1282" r="5" fill="#0a89ff"/><circle cx="1018" cy="1282" r="5" fill="#0a89ff"/><circle cx="1010" cy="1294" r="5" fill="#0a89ff"/>
        <text x="1062" y="1274" font-size="14" fill="#f3eee4">BE PART OF</text><text x="1062" y="1296" font-size="14" fill="#f3eee4">A GLOBAL CYCLING</text><text x="1062" y="1318" font-size="14" fill="#f3eee4">COMMUNITY</text>
      </g>
      <rect x="16" y="16" width="1208" height="1318" fill="none" stroke="#ffffff" stroke-width="4"/>
    </svg>
  `
}

function makeCertificateSvgReference(participant, activity) {
  const dynamicNameSize = fittedNameSize(participant.name)
  const dynamicDuration = formatDuration(activity.durationMinutes)
  const dynamicDistance = `${activity.distanceKm.toFixed(2)} KM`

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="990" viewBox="0 0 1400 990">
      <defs>
        <linearGradient id="goldRef" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff5d3"/>
          <stop offset="36%" stop-color="#cb9838"/>
          <stop offset="72%" stop-color="#fff6da"/>
          <stop offset="100%" stop-color="#ae7420"/>
        </linearGradient>
        <filter id="glowRef" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1400" height="990" fill="#fefdfb"/>
      <rect x="30" y="30" width="1340" height="930" fill="none" stroke="#143979" stroke-width="54"/>
      <rect x="80" y="80" width="1240" height="830" fill="none" stroke="url(#goldRef)" stroke-width="6"/>
      <rect x="92" y="92" width="1216" height="806" fill="none" stroke="#edd98f" stroke-width="2"/>
      <path d="M34 34 L244 34 L100 176 L34 340 Z" fill="#0e2f69"/>
      <path d="M34 34 L208 34 L84 148 Z" fill="url(#goldRef)"/>
      <ellipse cx="102" cy="122" rx="16" ry="54" transform="rotate(34 102 122)" fill="#fff7df" filter="url(#glowRef)"/>
      <path d="M1368 780 L1248 780 L1368 644 Z" fill="#0e2f69"/>
      <path d="M1368 960 L1156 960 L1368 756 Z" fill="#0e2f69"/>
      <path d="M1368 960 L1212 960 L1368 826 Z" fill="url(#goldRef)"/>
      <ellipse cx="1284" cy="874" rx="18" ry="60" transform="rotate(38 1284 874)" fill="#fff7df" filter="url(#glowRef)"/>

      <text x="700" y="184" text-anchor="middle" font-family="Arial" font-size="96" font-weight="900" fill="#143979">CERTIFICATE</text>
      <text x="700" y="244" text-anchor="middle" font-family="Arial" font-size="42" font-weight="700" fill="#143979">OF ACHIEVEMENT</text>

      <circle cx="1136" cy="166" r="82" fill="#ffffff"/>
      <path d="M1092 116 L1152 116 L1188 160 M1178 248 L1122 248 L1086 204" stroke="#111111" stroke-width="8" fill="none"/>
      <rect x="1090" y="156" width="92" height="20" fill="#111111"/>
      <rect x="1104" y="164" width="64" height="4" fill="#ffffff"/>

      <text x="700" y="350" text-anchor="middle" font-family="Arial" font-size="28" fill="#3a4f76">This Certificate Is Given To</text>
      <text x="700" y="474" text-anchor="middle" font-family="Georgia" font-size="${dynamicNameSize}" font-weight="700" fill="#173a73">${esc(participant.name.toUpperCase())}</text>
      <text x="700" y="548" text-anchor="middle" font-family="Arial" font-size="24" fill="#233752">${esc(participant.certificateProfile.achievementLine)}</text>
      <text x="700" y="586" text-anchor="middle" font-family="Arial" font-size="24" fill="#233752">${esc(formatShortDateLabel(activity.date))}</text>

      <g transform="translate(250 688)">
        <text x="126" y="0" text-anchor="middle" font-family="Georgia" font-size="40" fill="#173a73">${esc(dynamicDuration)}</text>
        <line x1="0" y1="16" x2="252" y2="16" stroke="#173a73" stroke-width="3"/>
        <text x="126" y="62" text-anchor="middle" font-family="Arial" font-size="30" font-weight="900" fill="#111111">${esc(participant.certificateProfile.durationLabel)}</text>
      </g>

      <g transform="translate(898 688)">
        <text x="126" y="0" text-anchor="middle" font-family="Georgia" font-size="40" fill="#173a73">${esc(dynamicDistance)}</text>
        <line x1="0" y1="16" x2="252" y2="16" stroke="#173a73" stroke-width="3"/>
        <text x="126" y="62" text-anchor="middle" font-family="Arial" font-size="30" font-weight="900" fill="#111111">${esc(participant.certificateProfile.distanceLabel)}</text>
      </g>

      <path d="M702 690 C654 726 644 770 650 808 C684 780 716 744 742 694" fill="none" stroke="#173a73" stroke-width="4"/>
      <text x="700" y="814" text-anchor="middle" font-family="Brush Script MT, cursive" font-size="56" fill="#163977">${esc(participant.certificateProfile.signatoryName)}</text>
      <line x1="558" y1="826" x2="842" y2="826" stroke="#111111" stroke-width="2"/>
      <text x="700" y="868" text-anchor="middle" font-family="Arial" font-size="24" font-weight="900" fill="#111111">${esc(participant.certificateProfile.signatoryName.toUpperCase())}</text>
      <text x="700" y="902" text-anchor="middle" font-family="Arial" font-size="22" fill="#233752">${esc(participant.certificateProfile.signatoryTitle)}</text>
    </svg>
  `
}

async function makeCertificateSvgTemplate(participant, activity) {
  const template = await readTemplateDataUrl('certificate-template.png')
  const dynamicNameSize = fittedNameSize(participant.name, 58, 52, 46)
  const dynamicDuration = formatDuration(activity.durationMinutes)
  const dynamicDistance = `${activity.distanceKm.toFixed(2)} KM`
  const achievementLine = buildCertificateAchievementLine(participant, activity)

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1167" height="822" viewBox="0 0 1167 822">
      <image href="${template}" x="0" y="0" width="1167" height="822"/>

      <rect x="232" y="320" width="710" height="110" fill="#ffffff"/>
      <text x="585" y="402" text-anchor="middle" font-family="Georgia" font-size="${dynamicNameSize}" font-weight="700" fill="#163977">${esc(participant.name.toUpperCase())}</text>

      <rect x="170" y="436" width="830" height="78" fill="#ffffff"/>
      <text x="585" y="478" text-anchor="middle" font-family="Arial" font-size="20" fill="#233752">${esc(achievementLine)}</text>

      <rect x="194" y="510" width="210" height="64" fill="#ffffff"/>
      <text x="299" y="561" text-anchor="middle" font-family="Georgia" font-size="28" fill="#163977">${esc(dynamicDuration)}</text>

      <rect x="754" y="510" width="198" height="64" fill="#ffffff"/>
      <text x="852" y="561" text-anchor="middle" font-family="Georgia" font-size="28" fill="#163977">${esc(dynamicDistance)}</text>
    </svg>
  `
}

async function makePosterSvgTemplate(participant, activity) {
  const template = await readTemplateDataUrl('poster-template.png')
  const qrValue = participant.socials.website
    || participant.socials.instagram
    || participant.socials.strava
    || `https://42hy.shop/register/${slug(participant.registrationId || participant.id)}`
  const qrCodeDataUrl = await createQrDataUrl(qrValue)
  const photo = activity.activityPhotoDataUrl || participant.photoDataUrl || ''
  const [nameLineOne, nameLineTwo] = splitPosterName(participant.name)
  const [headlineTop, headlineBottom] = splitHeadline(activity.title || participant.selectedChallenge)
  const distance = `${activity.distanceKm.toFixed(1)} KM`
  const rideDate = esc(formatShortDateLabel(activity.date))
  const posterDate = esc(formatPosterDate(activity.date))
  const phone = esc(participant.phone || 'Not provided')
  const email = esc(participant.email || participant.socials.website || '42hy.shop')
  const medalDate = esc(formatCertificateDate(activity.date))
  const challengeLine = esc(`${participant.selectedChallenge.toUpperCase()} CHALLENGE`)

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="875" height="862" viewBox="0 0 875 862">
      <defs>
        <clipPath id="riderClip">
          <path d="M548 94 C614 84 710 86 814 108 L828 196 L828 704 L790 728 L706 720 L662 672 L648 628 L628 602 L602 598 L582 520 L566 444 L550 290 Z"/>
        </clipPath>
        <clipPath id="riderPhotoClip">
          <path d="M560 98 C642 90 730 90 818 110 L828 178 L820 688 L784 716 L684 712 L620 676 L596 600 L580 506 L568 392 L558 278 Z"/>
        </clipPath>
        <linearGradient id="plateBlueTemplate" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#103471"/>
          <stop offset="100%" stop-color="#284f95"/>
        </linearGradient>
        <linearGradient id="targetPlateTemplate" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(20,37,68,0.96)"/>
          <stop offset="100%" stop-color="rgba(37,58,97,0.96)"/>
        </linearGradient>
        <linearGradient id="titleCover" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0b2443"/>
          <stop offset="100%" stop-color="#0c1f39"/>
        </linearGradient>
        <linearGradient id="riderUnderlay" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#17375f"/>
          <stop offset="100%" stop-color="#0a162a"/>
        </linearGradient>
        <filter id="posterShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.34"/>
        </filter>
      </defs>

      <image href="${template}" x="0" y="0" width="875" height="862"/>

      <rect x="36" y="44" width="430" height="286" fill="url(#titleCover)"/>
      <rect x="36" y="330" width="430" height="32" fill="#0b1d35"/>
      <text x="60" y="118" font-family="Arial Black, Arial" font-size="62" font-weight="900" fill="#f4f2ed">${esc(headlineTop || participant.selectedChallenge.toUpperCase())}</text>
      ${headlineBottom ? `<text x="60" y="214" font-family="Arial Black, Arial" font-size="72" font-weight="900" fill="#1180ff">${esc(headlineBottom)}</text>` : ''}
      <text x="60" y="284" font-family="Arial" font-size="34" font-weight="800" letter-spacing="3" fill="#f2a327">${challengeLine}</text>
      <line x1="80" y1="326" x2="176" y2="326" stroke="#1da3ff" stroke-width="3"/>
      <line x1="302" y1="326" x2="398" y2="326" stroke="#1da3ff" stroke-width="3"/>
      <text x="194" y="336" font-family="Arial" font-size="18" font-weight="700" fill="#f3eee4">${posterDate}</text>

      <path d="M548 94 C614 84 710 86 814 108 L828 196 L828 704 L790 728 L706 720 L662 672 L648 628 L628 602 L602 598 L582 520 L566 444 L550 290 Z" fill="url(#riderUnderlay)"/>
      ${photo ? `<image href="${photo}" x="546" y="94" width="286" height="634" preserveAspectRatio="xMidYMid slice" clip-path="url(#riderPhotoClip)"/>` : ''}

      <g transform="translate(390 528) rotate(-7)">
        <rect width="332" height="224" rx="16" fill="#152848"/>
      </g>

      <g transform="translate(468 548) rotate(-7)" filter="url(#posterShadow)">
        <rect width="188" height="86" rx="6" fill="url(#plateBlueTemplate)"/>
        <text x="94" y="34" text-anchor="middle" font-family="Georgia" font-size="16" font-weight="700" fill="#ffffff">${esc(nameLineOne || '')}</text>
        ${nameLineTwo ? `<text x="94" y="58" text-anchor="middle" font-family="Georgia" font-size="16" font-weight="700" fill="#ffffff">${esc(nameLineTwo)}</text>` : ''}
      </g>

      <g transform="translate(452 604) rotate(-7)" filter="url(#posterShadow)">
        <rect width="224" height="146" rx="8" fill="url(#targetPlateTemplate)" stroke="#d4a03f" stroke-width="2"/>
        <text x="18" y="30" font-family="Arial" font-size="18" font-weight="700" fill="#e1ad4d">TARGET:</text>
        <text x="112" y="92" text-anchor="middle" font-family="Arial Black, Arial" font-size="50" font-weight="900" fill="#ffffff">${esc(distance)}</text>
        <text x="22" y="116" font-family="Arial" font-size="12" fill="#f0cf83">Ride Date</text>
        <text x="22" y="132" font-family="Arial" font-size="14" font-weight="700" fill="#ffffff">${rideDate}</text>
      </g>

      <rect x="128" y="614" width="160" height="38" fill="#6f5328"/>
      <text x="208" y="638" text-anchor="middle" font-family="Arial" font-size="13" font-weight="700" fill="#f8e9c6">${medalDate}</text>

      <rect x="716" y="624" width="88" height="88" rx="4" fill="#ffffff"/>
      <image href="${qrCodeDataUrl}" x="720" y="628" width="80" height="80" preserveAspectRatio="xMidYMid meet"/>

      <rect x="64" y="758" width="138" height="22" fill="#0b1d35"/>
      <rect x="250" y="758" width="244" height="22" fill="#0b1d35"/>
      <text x="74" y="774" font-family="Arial" font-size="12" font-weight="700" fill="#f2a327">${phone}</text>
      <text x="262" y="774" font-family="Arial" font-size="11" fill="#f3eee4">${email}</text>
    </svg>
  `
}

export function addNotificationLog(notification) {
  return writeDocument('notifications', notification.id, notification)
}

export async function getDashboardData(integrationStatus) {
  const state = await loadState()
  return {
    brandName,
    challenge,
    heroParticipant: state.participants[0] ?? null,
    participants: state.participants,
    registrations: sortByDate(state.registrations, 'createdAt'),
    activities: state.activities,
    posterJobs: state.posterJobs,
    certificateJobs: state.certificateJobs,
    notifications: state.notifications,
    integrationStatus: {
      firebase: getFirebaseStatus(),
      ...integrationStatus,
    },
  }
}

export async function createRegistration(payload) {
  const state = await loadState()
  const existingRegistration = payload.sourceReference
    ? state.registrations.find((entry) => entry.sourceReference === payload.sourceReference)
    : null
  if (existingRegistration) {
    return {
      participant: state.participants.find((entry) => entry.id === existingRegistration.participantId) || null,
      created: false,
    }
  }

  const idNumber = state.participants.length + 1001
  const participantId = `PP-${idNumber}`
  const registrationId = `REG-${idNumber}`
  const createdAt = new Date().toISOString()

  const participant = {
    id: participantId,
    registrationId,
    challengeId: challenge.id,
    name: payload.name,
    email: payload.email,
    phone: normalizePhone(payload.phone),
    address: payload.address,
    tshirtSize: payload.tshirtSize || 'M',
    selectedChallenge: payload.selectedChallenge,
    plannedActivityDate: payload.plannedActivityDate,
    status: 'Registered',
    posterReady: false,
    certificateReady: false,
    selectedActivityId: null,
    progressLabel: 'Registration complete. Submit one activity to continue.',
    validationTitle: 'Registration received',
    validationDetail: 'We have created your participant profile and sent registration confirmations.',
    photoDataUrl: payload.photoDataUrl || '',
    socials: {
      instagram: payload.instagram || '',
      facebook: payload.facebook || '',
      strava: payload.strava || '',
      website: payload.website || '',
    },
    posterProfile: defaultPosterProfileFor(payload),
    certificateProfile: defaultCertificateProfileFor(payload),
  }

  const registration = {
    id: registrationId,
    participantId,
    createdAt,
    source: payload.source || 'Pedals Power registration form',
    sourceReference: payload.sourceReference || '',
    sourceMetadata: payload.sourceMetadata || null,
  }

  await writeDocument('participants', participant.id, participant)
  await writeDocument('registrations', registration.id, registration)
  return {
    participant,
    created: true,
  }
}

export async function updateParticipant(participantId, payload) {
  const state = await loadState()
  const participant = state.participants.find((entry) => entry.id === participantId)
  if (!participant) return null

  const next = {
    ...participant,
    ...payload,
    phone: payload.phone ? normalizePhone(payload.phone) : participant.phone,
    socials: {
      ...participant.socials,
      ...(payload.socials || {}),
    },
    posterProfile: {
      ...participant.posterProfile,
      ...(payload.posterProfile || {}),
    },
    certificateProfile: {
      ...participant.certificateProfile,
      ...(payload.certificateProfile || {}),
    },
    photoDataUrl: payload.photoDataUrl ?? participant.photoDataUrl,
  }

  next.certificateProfile = withFixedCertificateSignatory(next.certificateProfile)

  await writeDocument('participants', next.id, next)
  return next
}

export async function addActivity(payload) {
  const state = await loadState()
  const alreadySelected = participantActivities(state, payload.participantId).some((entry) => entry.selected)
  const activity = {
    id: Date.now(),
    participantId: payload.participantId,
    source: payload.source,
    activityType: payload.activityType,
    sourceApp: payload.sourceApp || '',
    title: payload.title,
    distanceKm: Number(payload.distanceKm),
    durationMinutes: Number(payload.durationMinutes),
    date: payload.date,
    trackerScreenshotName: payload.trackerScreenshotName || 'activity-proof.png',
    trackerScreenshotDataUrl: payload.trackerScreenshotDataUrl || '',
    activityPhotoDataUrl: payload.activityPhotoDataUrl || '',
    notes: payload.notes || '',
    qualifies:
      inChallengeWindow(payload.date) &&
      Number(payload.distanceKm) >= challenge.targetKm * (1 - challenge.shortfallTolerance / 100),
    selected: !alreadySelected,
  }

  await writeDocument('activities', activity.id, activity)
  await refreshParticipant(activity.participantId)
  return activity
}

export async function selectActivity(participantId, activityId) {
  const state = await loadState()
  const participantEntries = state.activities
    .filter((activity) => activity.participantId === participantId)
    .map((activity) => ({ ...activity, selected: activity.id === activityId }))

  await writeManyDocuments('activities', [
    ...state.activities.filter((activity) => activity.participantId !== participantId),
    ...participantEntries,
  ])
  await refreshParticipant(participantId)
  return participantEntries.find((activity) => activity.id === activityId) ?? null
}

export async function createPoster({ participantId }) {
  const state = await loadState()
  const participant = state.participants.find((entry) => entry.id === participantId)
  const activity = participantActivities(state, participantId).find((entry) => entry.selected) ?? latestParticipantActivity(state, participantId)
  if (!participant || !activity) return null

  const id = `POSTER-${Date.now()}`
  const pngBuffer = createSizedPngFromSvg(await makePosterSvgReference(participant, activity), 875)
  const filename = `${slug(participant.name)}-poster.png`
  putAsset({
    kind: 'poster',
    id,
    format: 'png',
    buffer: pngBuffer,
    contentType: 'image/png',
    filename,
  })
  const storagePath = await uploadAssetToStorage({
    kind: 'poster',
    id,
    format: 'png',
    buffer: pngBuffer,
    contentType: 'image/png',
    filename,
  })

  const poster = {
    id,
    participantId,
    previewTitle: `${participant.name} x ${activity.activityType}`,
    createdAt: new Date().toISOString(),
    templateVersion: assetTemplateVersion,
    imageUrl: `/api/assets/poster/${id}/png`,
    storagePaths: storagePath ? { png: storagePath } : {},
  }

  await writeDocument('posterJobs', poster.id, poster)
  await writeDocument('participants', participant.id, { ...participant, posterReady: true })
  return poster
}

export async function createCertificate(participantId) {
  const state = await loadState()
  const participant = state.participants.find((entry) => entry.id === participantId)
  const activity = participantActivities(state, participantId).find((entry) => entry.selected) ?? latestParticipantActivity(state, participantId)
  if (!participant || !activity || !activity.qualifies) return null

  const id = `CERT-${Date.now()}`
  const pngBuffer = createSizedPngFromSvg(await makeCertificateSvgTemplate(participant, activity), 1167)
  const pdfBuffer = await createPdfFromPngBuffer(pngBuffer, 1167, 822)

  const pngFilename = `${slug(participant.name)}-certificate.png`
  const pdfFilename = `${slug(participant.name)}-certificate.pdf`

  putAsset({
    kind: 'certificate',
    id,
    format: 'png',
    buffer: pngBuffer,
    contentType: 'image/png',
    filename: pngFilename,
  })
  putAsset({
    kind: 'certificate',
    id,
    format: 'pdf',
    buffer: pdfBuffer,
    contentType: 'application/pdf',
    filename: pdfFilename,
  })

  const pngStoragePath = await uploadAssetToStorage({
    kind: 'certificate',
    id,
    format: 'png',
    buffer: pngBuffer,
    contentType: 'image/png',
    filename: pngFilename,
  })
  const pdfStoragePath = await uploadAssetToStorage({
    kind: 'certificate',
    id,
    format: 'pdf',
    buffer: pdfBuffer,
    contentType: 'application/pdf',
    filename: pdfFilename,
  })

  const certificate = {
    id,
    participantId,
    title: `${participant.name} Achievement Certificate`,
    issuedOn: new Date().toISOString(),
    templateVersion: assetTemplateVersion,
    pngUrl: `/api/assets/certificate/${id}/png`,
    pdfUrl: `/api/assets/certificate/${id}/pdf`,
    storagePaths: {
      ...(pngStoragePath ? { png: pngStoragePath } : {}),
      ...(pdfStoragePath ? { pdf: pdfStoragePath } : {}),
    },
  }

  await writeDocument('certificateJobs', certificate.id, certificate)
  await writeDocument('participants', participant.id, {
    ...participant,
    certificateReady: true,
    status: 'Completed',
  })
  return certificate
}
