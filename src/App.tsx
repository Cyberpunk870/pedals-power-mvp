import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  addActivity,
  createCertificate,
  createPoster,
  createRegistration,
  fetchDashboard,
  selectActivity,
  updateParticipant,
} from './api'
import type { ActivityKind, ActivitySource, DashboardSnapshot, Participant } from './types'

type Tab = 'home' | 'challenge' | 'assets' | 'profile'
type ChallengeStep = 'register' | 'activity' | 'proof' | 'assets'

const activityOptions: ActivityKind[] = [
  'Cycling',
  'Running',
  'Walking',
  'Swimming',
  'Yoga',
  'Hiking',
  'Gym Workout',
  'Other',
]

const activitySourceOptions: ActivitySource[] = [
  'Manual Upload',
  'Imported Activity',
  'Pedals Power Tracker',
  'External App / Device',
]

const emptyRegistration = {
  name: '',
  email: '',
  phone: '',
  address: '',
  tshirtSize: 'M',
  selectedChallenge: 'Cycling' as ActivityKind,
  plannedActivityDate: '2026-07-01',
  instagram: '',
  facebook: '',
  strava: '',
  website: '',
  photoDataUrl: '',
}

const emptyManualActivity = {
  source: 'External App / Device' as ActivitySource,
  activityType: 'Cycling' as ActivityKind,
  sourceApp: '',
  title: '',
  distanceKm: '',
  durationMinutes: '',
  date: '2026-07-01',
  trackerScreenshotName: '',
  trackerScreenshotDataUrl: '',
  activityPhotoDataUrl: '',
  notes: '',
}

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

async function downloadFile(url: string, filename: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Unable to download the generated file.')
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}

function participantToDraft(participant: Participant) {
  return {
    name: participant.name,
    email: participant.email,
    phone: participant.phone,
    address: participant.address,
    selectedChallenge: participant.selectedChallenge,
    plannedActivityDate: participant.plannedActivityDate,
    photoDataUrl: participant.photoDataUrl,
    socials: { ...participant.socials },
    posterProfile: { ...participant.posterProfile },
    certificateProfile: { ...participant.certificateProfile },
  }
}

function previewImageUrl(dataUrl: string) {
  if (dataUrl) return dataUrl

  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 420">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0e2f4f" />
          <stop offset="48%" stop-color="#15304a" />
          <stop offset="100%" stop-color="#d18a3f" />
        </linearGradient>
      </defs>
      <rect width="320" height="420" fill="url(#g)" />
      <circle cx="226" cy="98" r="34" fill="rgba(255,215,160,0.85)" />
      <circle cx="220" cy="96" r="18" fill="rgba(244,207,173,0.95)" />
      <path d="M174 150c16-18 40-28 72-28 34 0 58 12 72 34l-20 210H154z" fill="rgba(235,131,41,0.95)" />
    </svg>
  `)
}

function challengeArtworkUrl(photoDataUrl: string) {
  if (photoDataUrl) return photoDataUrl

  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 420">
      <defs>
        <linearGradient id="sky" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#123a63"/>
          <stop offset="55%" stop-color="#0d2746"/>
          <stop offset="100%" stop-color="#ef9339"/>
        </linearGradient>
        <linearGradient id="road" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#33516f"/>
          <stop offset="100%" stop-color="#102137"/>
        </linearGradient>
      </defs>
      <rect width="340" height="420" fill="url(#sky)"/>
      <circle cx="264" cy="82" r="48" fill="rgba(255,194,118,0.86)"/>
      <path d="M190 420c8-66 32-134 68-206 24-48 44-83 60-106l22 14c-44 66-84 164-112 298z" fill="url(#road)"/>
      <circle cx="214" cy="206" r="26" fill="none" stroke="#111d2d" stroke-width="10"/>
      <circle cx="278" cy="206" r="26" fill="none" stroke="#111d2d" stroke-width="10"/>
      <path d="M214 206l30-50 32 50-62 0z" fill="none" stroke="#f8f1e6" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M244 156l28-20" stroke="#f8f1e6" stroke-width="8" stroke-linecap="round"/>
      <path d="M244 156l-24-10" stroke="#f8f1e6" stroke-width="8" stroke-linecap="round"/>
      <circle cx="250" cy="112" r="20" fill="#f1caa5"/>
      <path d="M225 138c12-16 25-24 40-24 24 0 44 18 50 44l8 64c4 26-8 48-32 56l-58 20c-24 8-44-6-42-30l4-46c2-32 10-58 30-84z" fill="#ef7f2d"/>
      <path d="M230 136c12-12 22-18 36-18 12 0 22 4 32 10-6-26-16-40-28-46-18-10-36-2-40 16z" fill="#141e2e"/>
    </svg>
  `)
}

function sampleCertificatePreviewUrl(name: string, distanceLabel: string) {
  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 840">
      <rect width="1200" height="840" fill="#fbf8f2"/>
      <rect x="18" y="18" width="1164" height="804" fill="none" stroke="#123979" stroke-width="32"/>
      <rect x="48" y="48" width="1104" height="744" fill="none" stroke="#d4aa48" stroke-width="6"/>
      <text x="600" y="180" text-anchor="middle" fill="#123979" font-family="Arial" font-size="98" font-weight="900">CERTIFICATE</text>
      <text x="600" y="244" text-anchor="middle" fill="#123979" font-family="Arial" font-size="44" font-weight="700">OF ACHIEVEMENT</text>
      <text x="600" y="332" text-anchor="middle" fill="#2f456c" font-family="Arial" font-size="28">This certificate is given to</text>
      <text x="600" y="424" text-anchor="middle" fill="#123979" font-family="Georgia" font-size="72" font-weight="700">${name.toUpperCase()}</text>
      <text x="600" y="492" text-anchor="middle" fill="#334d73" font-family="Arial" font-size="28">For successfully completing the Pedals Power one-day challenge</text>
      <text x="266" y="632" text-anchor="middle" fill="#3d4f70" font-family="Arial" font-size="30">01:20:00</text>
      <text x="266" y="682" text-anchor="middle" fill="#111" font-family="Arial" font-size="44" font-weight="800">DURATION</text>
      <text x="924" y="632" text-anchor="middle" fill="#3d4f70" font-family="Arial" font-size="30">${distanceLabel}</text>
      <text x="924" y="682" text-anchor="middle" fill="#111" font-family="Arial" font-size="44" font-weight="800">DISTANCE</text>
      <text x="600" y="642" text-anchor="middle" fill="#123979" font-family="cursive" font-size="52">Unique Jain</text>
      <line x1="474" y1="660" x2="726" y2="660" stroke="#111" stroke-width="2"/>
      <text x="600" y="708" text-anchor="middle" fill="#111" font-family="Arial" font-size="26" font-weight="800">UNIQUE JAIN</text>
      <text x="600" y="742" text-anchor="middle" fill="#334d73" font-family="Arial" font-size="22">Founder &amp; CEO</text>
    </svg>
  `)
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Unable to read the selected file.'))
    reader.readAsDataURL(file)
  })
}

function challengeStepIndex(step: ChallengeStep) {
  return ['register', 'activity', 'proof', 'assets'].indexOf(step)
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [challengeStep, setChallengeStep] = useState<ChallengeStep>('register')
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [selectedParticipantId, setSelectedParticipantId] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState('Loading Pedals Power...')
  const [registration, setRegistration] = useState(emptyRegistration)
  const [manualActivity, setManualActivity] = useState(emptyManualActivity)
  const [profileDraft, setProfileDraft] = useState<ReturnType<typeof participantToDraft> | null>(null)
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  async function bootDashboard(retries = 0) {
    try {
      setError(null)
      const data = await fetchDashboard()
      setSnapshot(data)
      if (data.heroParticipant) {
        setSelectedParticipantId(data.heroParticipant.id)
      }
      setBanner('Pedals Power is ready.')
      return true
    } catch {
      if (retries > 0) {
        setBanner('Waiting for the local API...')
        await new Promise((resolve) => window.setTimeout(resolve, 1200))
        return bootDashboard(retries - 1)
      }

      setError('Unable to reach the Pedals Power API. Start `npm run dev:full`, wait a few seconds, then retry.')
      return false
    }
  }

  useEffect(() => {
    bootDashboard(5)
  }, [])

  const selectedParticipant = useMemo(() => {
    if (!snapshot) return null
    return snapshot.participants.find((participant) => participant.id === selectedParticipantId) ?? snapshot.heroParticipant
  }, [selectedParticipantId, snapshot])

  useEffect(() => {
    if (!selectedParticipant) {
      setProfileDraft(null)
      return
    }

    setProfileDraft(participantToDraft(selectedParticipant))
    setManualActivity((current) => ({
      ...current,
      activityType: selectedParticipant.selectedChallenge,
      date: selectedParticipant.plannedActivityDate,
    }))
  }, [selectedParticipant])

  const participantActivities = useMemo(() => {
    if (!snapshot || !selectedParticipant) return []
    return snapshot.activities.filter((activity) => activity.participantId === selectedParticipant.id)
  }, [selectedParticipant, snapshot])

  const selectedActivity = useMemo(() => {
    return participantActivities.find((activity) => activity.selected) ?? null
  }, [participantActivities])

  const latestPoster = useMemo(() => {
    if (!snapshot || !selectedParticipant) return null
    return snapshot.posterJobs.find((job) => job.participantId === selectedParticipant.id) ?? null
  }, [selectedParticipant, snapshot])

  const latestCertificate = useMemo(() => {
    if (!snapshot || !selectedParticipant) return null
    return snapshot.certificateJobs.find((job) => job.participantId === selectedParticipant.id) ?? null
  }, [selectedParticipant, snapshot])

  const homeChallengeArt = useMemo(
    () => challengeArtworkUrl(selectedParticipant?.photoDataUrl || selectedActivity?.activityPhotoDataUrl || ''),
    [selectedActivity?.activityPhotoDataUrl, selectedParticipant?.photoDataUrl],
  )

  const samplePosterPreview = '/samples/poster-reference-preview.png'

  const sampleCertificatePreview = useMemo(
    () =>
      sampleCertificatePreviewUrl(
        selectedParticipant?.name || 'Participant Name',
        selectedActivity ? `${selectedActivity.distanceKm.toFixed(1)} KM` : '12.4 KM',
      ),
    [selectedActivity, selectedParticipant],
  )

  const socialStatus = selectedParticipant?.socials.instagram || selectedParticipant?.socials.facebook
    ? 'Connected in profile'
    : 'Not connected yet'
  const stravaStatus = selectedParticipant?.socials.strava
    ? 'Strava link saved'
    : 'Add Strava link in profile'
  const shopifyStatus = selectedParticipant?.registrationId
    ? `Registered as ${selectedParticipant.registrationId}`
    : 'No synced order yet'

  async function runAction(label: string, action: () => Promise<{ snapshot: DashboardSnapshot }>) {
    setBusy(label)
    setError(null)
    try {
      const result = await action()
      setSnapshot(result.snapshot)
      if (!selectedParticipantId && result.snapshot.heroParticipant) {
        setSelectedParticipantId(result.snapshot.heroParticipant.id)
      }
      setBanner(label)
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'Request failed.'
      setError(message)
      setBanner(`Action failed: ${message}`)
    } finally {
      setBusy(null)
    }
  }

  async function runDownload(label: string, action: () => Promise<void>) {
    setBusy(label)
    setError(null)
    try {
      await action()
      setBanner(label)
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'Download failed.'
      setError(message)
      setBanner(`Action failed: ${message}`)
    } finally {
      setBusy(null)
    }
  }

  if (!snapshot) {
    return (
      <div className="mobile-shell-wrap">
        <div className="mobile-shell mobile-shell-loading">
          <div className="loading-card">
            <strong>Loading Pedals Power...</strong>
            <p>{error ?? 'Waiting for the local API connection.'}</p>
            <button type="button" className="ghost-button" onClick={() => bootDashboard(2)}>
              Retry connection
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderChallengeStepper = () => (
    <div className="journey-stepper">
      {[
        { id: 'register', label: 'Register' },
        { id: 'activity', label: 'Activity' },
        { id: 'proof', label: 'Upload Proof' },
        { id: 'assets', label: 'Assets' },
      ].map((step, index) => {
        const active = challengeStep === step.id
        const complete = index < challengeStepIndex(challengeStep)
        return (
          <div key={step.id} className="journey-step">
            {index < 3 ? <div className={`journey-link ${index < challengeStepIndex(challengeStep) ? 'is-complete' : ''}`} /> : null}
            <button
              type="button"
              className={`journey-dot ${active ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`}
              onClick={() => setChallengeStep(step.id as ChallengeStep)}
            >
              {index + 1}
            </button>
            <span>{step.label}</span>
          </div>
        )
      })}
    </div>
  )

  const renderHome = () => (
    <section className="screen">
      <header className="app-topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 72 72" className="brand-logo-svg">
              <circle cx="36" cy="36" r="34" fill="#ffffff" />
              <path d="M18 24h20v4H24l14-14v18h-4V22L18 38z" fill="#111111" />
              <rect x="16" y="31" width="40" height="8" fill="#111111" />
              <rect x="22" y="32.5" width="28" height="5" fill="#ffffff" />
              <text x="36" y="36.3" textAnchor="middle" className="brand-logo-text">PEDALS POWER</text>
              <path d="M54 48H34v-4h14L34 58V40h4v10l16-16z" fill="#111111" />
            </svg>
          </div>
          <div>
            <span className="brand-micro">Pedals Power</span>
          </div>
        </div>
        <button type="button" className="icon-button" onClick={() => setIsMoreOpen(true)}>
          ≡
        </button>
      </header>

      <div className="hero-copy-mobile">
        <h1>Pedals Power</h1>
        <p>Register, upload proof, generate your poster and certificate.</p>
      </div>

      <article className="challenge-poster-card">
        <div className="challenge-poster-overlay" />
        <div className="challenge-poster-copy">
          <span className="challenge-chip">Challenge</span>
          <h2>One-Day Movement Challenge</h2>
          <p className="challenge-date">1 Jul 2026 - 31 Jul 2026</p>
          <p className="challenge-text">Choose your activity and move for a fitter, stronger you.</p>
          <div className="challenge-tags">
            {snapshot.challenge.supportedActivities.slice(0, 5).map((activity) => (
              <span key={activity}>{activity}</span>
            ))}
          </div>
        </div>
        <div className="challenge-poster-photo" style={{ backgroundImage: `url(${homeChallengeArt})` }} />
      </article>

      <article className="mini-preview-row">
        <div className="mini-preview-thumb">
          {latestPoster ? (
            <img src={`http://localhost:4000${latestPoster.imageUrl}`} alt="Poster thumbnail" />
          ) : (
            <img className="sample-poster-fit" src={samplePosterPreview} alt="Sample poster thumbnail" />
          )}
        </div>
        <div className="mini-preview-copy">
          <p>Complete your challenge and get your custom poster and certificate.</p>
          <span className="mini-preview-ring" />
        </div>
      </article>

      <div className="screen-actions">
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setTab('challenge')
            setChallengeStep('register')
          }}
        >
          Register now {'->'}
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            setTab(selectedParticipant ? 'challenge' : 'home')
            setChallengeStep(selectedParticipant ? 'proof' : 'register')
          }}
        >
          Continue your challenge
        </button>
      </div>
    </section>
  )

  const renderChallenge = () => (
    <section className="screen">
      <header className="screen-header">
        <button type="button" className="back-button" onClick={() => setTab('home')}>
          {'<-'}
        </button>
        <div className="screen-header-main">
          {renderChallengeStepper()}
          <h2>{challengeStep === 'proof' ? 'Upload Proof' : 'Registration'}</h2>
        </div>
      </header>

      {challengeStep === 'register' || challengeStep === 'activity' ? (
        <>
          <div className="section-copy">
            <strong>Let's get you registered</strong>
            <p>Enter your details and choose your planned activity type.</p>
          </div>

          <form
            className="mobile-form"
            onSubmit={(event) => {
              event.preventDefault()
              runAction('Registration completed.', async () => {
                const result = await createRegistration(registration)
                const next = result.snapshot.participants[0]
                if (next) {
                  setSelectedParticipantId(next.id)
                }
                setRegistration(emptyRegistration)
                setChallengeStep('proof')
                return result
              })
            }}
          >
            <label>
              <span className="field-label">Full name</span>
              <input required placeholder="Full name" value={registration.name} onChange={(event) => setRegistration((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span className="field-label">Email address</span>
              <input required type="email" placeholder="Email address" value={registration.email} onChange={(event) => setRegistration((current) => ({ ...current, email: event.target.value }))} />
            </label>
            <label>
              <span className="field-label">Phone number</span>
              <input required placeholder="Phone number" value={registration.phone} onChange={(event) => setRegistration((current) => ({ ...current, phone: event.target.value }))} />
            </label>
            <label>
              <span className="field-label">Full address</span>
              <input required placeholder="Full address" value={registration.address} onChange={(event) => setRegistration((current) => ({ ...current, address: event.target.value }))} />
            </label>
            <label>
              <span className="field-label">T-shirt size</span>
              <select value={registration.tshirtSize} onChange={(event) => setRegistration((current) => ({ ...current, tshirtSize: event.target.value }))}>
                <option>S</option>
                <option>M</option>
                <option>L</option>
                <option>XL</option>
              </select>
            </label>
            <label>
              <span className="field-label">Activity type</span>
              <select value={registration.selectedChallenge} onChange={(event) => setRegistration((current) => ({ ...current, selectedChallenge: event.target.value as ActivityKind }))}>
                {activityOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Planned activity</span>
              <input required type="date" value={registration.plannedActivityDate} onChange={(event) => setRegistration((current) => ({ ...current, plannedActivityDate: event.target.value }))} />
            </label>
            <label>
              <span className="field-label">Profile snapshot</span>
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  const dataUrl = await fileToDataUrl(file)
                  setRegistration((current) => ({ ...current, photoDataUrl: dataUrl }))
                }}
              />
              <small>This will be used on your poster if no activity photo is added later.</small>
            </label>

            <button type="submit" className="primary-button" disabled={busy !== null}>
              Complete registration
            </button>
          </form>
        </>
      ) : null}

      {challengeStep === 'proof' ? (
        <>
          <div className="section-copy">
            <strong>Activity proof</strong>
            <p>Upload the activity details, tracker screenshot, and participant photo. Screenshots are enough proof to unlock poster generation, even if the source app or device name is left blank.</p>
          </div>

          <form
            className="mobile-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (!selectedParticipant) return

              runAction('Proof submitted.', async () =>
                addActivity({
                  participantId: selectedParticipant.id,
                  source: manualActivity.source,
                  activityType: manualActivity.activityType,
                  sourceApp: manualActivity.sourceApp,
                  title: manualActivity.title,
                  distanceKm: Number(manualActivity.distanceKm),
                  durationMinutes: Number(manualActivity.durationMinutes),
                  date: manualActivity.date,
                  trackerScreenshotName: manualActivity.trackerScreenshotName || 'activity-proof.png',
                  trackerScreenshotDataUrl: manualActivity.trackerScreenshotDataUrl,
                  activityPhotoDataUrl: manualActivity.activityPhotoDataUrl,
                  notes: manualActivity.notes,
                }),
              )
            }}
          >
            <label>
              <span className="field-label">Activity type</span>
              <select value={manualActivity.activityType} onChange={(event) => setManualActivity((current) => ({ ...current, activityType: event.target.value as ActivityKind }))}>
                {activityOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Tracker screenshot</span>
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  const dataUrl = await fileToDataUrl(file)
                  setManualActivity((current) => ({
                    ...current,
                    trackerScreenshotName: file.name,
                    trackerScreenshotDataUrl: dataUrl,
                  }))
                }}
              />
            </label>
            <label>
              <span className="field-label">Upload participant photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  const dataUrl = await fileToDataUrl(file)
                  setManualActivity((current) => ({
                    ...current,
                    activityPhotoDataUrl: dataUrl,
                  }))
                }}
              />
            </label>
            <label>
              <span className="field-label">Source app or device</span>
              <select value={manualActivity.source} onChange={(event) => setManualActivity((current) => ({ ...current, source: event.target.value as ActivitySource }))}>
                {activitySourceOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">App or device name (optional)</span>
              <input placeholder="Strava, Garmin, Fitbit" value={manualActivity.sourceApp} onChange={(event) => setManualActivity((current) => ({ ...current, sourceApp: event.target.value }))} />
              <small>Leave this empty if you only have screenshots as proof.</small>
            </label>
            <label>
              <span className="field-label">Distance in km</span>
              <input required type="number" step="0.1" placeholder="12.4" value={manualActivity.distanceKm} onChange={(event) => setManualActivity((current) => ({ ...current, distanceKm: event.target.value }))} />
            </label>
            <label>
              <span className="field-label">Duration in minutes</span>
              <input required type="number" placeholder="80" value={manualActivity.durationMinutes} onChange={(event) => setManualActivity((current) => ({ ...current, durationMinutes: event.target.value }))} />
            </label>
            <label>
              <span className="field-label">Activity date</span>
              <input required type="date" value={manualActivity.date} onChange={(event) => setManualActivity((current) => ({ ...current, date: event.target.value }))} />
            </label>
            <label>
              <span className="field-label">Submission title</span>
              <input required placeholder="Morning city ride" value={manualActivity.title} onChange={(event) => setManualActivity((current) => ({ ...current, title: event.target.value }))} />
            </label>

            <div className="checklist-box">
              <strong>Ready for proof</strong>
              <ul>
                <li>{manualActivity.trackerScreenshotDataUrl ? 'Tracker screenshot added' : 'Add a tracker screenshot'}</li>
                <li>{manualActivity.activityPhotoDataUrl ? 'Activity photo added' : 'Add a participant activity photo'}</li>
                <li>{manualActivity.sourceApp ? `Source noted: ${manualActivity.sourceApp}` : 'Source app/device name is optional'}</li>
                <li>{selectedParticipant ? 'Participant selected' : 'Register a participant first'}</li>
              </ul>
            </div>

            <button type="submit" className="dark-button" disabled={busy !== null || !selectedParticipant}>
              Submit proof
            </button>
          </form>

          {participantActivities.length > 0 ? (
            <div className="submission-list">
              {participantActivities.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  className={`submission-card ${activity.selected ? 'is-selected' : ''}`}
                  onClick={() =>
                    selectedParticipant
                      ? runAction('Selected proof updated.', () => selectActivity(selectedParticipant.id, activity.id))
                      : Promise.resolve()
                  }
                >
                  <strong>{activity.title}</strong>
                  <span>{activity.distanceKm.toFixed(1)} km | {activity.durationMinutes} min</span>
                  <span>{formatDate(activity.date)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )

  const renderAssets = () => (
    <section className="screen">
      <header className="screen-header">
        <button type="button" className="back-button" onClick={() => setTab('home')}>
          {'<-'}
        </button>
        <div className="screen-header-main">
          {renderChallengeStepper()}
          <h2>Your Assets</h2>
        </div>
      </header>

      <div className="section-copy">
        <strong>Your poster and certificate</strong>
        <p>Generate and download your final assets from the selected proof entry.</p>
      </div>

      <article className="asset-card-mobile">
        <div className="asset-card-head-mobile">
          <div>
            <span className="asset-label">Your Poster</span>
            <strong>Ready to share</strong>
          </div>
        </div>
        {latestPoster ? (
          <img className="asset-preview-image" src={`http://localhost:4000${latestPoster.imageUrl}`} alt="Poster preview" />
        ) : (
          <img className="asset-preview-image sample-poster-fit" src={samplePosterPreview} alt="Sample poster preview" />
        )}
        <button
          type="button"
          className="dark-button"
          disabled={busy !== null || !selectedParticipant || !selectedActivity}
          onClick={() => {
            if (latestPoster) {
              runDownload('Poster downloaded.', () =>
                downloadFile(`http://localhost:4000${latestPoster.imageUrl}`, `${selectedParticipant?.name || 'pedals-power'}-poster.png`),
              )
              return
            }

            if (!selectedParticipant) return
            runAction('Poster generated.', () => createPoster({ participantId: selectedParticipant.id }))
          }}
        >
          {latestPoster ? 'Download poster' : 'Generate poster'}
        </button>
      </article>

      <article className="asset-card-mobile">
        <div className="asset-card-head-mobile">
          <div>
            <span className="asset-label">Your Certificate</span>
            <strong>Formal completion certificate</strong>
          </div>
        </div>
        {latestCertificate ? (
          <img className="certificate-preview-image" src={`http://localhost:4000${latestCertificate.pngUrl}`} alt="Certificate preview" />
        ) : (
          <img className="certificate-preview-image" src={sampleCertificatePreview} alt="Sample certificate preview" />
        )}
        <div className="asset-actions-row">
          <button
            type="button"
            className="dark-button"
            disabled={busy !== null || !selectedParticipant || !selectedActivity}
            onClick={() => {
              if (latestCertificate) {
                runDownload('Certificate downloaded.', () =>
                  downloadFile(`http://localhost:4000${latestCertificate.pdfUrl}`, `${selectedParticipant?.name || 'pedals-power'}-certificate.pdf`),
                )
                return
              }

              if (!selectedParticipant) return
              runAction('Certificate generated.', () => createCertificate(selectedParticipant.id))
            }}
          >
            {latestCertificate ? 'Download certificate' : 'Generate certificate'}
          </button>
          <button type="button" className="ghost-button" onClick={() => setTab('profile')}>
            Edit participant details
          </button>
        </div>
        {latestCertificate ? <small className="asset-time">{formatDateTime(latestCertificate.issuedOn)}</small> : null}
      </article>
    </section>
  )

  const renderProfile = () => (
    <section className="screen">
      <header className="screen-header">
        <div>
          <span className="brand-micro">Profile</span>
          <h2>Participant details</h2>
        </div>
      </header>

      {selectedParticipant && profileDraft ? (
        <>
          <div className="profile-hero">
            <img src={previewImageUrl(profileDraft.photoDataUrl)} alt="Participant" />
            <div>
              <strong>{profileDraft.name || 'Participant'}</strong>
              <span>{profileDraft.selectedChallenge}</span>
            </div>
          </div>

          <div className="mobile-form">
            <label>
              Full name
              <input value={profileDraft.name} placeholder="Full name" onChange={(event) => setProfileDraft((current) => current ? { ...current, name: event.target.value } : current)} />
            </label>
            <label>
              Email address
              <input type="email" value={profileDraft.email} placeholder="Email address" onChange={(event) => setProfileDraft((current) => current ? { ...current, email: event.target.value } : current)} />
            </label>
            <label>
              Phone number
              <input value={profileDraft.phone} placeholder="Phone number" onChange={(event) => setProfileDraft((current) => current ? { ...current, phone: event.target.value } : current)} />
            </label>
            <label>
              Full address
              <input value={profileDraft.address} placeholder="Full address" onChange={(event) => setProfileDraft((current) => current ? { ...current, address: event.target.value } : current)} />
            </label>
            <label>
              Instagram
              <input value={profileDraft.socials.instagram} placeholder="@handle" onChange={(event) => setProfileDraft((current) => current ? { ...current, socials: { ...current.socials, instagram: event.target.value } } : current)} />
            </label>
            <label>
              Strava
              <input value={profileDraft.socials.strava} placeholder="strava.com/athletes/yourid" onChange={(event) => setProfileDraft((current) => current ? { ...current, socials: { ...current.socials, strava: event.target.value } } : current)} />
            </label>
            <label>
              Poster heading
              <input value={profileDraft.posterProfile.themeTitle} placeholder="PEDALS POWER" onChange={(event) => setProfileDraft((current) => current ? { ...current, posterProfile: { ...current.posterProfile, themeTitle: event.target.value } } : current)} />
            </label>
            <label>
              Certificate achievement line
              <input value={profileDraft.certificateProfile.achievementLine} placeholder="Achievement line" onChange={(event) => setProfileDraft((current) => current ? { ...current, certificateProfile: { ...current.certificateProfile, achievementLine: event.target.value } } : current)} />
            </label>
            <button
              type="button"
              className="primary-button"
              disabled={busy !== null}
              onClick={() => runAction('Participant details saved.', () => updateParticipant(selectedParticipant.id, profileDraft))}
            >
              Save profile
            </button>
          </div>
        </>
      ) : (
        <div className="empty-state-card">
          <strong>No participant yet</strong>
          <p>Register a participant first to unlock the profile screen.</p>
        </div>
      )}
    </section>
  )

  return (
    <div className="mobile-shell-wrap">
      <div className="mobile-shell">
        <div className="status-note">
          <span>{banner}</span>
          {busy ? <strong>{busy}</strong> : null}
        </div>
        {error ? <div className="inline-error">{error}</div> : null}

        <div className="phone-canvas">
          {tab === 'home' ? renderHome() : null}
          {tab === 'challenge' ? renderChallenge() : null}
          {tab === 'assets' ? renderAssets() : null}
          {tab === 'profile' ? renderProfile() : null}
        </div>

        <nav className="bottom-tabs">
          <button type="button" className={tab === 'home' ? 'is-active' : ''} onClick={() => setTab('home')}>
            <span>⌂</span>
            <small>Home</small>
          </button>
          <button
            type="button"
            className={tab === 'challenge' ? 'is-active' : ''}
            onClick={() => {
              setTab('challenge')
              setChallengeStep(selectedParticipant ? 'proof' : 'register')
            }}
          >
            <span>◔</span>
            <small>My Challenge</small>
          </button>
          <button
            type="button"
            className={tab === 'assets' ? 'is-active' : ''}
            onClick={() => {
              setTab('assets')
              setChallengeStep('assets')
            }}
          >
            <span>▣</span>
            <small>Assets</small>
          </button>
          <button type="button" className={tab === 'profile' ? 'is-active' : ''} onClick={() => setTab('profile')}>
            <span>◡</span>
            <small>Profile</small>
          </button>
        </nav>

        {isMoreOpen ? (
          <div className="sheet-overlay" onClick={() => setIsMoreOpen(false)}>
            <section className="more-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="more-sheet-handle" />
              <div className="more-sheet-head">
                <div>
                  <span className="brand-micro">More</span>
                  <h3>Connections and support</h3>
                </div>
                <button type="button" className="back-button" onClick={() => setIsMoreOpen(false)}>
                  x
                </button>
              </div>
              <div className="more-group">
                <span className="more-group-label">Connections</span>
                <button
                  type="button"
                  className="more-item"
                  onClick={() => {
                    setIsMoreOpen(false)
                    setTab('profile')
                    setBanner('Open Profile to update Instagram and Strava links.')
                  }}
                >
                  <strong>Connect social profiles</strong>
                  <small>{socialStatus}</small>
                </button>
                <button
                  type="button"
                  className="more-item"
                  onClick={() => {
                    setIsMoreOpen(false)
                    setBanner('Strava connection flow is scaffolded and ready for provider setup.')
                  }}
                >
                  <strong>Connect Strava</strong>
                  <small>{stravaStatus}</small>
                </button>
                <button
                  type="button"
                  className="more-item"
                  onClick={() => {
                    setIsMoreOpen(false)
                    setBanner('Shopify registration status will appear here once the live webhook is connected.')
                  }}
                >
                  <strong>Shopify registration status</strong>
                  <small>{shopifyStatus}</small>
                </button>
              </div>
              <div className="more-group">
                <span className="more-group-label">Events</span>
                <button
                  type="button"
                  className="more-item"
                  onClick={() => {
                    setIsMoreOpen(false)
                    setBanner('Upcoming events view will list future Pedals Power challenges.')
                  }}
                >
                  <strong>Upcoming events</strong>
                  <small>{formatDate(snapshot.challenge.startDate)} current challenge live</small>
                </button>
              </div>
              <div className="more-group">
                <span className="more-group-label">Support</span>
                <button
                  type="button"
                  className="more-item"
                  onClick={() => {
                    setIsMoreOpen(false)
                    setBanner('Support and participant guidance will be published here.')
                  }}
                >
                  <strong>Support</strong>
                  <small>Email and SMS registration flow available locally</small>
                </button>
                <button
                  type="button"
                  className="more-item"
                  onClick={() => {
                    setIsMoreOpen(false)
                    setBanner('Terms and privacy pages will be linked here in the live app.')
                  }}
                >
                  <strong>Terms and privacy</strong>
                  <small>Pedals Power local MVP policies view</small>
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
