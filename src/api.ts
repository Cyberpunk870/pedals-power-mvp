import type { CertificateJob, DashboardSnapshot, PosterJob } from './types'

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error ?? 'Request failed')
  }
  return data as T
}

export function fetchDashboard() {
  return request<DashboardSnapshot>('/api/dashboard')
}

export function createRegistration(payload: Record<string, unknown>) {
  return request<{ snapshot: DashboardSnapshot }>('/api/registrations', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateParticipant(participantId: string, payload: Record<string, unknown>) {
  return request<{ snapshot: DashboardSnapshot }>(`/api/participants/${participantId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function addActivity(payload: Record<string, unknown>) {
  return request<{ snapshot: DashboardSnapshot }>('/api/activities', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function selectActivity(participantId: string, activityId: number) {
  return request<{ snapshot: DashboardSnapshot }>(`/api/participants/${participantId}/selected-activity`, {
    method: 'POST',
    body: JSON.stringify({ activityId }),
  })
}

export function createPoster(payload: Record<string, unknown>) {
  return request<{ poster: PosterJob, snapshot: DashboardSnapshot }>('/api/posters', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function createCertificate(participantId: string) {
  return request<{ certificate: CertificateJob, snapshot: DashboardSnapshot }>('/api/certificates', {
    method: 'POST',
    body: JSON.stringify({ participantId }),
  })
}
