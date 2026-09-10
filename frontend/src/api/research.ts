import { request } from './client'
import type { Evidence, ResearchRun } from './types'

type Session = { id: string; title: string; created_at: string }
type Submission = { message_id: string; run_id: string; status: string }

export function createSession(title: string) {
  return request<Session>('/sessions', { method: 'POST', body: JSON.stringify({ title }) })
}

export function submitResearchMessage(sessionId: string, content: string, idempotencyKey: string) {
  return request<Submission>(`/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ content }),
  })
}

export function getRun(runId: string, signal?: AbortSignal) {
  return request<ResearchRun>(`/runs/${runId}`, { signal })
}

export type RemoteSession = { id: string; title: string; messages: { id: string; role: 'user' | 'assistant'; content: string; run_id: string | null }[] }

export function listSessions() { return request<RemoteSession[]>('/sessions') }
export function deleteSession(id: string) { return request<void>(`/sessions/${id}`, { method: 'DELETE' }) }

export function getEvidence(evidenceId: string) {
  return request<Evidence>(`/evidence/${evidenceId}`)
}

export function cancelRun(runId: string) {
  return request<{ id: string; status: string }>(`/runs/${runId}/cancel`, { method: 'POST' })
}
