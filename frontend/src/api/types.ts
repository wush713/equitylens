export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type RunStage = 'queued' | 'route' | 'retrieve' | 'analyze' | 'verify' | 'compose' | 'completed' | 'failed' | 'cancelled'

export type RunEvent = {
  sequence: number
  stage: RunStage
  message: string
  created_at: string
}

export type Claim = {
  id: string
  kind: 'fact' | 'calculation' | 'inference'
  proposition: string
  status: 'supported' | 'contradicted' | 'insufficient'
  evidence_ids: string[]
}

export type ResearchAnswer = {
  id: string
  headline: string
  summary: string
  period_label: string
  limitation: string
  claims: Claim[]
}

export type ResearchRun = {
  id: string
  session_id: string
  question: string
  status: RunStatus
  stage: RunStage
  error: string | null
  created_at: string
  updated_at: string
  events: RunEvent[]
  answer: ResearchAnswer | null
}

export type Evidence = {
  id: string
  provider: string
  title: string
  url: string
  published_at: string
  locator: string
  payload: Record<string, unknown>
}
