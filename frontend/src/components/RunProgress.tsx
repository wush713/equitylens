import { Check, LoaderCircle } from 'lucide-react'
import type { ResearchRun } from '../api/types'

const stages = ['route', 'retrieve', 'analyze', 'verify', 'compose'] as const
const labels = { route: '理解问题', retrieve: '读取年报', analyze: '复算指标', verify: '核验证据', compose: '组织回答' }

export function RunProgress({ run }: { run: ResearchRun | null }) {
  const completed = new Set(run?.events.map(event => event.stage) ?? [])
  const currentIndex = run ? stages.indexOf(run.stage as typeof stages[number]) + 1 : 0
  return <div className="run-progress" role="status">
    <div className="run-progress-head"><LoaderCircle size={16} /><span>{run?.events.at(-1)?.message ?? '任务已保存，等待研究服务处理'}</span></div>
    <div className="run-stage-list">{stages.map((stage, index) => <span key={stage} className={completed.has(stage) ? 'done' : index === currentIndex ? 'current' : ''}>{completed.has(stage) ? <Check size={11} /> : <i />}{labels[stage]}</span>)}</div>
  </div>
}
