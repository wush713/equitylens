import { useEffect, useRef, useState } from 'react'
import { Copy, Check, RotateCcw, Square } from 'lucide-react'
import { cancelRun } from '../api/research'
import { useResearchRun } from '../hooks/useResearchRun'
import { ResearchAnswer } from './ResearchAnswer'
import { RunProgress } from './RunProgress'

export function ResearchRunMessage({ runId, onEvidence, onStatus, onRetry }: {
  runId: string; onEvidence: (id: string) => void; onStatus: (id: string, busy: boolean) => void; onRetry: (question: string) => void
}) {
  const { run, error, refresh } = useResearchRun(runId)
  const [actionError, setActionError] = useState('')
  const [copied, setCopied] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const statusHandler = useRef(onStatus)
  statusHandler.current = onStatus
  const busy = !run || ['queued', 'running'].includes(run.status)
  useEffect(() => { statusHandler.current(runId, busy) }, [runId, busy])
  async function cancel() {
    setCancelling(true)
    try { await cancelRun(runId); refresh() } catch (reason) { setActionError(reason instanceof Error ? reason.message : '取消失败') }
    finally { setCancelling(false) }
  }
  async function copy() {
    if (!run?.answer) return
    try {
      const a = run.answer
      await navigator.clipboard.writeText([a.headline, a.period_label, a.summary, ...a.claims.map(c => c.proposition), a.limitation,
        '来源：贵州茅台2025年年度报告，第6页；固定样本与规则模板分析，未调用模型。',
        'https://www.moutaichina.com/mtgf/articleFileDir/2026-04/17/1b9fae59825c41bf9a776892a00565f7.pdf'].join('\n\n'))
      setCopied(true)
    } catch { setActionError('复制失败，请手动选择内容') }
  }
  return <div className="run-message">
    {(error || actionError) && <p role="alert" className="research-error">{error ? '连接中断，正在重连：' + error : actionError}</p>}
    {busy && <><RunProgress run={run} /><button className="run-action" disabled={cancelling} onClick={cancel}><Square size={13} />{cancelling ? '正在取消…' : '取消研究'}</button></>}
    {run?.status === 'completed' && run.answer && <><ResearchAnswer answer={run.answer} onEvidence={onEvidence} /><button className="run-action" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? '已复制' : '复制完整研究'}</button></>}
    {run && ['failed', 'cancelled'].includes(run.status) && <div className="research-error" role="status"><p>{run.status === 'cancelled' ? '这次研究已取消，没有发布答案。' : run.error}</p><button className="run-action" onClick={() => onRetry(run.question)}><RotateCcw size={14} />重新填写问题</button></div>}
  </div>
}
