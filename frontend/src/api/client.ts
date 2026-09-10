export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

function workspaceKey() {
  const user = JSON.parse(localStorage.getItem('equitylens.user') ?? 'null') as { email?: string } | null
  const key = 'equitylens.workspace.' + (user?.email?.toLowerCase() ?? 'guest')
  let value = localStorage.getItem(key)
  if (!value) {
    value = crypto.randomUUID() + crypto.randomUUID()
    localStorage.setItem(key, value)
  }
  return value
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Workspace-Key': workspaceKey(), ...options?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : '请求参数无效或服务暂不可用'
    throw new ApiError(detail, response.status)
  }
  return response
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(path, { ...options, signal: options?.signal ?? AbortSignal.timeout(15000) })
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}
