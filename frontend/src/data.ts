export type User = { name: string; email: string }
export type Preferences = { risk: 'conservative' | 'balanced' | 'growth'; horizon: string; knowledge: string; configured: boolean }
export type Message = { id: string; role: 'user' | 'assistant'; text: string }
export type Conversation = { id: string; title: string; group: 'company' | 'notes' | 'recent'; messages: Message[] }
export type Stock = { code: string; name: string; sector: string; initials: string }

export const defaultPreferences: Preferences = { risk: 'conservative', horizon: '一年以上', knowledge: '刚刚开始了解', configured: false }
export const riskLabels = { conservative: '保守型', balanced: '平衡型', growth: '成长型' }
export const stocks: Stock[] = [
  { code: '600519.SH', name: '贵州茅台', sector: '食品饮料', initials: '茅' },
  { code: '300750.SZ', name: '宁德时代', sector: '电力设备', initials: '宁' },
  { code: '601318.SH', name: '中国平安', sector: '非银金融', initials: '平' },
  { code: '000333.SZ', name: '美的集团', sector: '家用电器', initials: '美' },
  { code: '600036.SH', name: '招商银行', sector: '银行', initials: '招' },
  { code: '002594.SZ', name: '比亚迪', sector: '汽车', initials: '迪' },
]

const demoReply = '我们可以从经营表现、现金流和主要风险三个角度展开研究。\n\n先确认研究期间，再核对财报与公告中的原始信息；将可验证的事实和需要进一步判断的观点分开，最后整理值得持续跟踪的问题。\n\n当前是前端演示，尚未获取真实财报或行情，因此这里不提供公司的具体数据与研究结论。'
export const initialConversations: Conversation[] = [
  { id: 'example-maotai', title: '贵州茅台 · 基本面研究', group: 'company', messages: [
    { id: 'm1', role: 'user', text: '研究一家公司的基本面，可以从哪里开始？' },
    { id: 'm2', role: 'assistant', text: demoReply },
  ] },
  { id: 'example-energy', title: '新能源行业观察', group: 'company', messages: [
    { id: 'e1', role: 'user', text: '我想建立一份新能源行业的研究清单。' },
    { id: 'e2', role: 'assistant', text: '可以先列出三个研究主题：行业需求、企业经营和政策变化。\n\n为每个主题收集对应的原始资料，记录发布时间与适用范围，再观察这些信息是否相互支持。\n\n这是研究流程的演示，没有使用实时行业数据。' },
  ] },
  { id: 'example-pe', title: '认识市盈率与估值', group: 'notes', messages: [
    { id: 'p1', role: 'user', text: '市盈率是什么意思？' },
    { id: 'p2', role: 'assistant', text: '市盈率（P/E）表达的是股票价格与每股收益之间的关系。\n\n理解它时，要先区分收益采用的是历史口径还是预测口径，再结合公司的盈利稳定性、行业特点和增长情况。\n\n较低的市盈率本身不能证明一家公司更值得投资。这个示例用于演示问答界面，不包含具体公司的估值判断。' },
  ] },
]

export function createDemoReply(question: string) {
  if (/市盈率|估值/.test(question)) return initialConversations[2].messages[1].text
  if (/现金流/.test(question)) return '看经营现金流，可以先问三个问题：\n\n1. 公司的经营活动是否带来现金流入？\n2. 现金流与净利润的变化是否一致？\n3. 差异是否来自应收账款、存货或其他经营项目？\n\n比较时需要保持报表期间和口径一致，并回到原始财报核对。当前是交互演示，尚未查询任何公司的真实数据。'
  return demoReply
}

export function readStorage<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback }
}
export function writeStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Prototype remains usable when browser storage is unavailable. */ }
}
