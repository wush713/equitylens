import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { getRun } from '../api/research'
import type { ResearchRun, RunEvent } from '../api/types'

const TERMINAL = new Set(['completed', 'failed', 'cancelled'])

export function useResearchRun(runId: string) {
  const [run, setRun] = useState<ResearchRun | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let lastSequence = 0
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    async function connect() {
      try {
        const snapshot = await getRun(runId, controller.signal)
        if (controller.signal.aborted) return
        setRun(snapshot)
        setError('')
        lastSequence = snapshot.events.at(-1)?.sequence ?? 0
        if (TERMINAL.has(snapshot.status)) return
        const response = await apiFetch('/runs/' + runId + '/events?after=' + lastSequence, { signal: controller.signal })
        reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (!controller.signal.aborted) {
          const part = await reader.read()
          if (part.done) break
          buffer += decoder.decode(part.value, { stream: true }).replace(/\r/g, '')
          let boundary = buffer.indexOf('\n\n')
          while (boundary >= 0) {
            const block = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)
            const event = block.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim()
            const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
            if (event === 'progress' && data) {
              const progress = JSON.parse(data) as RunEvent
              if (progress.sequence > lastSequence) {
                lastSequence = progress.sequence
                setRun(current => current && ({ ...current, status: 'running', stage: progress.stage, events: [...current.events, progress] }))
              }
            }
            if (event === 'terminal' && data) {
              setRun(JSON.parse(data) as ResearchRun)
              await reader.cancel()
              return
            }
            boundary = buffer.indexOf('\n\n')
          }
        }
        if (!controller.signal.aborted) retryTimer = setTimeout(connect, 1200)
      } catch (reason) {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : '无法读取研究进度')
        retryTimer = setTimeout(connect, 2500)
      }
    }
    void connect()
    return () => { controller.abort(); clearTimeout(retryTimer); void reader?.cancel().catch(() => {}) }
  }, [runId, revision])
  return { run, error, refresh: () => setRevision(value => value + 1) }
}
