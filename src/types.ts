export type ActivityKind =
  | 'Cycling'
  | 'Running'
  | 'Walking'
  | 'Swimming'
  | 'Yoga'
  | 'Hiking'
  | 'Gym Workout'
  | 'Other'

export type Challenge = {
  id: string
  title: string
  type: 'Single Activity'
  targetKm: number
  startDate: string
  endDate: string
  shortfallTolerance: number
  supportedActivities: ActivityKind[]
}

export type SocialLinks = {
  instagram: string
  facebook: string
  strava: string
  website: string
}

export type PosterProfile = {
  themeTitle: string
  themeSubtitle: string
  dateLabel: string
  targetLabel: string
  callToAction: string
  accentMood: 'Saffron Dusk' | 'Midnight Gold' | 'Forest Glow'
}

export type CertificateProfile = {
  achievementLine: string
  signatoryName: string
  signatoryTitle: string
  durationLabel: string
  distanceLabel: string
}

export type ParticipantStatus = 'Registered' | 'Ready to Finish' | 'Completed'

export type Participant = {
  id: string
  registrationId: string
  challengeId: string
  name: string
  email: string
  phone: string
  address: string
  tshirtSize: string
  selectedChallenge: ActivityKind
  plannedActivityDate: string
  status: ParticipantStatus
  posterReady: boolean
  certificateReady: boolean
  selectedActivityId: number | null
  progressLabel: string
  validationTitle: string
  validationDetail: string
  photoDataUrl: string
  socials: SocialLinks
  posterProfile: PosterProfile
  certificateProfile: CertificateProfile
}

export type ActivitySource =
  | 'Manual Upload'
  | 'Imported Activity'
  | 'Pedals Power Tracker'
  | 'External App / Device'

export type Activity = {
  id: number
  participantId: string
  source: ActivitySource
  activityType: ActivityKind
  sourceApp: string
  title: string
  distanceKm: number
  durationMinutes: number
  date: string
  trackerScreenshotName: string
  trackerScreenshotDataUrl: string
  activityPhotoDataUrl: string
  notes: string
  qualifies: boolean
  selected: boolean
}

export type PosterJob = {
  id: string
  participantId: string
  previewTitle: string
  createdAt: string
  imageUrl: string
}

export type CertificateJob = {
  id: string
  participantId: string
  title: string
  issuedOn: string
  pngUrl: string
  pdfUrl: string
}

export type Registration = {
  id: string
  participantId: string
  createdAt: string
  source: string
}

export type Notification = {
  id: string
  participantId: string
  channel: 'Email' | 'SMS'
  recipient: string
  subject: string
  body: string
  status: 'Delivered'
  mode: 'Live Provider' | 'Local Log'
  provider: string
  sentAt: string
}

export type IntegrationStatus = {
  firebase: {
    enabled: boolean
    mode: 'Live Provider' | 'Local Log'
    provider: string
  }
  email: {
    enabled: boolean
    mode: 'Live Provider' | 'Local Log'
    provider: string
  }
  sms: {
    enabled: boolean
    mode: 'Live Provider' | 'Local Log'
    provider: string
  }
}

export type DashboardSnapshot = {
  brandName: string
  challenge: Challenge
  heroParticipant: Participant | null
  participants: Participant[]
  registrations: Registration[]
  activities: Activity[]
  posterJobs: PosterJob[]
  certificateJobs: CertificateJob[]
  notifications: Notification[]
  integrationStatus: IntegrationStatus
}
