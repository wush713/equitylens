import { CheckCircle2, FileSearch, ShieldCheck } from 'lucide-react'
import type { ResearchAnswer as Answer } from '../api/types'

export function ResearchAnswer({ answer, onEvidence }: { answer: Answer; onEvidence: (id: string) => void }) {
  return <div className="research-answer">
    <div className="answer-heading"><span>{answer.period_label}</span><h3>{answer.headline}</h3><p>{answer.summary}</p></div>
    <div className="claim-list">{answer.claims.map(claim => <div className={`claim-card ${claim.kind}`} key={claim.id}>
      <span className="claim-kind">{claim.kind === 'calculation' ? '数据与计算' : claim.kind === 'inference' ? '分析判断' : '事实'}</span>
      <p>{claim.proposition}</p>
      <div className="claim-meta"><span><CheckCircle2 size={13} />{claim.kind === 'calculation' ? '数值已复算' : '模板前提已核对'}</span>{claim.evidence_ids.map(id => <button key={id} onClick={() => onEvidence(id)}><FileSearch size={13} />查看证据</button>)}</div>
    </div>)}</div>
    <div className="answer-limitation"><ShieldCheck size={15} /><p>{answer.limitation}</p></div>
  </div>
}
