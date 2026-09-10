import { ExternalLink, FileText, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getEvidence } from '../api/research'
import type { Evidence } from '../api/types'

type Metric = { label: string; unit: string; current: string | number; previous: string | number; reported_change_pct?: string | number; reported_change_percentage_points?: string | number }

export function EvidenceDrawer({ evidenceId, onClose }: { evidenceId: string; onClose: () => void }) {
  const [evidence, setEvidence] = useState<Evidence | null>(null)
  const [error, setError] = useState('')
  const drawerRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    drawerRef.current?.querySelector<HTMLElement>('button')?.focus()
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeRef.current()
      if (event.key !== 'Tab') return
      const nodes = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button, a[href]') ?? [])
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus() }
  }, [])
  useEffect(() => {
    let active = true
    getEvidence(evidenceId).then(value => { if (active) setEvidence(value) }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '证据读取失败') })
    return () => { active = false }
  }, [evidenceId])

  const payload = evidence?.payload as { periods?: { current?: string; previous?: string }; metrics?: Record<string, Metric>; notes?: { text: string }[]; sample_sha256?: string; extraction_method?: string } | undefined
  const metrics = Object.entries(payload?.metrics ?? {})
  return <div className="evidence-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <aside ref={drawerRef} className="evidence-drawer" role="dialog" aria-modal="true" aria-label="证据详情">
      <div className="evidence-header"><div><span>TRACEABLE EVIDENCE</span><h2>证据详情</h2></div><button className="icon-button" aria-label="关闭证据" onClick={onClose}><X size={20} /></button></div>
      {error && <p className="evidence-error">{error}</p>}
      {!evidence && !error && <p className="evidence-loading">正在读取证据…</p>}
      {evidence && <>
        <div className="evidence-source"><FileText size={21} /><div><strong>{evidence.title}</strong><span>{evidence.provider} · {evidence.published_at}</span></div></div>
        <dl className="evidence-locator"><div><dt>对比期间</dt><dd>{payload?.periods?.current} / {payload?.periods?.previous}</dd></div><div><dt>原文位置</dt><dd>{evidence.locator}</dd></div></dl>
        <div className="evidence-metrics">{metrics.map(([key, metric]) => <div className="evidence-metric" key={key}><strong>{metric.label}</strong><span>{payload?.periods?.current}：{metric.current} {metric.unit}</span><span>{payload?.periods?.previous}：{metric.previous} {metric.unit}</span><small>{key === 'weighted_roe' ? `变动 = 本期 − 上期 = ${metric.reported_change_percentage_points} 个百分点` : `同比 = (本期 − 上期) / 上期 × 100% = ${metric.reported_change_pct}%`}</small></div>)}</div>
        {payload?.notes?.map((note, index) => <p className="evidence-note" key={index}>{note.text}</p>)}
        <p className="evidence-note">{payload?.extraction_method}</p>
        <details className="evidence-version"><summary>样本版本</summary><code>{payload?.sample_sha256}</code></details>
        <a className="source-link" href={evidence.url} target="_blank" rel="noreferrer">打开公司年报原文 <ExternalLink size={14} /></a>
      </>}
    </aside>
  </div>
}
