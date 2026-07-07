import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

function env(name) {
  return process.env[name]?.trim() || ''
}

function isPlaceholder(value) {
  return (
    !value ||
    value.includes('your-firebase-project-id') ||
    value.includes('firebase-adminsdk-xxxxx') ||
    value.includes('replace-with-private-key') ||
    value.includes('firebasestorage.app')
  )
}

function privateKey() {
  const key = env('FIREBASE_PRIVATE_KEY')
  return key ? key.replace(/\\n/g, '\n') : ''
}

export function isFirebaseEnabled() {
  const projectId = env('FIREBASE_PROJECT_ID')
  const clientEmail = env('FIREBASE_CLIENT_EMAIL')
  const storageBucket = env('FIREBASE_STORAGE_BUCKET')
  const key = privateKey()

  return Boolean(
    projectId &&
      clientEmail &&
      key &&
      storageBucket &&
      !isPlaceholder(projectId) &&
      !isPlaceholder(clientEmail) &&
      !isPlaceholder(key) &&
      !isPlaceholder(storageBucket),
  )
}

export function getFirebaseStatus() {
  return {
    enabled: isFirebaseEnabled(),
    mode: isFirebaseEnabled() ? 'Live Provider' : 'Local Log',
    provider: isFirebaseEnabled() ? 'Firebase Firestore + Storage' : 'In-Memory Local Mode',
  }
}

export function getFirebaseApp() {
  if (!isFirebaseEnabled()) return null
  if (getApps().length > 0) return getApps()[0]

  return initializeApp({
    credential: cert({
      projectId: env('FIREBASE_PROJECT_ID'),
      clientEmail: env('FIREBASE_CLIENT_EMAIL'),
      privateKey: privateKey(),
    }),
    storageBucket: env('FIREBASE_STORAGE_BUCKET'),
  })
}

export function db() {
  const app = getFirebaseApp()
  return app ? getFirestore(app) : null
}

export function bucket() {
  const app = getFirebaseApp()
  return app ? getStorage(app).bucket() : null
}
