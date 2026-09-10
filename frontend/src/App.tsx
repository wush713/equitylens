import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowRight, ArrowUp, BookOpen, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Copy, Eye, EyeOff, FileText, Folder, FolderOpen, LogOut, MessageSquare, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, SquarePen, Star, Trash2, TrendingUp, UserRound, X } from 'lucide-react'
import { defaultPreferences, initialConversations, readStorage, riskLabels, stocks, writeStorage, type Conversation, type Preferences, type Stock, type User } from './data'

import { createSession, submitResearchMessage, listSessions, deleteSession, type RemoteSession } from './api/research'
import { ResearchRunMessage } from './components/ResearchRunMessage'
import { EvidenceDrawer } from './components/EvidenceDrawer'

function remoteConversations(sessions: RemoteSession[]): Conversation[] {
  return sessions.map(s => ({ id: s.id, remoteSessionId: s.id, title: s.title, group: 'recent',
    messages: s.messages.map(m => ({ id: m.id, role: m.role, text: m.content, runId: m.role === 'assistant' ? m.run_id ?? undefined : undefined })) }))
}

type Page = 'login' | 'register' | 'chat' | 'watchlist'
const uid = () => crypto.randomUUID()
const currentPage = (): Page => {
  const value = window.location.hash.replace('#/', '')
  return ['login', 'register', 'chat', 'watchlist'].includes(value) ? value as Page : 'login'
}

function Logo({ large = false }: { large?: boolean }) {
  return <svg className={`logo-mark ${large ? 'large' : ''}`} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <rect width="40" height="40" rx="12" fill="currentColor" />
    <path d="M11 27V21M19 27V16M27 27V11" stroke="white" strokeWidth="3.6" strokeLinecap="round" />
  </svg>
}

function Brand() { return <span className="brand"><Logo /><span>EquityLens</span></span> }

function Modal({ children, onClose, title, drawer = false }: { children: ReactNode; onClose: () => void; title: string; drawer?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const element = ref.current
    element?.querySelector<HTMLElement>('button, input, select, [tabindex="0"]')?.focus()
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const nodes = Array.from(element?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]') ?? [])
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [onClose])
  return <div className={`modal-backdrop ${drawer ? 'drawer-backdrop' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <div ref={ref} className={drawer ? 'preferences-drawer' : 'modal'} role="dialog" aria-modal="true" aria-label={title}>{children}</div>
  </div>
}

function Auth({ page, navigate, onLogin }: { page: 'login' | 'register'; navigate: (p: Page) => void; onLogin: (u: User) => void }) {
  const register = page === 'register'
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!e.currentTarget.reportValidity() || submitting) return
    setSubmitting(true)
    timer.current = setTimeout(() => {
      // The prototype never stores a password or sends credentials to a server.
      onLogin({ name: register ? name.trim() : email.split('@')[0], email: email.trim() })
      setSubmitting(false)
    }, 350)
  }
  return <main className="auth-page">
    <div className="auth-top"><Brand /><span className="tiny-label">你的研究，从这里开始</span></div>
    <section className="auth-card" aria-labelledby="auth-title">
      <Brand />
      <div className="auth-heading"><h1 id="auth-title">{register ? '开启你的研究之旅' : '欢迎回来'}</h1><p>{register ? '创建账户，发现更清晰的市场视角。' : '登录 EquityLens，继续你的研究。'}</p></div>
      <form onSubmit={submit}>
        {register && <label className="field">用户名<input name="name" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={24} autoComplete="nickname" placeholder="怎么称呼你" /></label>}
        <label className="field">邮箱<input name="email" type="email" required autoComplete="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="field">密码<span className="password-wrap"><input name="password" type={showPassword ? 'text' : 'password'} required minLength={6} maxLength={100} autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? '设置密码，至少 6 位' : '请输入密码，至少 6 位'} value={password} onChange={e => setPassword(e.target.value)} /><button type="button" className="icon-button" aria-label={showPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
        <button className="primary-button auth-submit" disabled={submitting}>{submitting ? '正在进入…' : register ? '创建账户' : '登录'}{!submitting && <ArrowRight size={17} />}</button>
      </form>
      <p className="auth-switch">{register ? '已经有账户？' : '还没有账户？'}<button onClick={() => navigate(register ? 'login' : 'register')}>{register ? '立即登录' : '注册账户'}</button></p>
      <div className="auth-divider"><span>或</span></div>
      <button className="demo-login" onClick={() => onLogin({ name: '研究员', email: 'demo@equitylens.local' })}>先体验一下 <ArrowRight size={15} /></button>
      <p className="auth-demo-note">前端原型 · 无需使用真实账号信息</p>
    </section>
    <footer className="auth-footer"><span>© {new Date().getFullYear()} EquityLens</span><span>让每一次研究，都有据可循。</span></footer>
  </main>
}

function PreferencesPanel({ value, onClose, onSave }: { value: Preferences; onClose: () => void; onSave: (v: Preferences) => void }) {
  const [draft, setDraft] = useState(value)
  const options = [
    { key: 'conservative' as const, title: '保守型', description: '重视风险解释，先理解，再判断。', icon: ShieldCheck },
    { key: 'balanced' as const, title: '平衡型', description: '同时关注经营表现与潜在风险。', icon: SlidersHorizontal },
    { key: 'growth' as const, title: '成长型', description: '关注成长逻辑，深入了解不确定性。', icon: TrendingUp },
  ]
  return <Modal title="理财偏好" onClose={onClose} drawer>
    <div className="drawer-header"><div className="eyebrow">PERSONAL PREFERENCES</div><button className="icon-button" aria-label="关闭偏好设置" onClick={onClose}><X size={20} /></button></div>
    <div className="drawer-intro"><span className="feature-icon"><Settings2 size={23} /></span><h2>让研究更懂你</h2><p>选择你的理财偏好，调整适合自己的研究视角。</p></div>
    <div className="drawer-content">
      <div className="section-label">风险偏好 <span>可随时调整</span></div>
      <div className="risk-options" role="radiogroup" aria-label="风险偏好">
        {options.map(({ key, title, description, icon: Icon }) => <button key={key} role="radio" aria-checked={draft.risk === key} className={`risk-option ${draft.risk === key ? 'selected' : ''}`} onClick={() => setDraft({ ...draft, risk: key })}>
          <span className="risk-icon"><Icon size={20} /></span><span><strong>{title}</strong><small>{description}</small></span><span className="radio-dot">{draft.risk === key && <span />}</span>
        </button>)}
      </div>
      <label className="field">关注周期<select value={draft.horizon} onChange={e => setDraft({ ...draft, horizon: e.target.value })}><option>三个月以内</option><option>三个月至一年</option><option>一年以上</option></select></label>
      <label className="field">金融知识水平<select value={draft.knowledge} onChange={e => setDraft({ ...draft, knowledge: e.target.value })}><option>刚刚开始了解</option><option>了解基础概念</option><option>熟悉财务与市场分析</option></select></label>
      <div className="preference-note"><CircleHelp size={16} /><p>这里是偏好设置演示，不代表正式风险测评。未设置时，默认采用保守型视角。</p></div>
    </div>
    <div className="drawer-actions"><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={() => onSave({ ...draft, configured: true })}><Check size={16} />保存偏好</button></div>
  </Modal>
}

function StockPicker({ selected, onClose, onAdd }: { selected: string[]; onClose: () => void; onAdd: (stock: Stock) => void }) {
  const [search, setSearch] = useState('')
  const available = stocks.filter(stock => `${stock.name}${stock.code}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <Modal title="添加自选股" onClose={onClose}>
    <div className="modal-title"><div><h2>添加自选股</h2><p>把关注的公司，放进你的研究清单。</p></div><button className="icon-button" aria-label="关闭添加自选股" onClick={onClose}><X size={20} /></button></div>
    <div className="search-input"><Search size={17} /><input aria-label="搜索股票名称或代码" placeholder="搜索股票名称或代码" value={search} onChange={e => setSearch(e.target.value)} /></div>
    <p className="picker-label">{search ? '搜索结果' : '示例股票'}</p>
    <div className="picker-list">{available.length ? available.map(stock => <div className="picker-row" key={stock.code}><div className="stock-initial">{stock.initials}</div><div className="stock-name"><strong>{stock.name}</strong><span>{stock.code}</span></div><button className={selected.includes(stock.code) ? 'added-button' : 'small-add-button'} disabled={selected.includes(stock.code)} onClick={() => onAdd(stock)}>{selected.includes(stock.code) ? <><Check size={15} />已添加</> : <><Plus size={15} />添加</>}</button></div>) : <div className="empty-search">没有找到这只股票<p>原型目前支持以上示例股票。</p></div>}</div>
  </Modal>
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => readStorage('equitylens.user', null))
  const [page, setPage] = useState<Page>(currentPage)
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences)
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [watchlist, setWatchlist] = useState<string[]>(stocks.slice(0, 3).map(s => s.code))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [serviceError, setServiceError] = useState('')
  const [evidenceId, setEvidenceId] = useState<string | null>(null)
  const [busyRuns, setBusyRuns] = useState<Record<string, boolean>>({})
  const accountEpoch = useRef(0)
  const pendingSubmission = useRef<{ question: string; sessionId: string; key: string } | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [stockPickerOpen, setStockPickerOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 760)
  const [companyOpen, setCompanyOpen] = useState(true)
  const [notesOpen, setNotesOpen] = useState(true)
  const [chatSearch, setChatSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [mode, setMode] = useState('综合研究')
  const [modeOpen, setModeOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [copiedId, setCopiedId] = useState('')
  const [watchSearch, setWatchSearch] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const accountRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const conversationsRef = useRef<Conversation[]>(initialConversations)
  const active = conversations.find(c => c.id === activeId)
  const activeBusy = active?.messages.some(m => m.runId && busyRuns[m.runId]) ?? false

  function activate(id: string | null) {
    setActiveId(id)
    if (user) writeStorage(`equitylens.active.${user.email.toLowerCase()}`, id)
  }
  function navigate(next: Page) { window.location.hash = `/${next}`; setPage(next); setAccountOpen(false) }
  function notify(text: string) { clearTimeout(toastTimer.current); setToast(text); toastTimer.current = setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const onHash = () => setPage(currentPage())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    if (!user && (page === 'chat' || page === 'watchlist')) navigate('login')
    if (user && (page === 'login' || page === 'register')) navigate('chat')
  }, [user, page])
  useEffect(() => {
    const epoch = ++accountEpoch.current
    if (!user) return
    const key = user.email.toLowerCase()
    setServiceError('')
    setBusyRuns({})
    const pending = readStorage<{ question: string; sessionId: string; key: string } | null>(`equitylens.pending.${key}`, null)
    pendingSubmission.current = pending
    if (pending) setDraft(pending.question)
    setActiveId(readStorage<string | null>(`equitylens.active.${key}`, null))
    setPreferences(readStorage(`equitylens.preferences.${key}`, defaultPreferences))
    const storedConversations = readStorage(`equitylens.conversations.${key}`, initialConversations)
    conversationsRef.current = storedConversations
    setConversations(storedConversations)
    setWatchlist(readStorage(`equitylens.watchlist.${key}`, stocks.slice(0, 3).map(s => s.code)))
    listSessions().then(sessions => {
      if (epoch !== accountEpoch.current) return
      const merged = [...remoteConversations(sessions), ...storedConversations.filter(c => !c.remoteSessionId)]
      conversationsRef.current = merged
      setConversations(merged)
      writeStorage(`equitylens.conversations.${key}`, merged)
    }).catch(() => {
      if (epoch === accountEpoch.current) setServiceError('后端暂未连接。请启动 API 和 Worker；现有原型记录仍可查看。')
    })
    return () => { ++accountEpoch.current }
  }, [user])
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [active?.messages.length, sending, activeId])
  useEffect(() => {
    function outside(event: MouseEvent) { if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false) }
    function escape(event: globalThis.KeyboardEvent) { if (event.key === 'Escape') { setAccountOpen(false); setModeOpen(false) } }
    document.addEventListener('mousedown', outside); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape) }
  }, [])
  useEffect(() => () => { clearTimeout(toastTimer.current) }, [])

  function saveConversations(next: Conversation[]) {
    conversationsRef.current = next
    setConversations(next)
    if (user) writeStorage(`equitylens.conversations.${user.email.toLowerCase()}`, next)
  }
  function login(next: User) { writeStorage('equitylens.user', next); setUser(next); navigate('chat') }
  function logout() {
    ++accountEpoch.current; setSending(false); setEvidenceId(null)
    writeStorage('equitylens.user', null); setUser(null); activate(null); setDraft(''); navigate('login')
  }
  function newChat() { activate(null); setDraft(''); navigate('chat'); setTimeout(() => composerRef.current?.focus(), 50) }
  function selectChat(id: string) { activate(id); setDraft(''); navigate('chat'); if (window.innerWidth < 760) setSidebarOpen(false) }
  function startResearch(stock: Stock) { activate(null); setDraft(`分析${stock.name}最近两期的经营表现和主要风险。`); navigate('chat'); setTimeout(() => composerRef.current?.focus(), 50) }
  function updateWatchlist(next: string[]) { setWatchlist(next); if (user) writeStorage(`equitylens.watchlist.${user.email.toLowerCase()}`, next) }
  async function sendMessage() {
    const question = draft.trim()
    if (!question || sending || activeBusy || !user) return
    const epoch = accountEpoch.current
    const account = user.email.toLowerCase()
    setSending(true); setServiceError('')
    try {
      let pending = pendingSubmission.current
      if (!pending || pending.question !== question || (active?.remoteSessionId && active.remoteSessionId !== pending.sessionId)) {
        const sessionId = active?.remoteSessionId ?? (await createSession(question.slice(0, 80))).id
        pending = { question, sessionId, key: uid() }
        pendingSubmission.current = pending
        writeStorage(`equitylens.pending.${account}`, pending)
      }
      await submitResearchMessage(pending.sessionId, question, pending.key)
      if (epoch !== accountEpoch.current) return
      const sessionId = pending.sessionId
      pendingSubmission.current = null
      writeStorage(`equitylens.pending.${account}`, null)
      const sessions = await listSessions()
      if (epoch !== accountEpoch.current) return
      saveConversations([...remoteConversations(sessions), ...conversationsRef.current.filter(c => !c.remoteSessionId)])
      activate(sessionId); setDraft('')
      if (composerRef.current) composerRef.current.style.height = ''
    } catch (reason) {
      if (epoch === accountEpoch.current) setServiceError(reason instanceof Error ? reason.message : '提交失败，请确认后端已启动')
    } finally {
      if (epoch === accountEpoch.current) setSending(false)
    }
  }
  async function removeConversation(c: Conversation) {
    const epoch = accountEpoch.current
    try {
      if (c.remoteSessionId) await deleteSession(c.remoteSessionId)
      if (epoch !== accountEpoch.current) return
      saveConversations(conversationsRef.current.filter(x => x.id !== c.id))
      if (activeId === c.id) activate(null)
      notify('对话已删除')
    } catch (reason) { notify(reason instanceof Error ? reason.message : '删除失败') }
  }
  function onComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendMessage() }
  }
  async function copyMessage(id: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopiedId(id); notify('回答已复制') } catch { notify('暂时无法复制，请手动选择文字') }
  }
  const filteredConversations = conversations.filter(c => c.title.toLowerCase().includes(chatSearch.toLowerCase()))
  const conversationButton = (c: Conversation) => <div className={`tree-conversation ${activeId === c.id && page === 'chat' ? 'active' : ''}`} key={c.id}>
    <button className="conversation-select" onClick={() => selectChat(c.id)} title={c.title}><MessageSquare size={15} /><span>{c.title}</span></button>
    <button className="conversation-delete" aria-label={`删除对话 ${c.title}`} onClick={() => void removeConversation(c)}><Trash2 size={13} /></button>
  </div>

  if (!user || page === 'login' || page === 'register') return <Auth key={page} page={page === 'register' ? 'register' : 'login'} navigate={navigate} onLogin={login} />

  return <div className="app-shell">
    <header className="floating-nav">
      <button className="brand-button" aria-label="EquityLens 首页" onClick={newChat}><Brand /></button>
      <nav className="main-nav" aria-label="主导航"><button className={page === 'chat' ? 'active' : ''} onClick={() => navigate('chat')}><MessageSquare size={17} /><span>Chat</span></button><button className={page === 'watchlist' ? 'active' : ''} onClick={() => navigate('watchlist')}><Star size={17} /><span>我的自选</span><span className="nav-count">{watchlist.length}</span></button></nav>
      <div className="nav-right"><span className="prototype-pill"><span />研究预览</span><div className="account-wrap" ref={accountRef}><button className={`account-button ${accountOpen ? 'open' : ''}`} aria-label="用户菜单" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}><UserRound size={18} /></button>
        {accountOpen && <div className="account-menu"><div className="account-info"><div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div><div><strong>{user.name}</strong><span>{user.email}</span></div></div><div className="menu-separator" /><button onClick={() => { setAccountOpen(false); setPreferencesOpen(true) }}><SlidersHorizontal size={17} /><span>风险评估与理财偏好</span><ChevronRight size={15} /></button><button onClick={logout}><LogOut size={17} /><span>退出登录</span></button></div>}
      </div></div>
    </header>

    <div className={`workspace ${sidebarOpen ? '' : 'sidebar-hidden'} ${page === 'watchlist' ? 'watchlist-workspace' : ''}`}>
      {page === 'chat' && <>
        {sidebarOpen && <button className="sidebar-overlay" aria-label="关闭侧栏" onClick={() => setSidebarOpen(false)} />}
        <aside className="sidebar" aria-label="研究记录">
          <div className="sidebar-title"><span>研究空间</span><button className="icon-button" aria-label="收起侧栏" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={17} /></button></div>
          <button className="new-chat-button" onClick={newChat}><SquarePen size={17} />开启新对话<Plus size={16} /></button>
          <button className="sidebar-search" onClick={() => setSearchOpen(!searchOpen)}><Search size={16} /><span>搜索对话</span></button>
          {searchOpen && <input className="chat-search-input" aria-label="搜索研究记录" autoFocus placeholder="输入对话关键词" value={chatSearch} onChange={e => setChatSearch(e.target.value)} />}
          <div className="tree-scroll">
            {filteredConversations.some(c => c.group === 'recent') && <div className="tree-group"><div className="tree-section-label">最近对话</div>{filteredConversations.filter(c => c.group === 'recent').map(conversationButton)}</div>}
            <div className="tree-section-label">我的研究 <span>示例</span></div>
            <button className="folder-button" aria-expanded={companyOpen} onClick={() => setCompanyOpen(!companyOpen)}>{companyOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{companyOpen ? <FolderOpen size={16} /> : <Folder size={16} />}<span>公司研究</span><small>{filteredConversations.filter(c => c.group === 'company').length}</small></button>
            {companyOpen && <div className="tree-children">{filteredConversations.filter(c => c.group === 'company').map(conversationButton)}</div>}
            <button className="folder-button" aria-expanded={notesOpen} onClick={() => setNotesOpen(!notesOpen)}>{notesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<Folder size={16} /><span>知识笔记</span><small>{filteredConversations.filter(c => c.group === 'notes').length}</small></button>
            {notesOpen && <div className="tree-children">{filteredConversations.filter(c => c.group === 'notes').map(conversationButton)}</div>}
            {chatSearch && filteredConversations.length === 0 && <p className="sidebar-empty">没有找到相关对话</p>}
          </div>
          <div className="sidebar-bottom"><div className="trust-note"><ShieldCheck size={18} /><div><strong>让研究有据可循</strong><p>关注事实，也看见不确定性。</p></div></div><button className="profile-summary" onClick={() => setPreferencesOpen(true)}><span className="mini-avatar"><UserRound size={16} /></span><span><strong>{user.name}</strong><small>{preferences.configured ? '我的偏好' : '默认偏好'} · {riskLabels[preferences.risk]}</small></span><Settings2 size={16} /></button></div>
        </aside>
      </>}

      {page === 'chat' ? <main className={`chat-main ${active ? 'has-conversation' : ''}`}>
        <div className="chat-topline"><div>{!sidebarOpen && <button className="icon-button" aria-label="展开侧栏" onClick={() => setSidebarOpen(true)}><PanelLeftOpen size={18} /></button>}<span>{active ? active.title : '研究助手'}</span><span className="topline-divider" /><span className="subtle-text">一个更清晰的市场视角</span></div><button className="view-preferences" onClick={() => setPreferencesOpen(true)}><ShieldCheck size={14} />{riskLabels[preferences.risk]}<ChevronDown size={13} /></button></div>
        {active ? <div className="message-scroll" aria-live="polite"><div className="message-list">{active.messages.map(message => <article className={`message ${message.role}`} key={message.id}>
          {message.role === 'assistant' && <div className="assistant-identity"><Logo /><strong>EquityLens</strong><span>{message.runId ? '固定年报样本 · 规则分析' : '演示回答'}</span></div>}
          {message.runId ? <ResearchRunMessage key={message.runId} runId={message.runId} onEvidence={setEvidenceId} onStatus={(id, busy) => setBusyRuns(current => current[id] === busy ? current : { ...current, [id]: busy })} onRetry={question => { setDraft(question); composerRef.current?.focus() }} /> : <div className="message-text">{message.text}</div>}
          {message.role === 'assistant' && !message.runId && <div className="message-actions"><button aria-label="复制回答" onClick={() => copyMessage(message.id, message.text)}>{copiedId === message.id ? <CheckCheck size={15} /> : <Copy size={15} />}</button><span>未连接实时数据</span></div>}
        </article>)}<div ref={chatBottomRef} /></div></div> : <div className="welcome-area"><div className="welcome-inner"><div className="hero-brand"><Logo large /><span className="hero-kicker">看见数据背后的逻辑</span></div><h1>从一个好问题，<span>开始研究。</span></h1><p className="hero-description">关于公司、财报与市场，和 EquityLens 一起看得更清楚。</p>
          <div className="suggestion-grid">
            {[{ icon: TrendingUp, title: '研究贵州茅台', text: '2025 / 2024 年度经营表现与风险', prompt: '分析贵州茅台最近两期的经营表现和主要风险' }, { icon: FileText, title: '核对经营指标', text: '查看原始数字、单位与同比公式', prompt: '分析贵州茅台两期年度经营指标和风险' }, { icon: BookOpen, title: '追溯年报证据', text: '结合现金流说明，理解分析边界', prompt: '分析贵州茅台2025年报的经营表现和主要风险' }].map(({ icon: Icon, title, text, prompt }) => <button className="suggestion-card" key={title} onClick={() => { setDraft(prompt); composerRef.current?.focus() }}><span className="suggestion-icon"><Icon size={20} /></span><strong>{title}</strong><p>{text}</p><ArrowUp size={15} className="suggestion-arrow" /></button>)}
          </div>
          <div className="starter-questions"><span>也可以问</span>{['分析贵州茅台最近两期的经营表现和主要风险'].map(text => <button key={text} onClick={() => { setDraft(text); composerRef.current?.focus() }}>{text}<ArrowRight size={13} /></button>)}</div>
        </div></div>}
        <div className="composer-area">{serviceError && <p className="research-error" role="alert">{serviceError}</p>}<p className="research-scope">首个研究样本：贵州茅台 · 2025 / 2024 完整年度（“最近两期”采用此固定范围）</p><div className={`composer ${draft ? 'has-input' : ''}`}><textarea ref={composerRef} aria-label="输入研究问题" placeholder="提出一个问题，开启你的研究…" rows={2} maxLength={2000} value={draft} onChange={e => { setDraft(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px` }} onKeyDown={onComposerKey} />
          <div className="composer-toolbar"><div className="mode-wrap"><button className={`mode-button ${modeOpen ? 'selected' : ''}`} aria-expanded={modeOpen} onClick={() => setModeOpen(!modeOpen)}><Sparkles size={15} /><span>{mode}</span><ChevronDown size={12} /></button>{modeOpen && <div className="mode-menu">{['综合研究', '快速问答', '财报解读'].map(value => <button key={value} onClick={() => { setMode(value); setModeOpen(false) }}>{value}{mode === value && <Check size={14} />}</button>)}<small>模式切换为界面演示</small></div>}</div><div className="composer-right"><span>Enter 发送</span><button className="send-button" disabled={!draft.trim() || sending || activeBusy} aria-label="发送消息" onClick={sendMessage}>{sending ? <span className="spinner" /> : <ArrowUp size={19} />}</button></div></div>
        </div><div className="composer-footnote"><ShieldCheck size={12} /><span>内容仅供研究参考</span><span className="footnote-dot">·</span><span>固定年报样本，尚未接入模型与实时数据</span></div></div>
      </main> : <main className="watchlist-page"><div className="watchlist-content"><div className="page-breadcrumb">我的工作台 <ChevronRight size={13} /> 自选股</div><div className="watchlist-heading"><div><div className="eyebrow">YOUR WATCHLIST</div><h1>关注值得研究的公司<span>.</span></h1><p>把线索留在这里，让研究持续发生。</p></div><button className="primary-button" onClick={() => setStockPickerOpen(true)}><Plus size={17} />添加自选股</button></div>
        <div className="watchlist-summary"><div><span className="summary-icon"><Star size={20} /></span><div><span>我的自选</span><strong>{watchlist.length}<small>家公司</small></strong></div></div><div><span className="summary-icon"><FolderOpen size={20} /></span><div><span>研究记录</span><strong>{conversations.length}<small>段对话</small></strong></div></div><div className="summary-tip"><ShieldCheck size={21} /><div><strong>研究从可靠的信息开始</strong><p>行情与涨跌幅暂留空，等待接入真实数据。</p></div></div></div>
        <section className="watchlist-table-card"><div className="table-toolbar"><div className="table-title">全部自选 <span>{watchlist.length}</span></div><div className="search-input compact"><Search size={15} /><input aria-label="搜索我的自选" placeholder="搜索名称或代码" value={watchSearch} onChange={e => setWatchSearch(e.target.value)} /></div></div><div className="table-scroll"><table><thead><tr><th>公司 / 代码</th><th>行业</th><th>最新价</th><th>涨跌幅</th><th>研究</th><th><span className="sr-only">操作</span></th></tr></thead><tbody>{stocks.filter(s => watchlist.includes(s.code) && `${s.name}${s.code}`.toLowerCase().includes(watchSearch.toLowerCase())).map(stock => <tr key={stock.code}><td><div className="stock-cell"><span className="stock-initial">{stock.initials}</span><span className="stock-name"><strong>{stock.name}</strong><span>{stock.code}</span></span></div></td><td><span className="sector-pill">{stock.sector}</span></td><td className="data-placeholder">—</td><td className="data-placeholder">—</td><td><button className="research-button" onClick={() => startResearch(stock)}><Sparkles size={14} />开始研究<ArrowUp size={13} /></button></td><td><button className="icon-button remove-stock" aria-label={`移除自选 ${stock.name}`} onClick={() => { updateWatchlist(watchlist.filter(code => code !== stock.code)); notify(`已移除${stock.name}`) }}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>
          {stocks.filter(s => watchlist.includes(s.code) && `${s.name}${s.code}`.toLowerCase().includes(watchSearch.toLowerCase())).length === 0 && <div className="empty-watchlist"><Star size={30} /><h3>{watchSearch ? '没有找到相关自选股' : '你的研究清单，等待第一家公司'}</h3><p>{watchSearch ? '试试其他名称或股票代码。' : '添加一只自选股，从这里开始持续关注。'}</p>{!watchSearch && <button className="secondary-button" onClick={() => setStockPickerOpen(true)}><Plus size={15} />添加自选股</button>}</div>}
          <div className="table-footer"><span><span className="status-dot" />示例股票列表</span><span>— 表示尚未接入行情数据</span></div></section>
        <div className="watchlist-bottom"><BookOpen size={17} /><span>从一份财报、一个问题开始，逐步建立自己的研究记录。</span><button onClick={newChat}>去聊一聊 <ArrowRight size={14} /></button></div>
      </div></main>}
    </div>
    {evidenceId && <EvidenceDrawer key={evidenceId} evidenceId={evidenceId} onClose={() => setEvidenceId(null)} />}
    {preferencesOpen && <PreferencesPanel value={preferences} onClose={() => setPreferencesOpen(false)} onSave={next => { setPreferences(next); writeStorage(`equitylens.preferences.${user.email.toLowerCase()}`, next); setPreferencesOpen(false); notify('理财偏好已保存') }} />}
    {stockPickerOpen && <StockPicker selected={watchlist} onClose={() => setStockPickerOpen(false)} onAdd={stock => { updateWatchlist([...watchlist, stock.code]); notify(`已添加${stock.name}`) }} />}
    {toast && <div role="status" className="toast"><Check size={16} />{toast}</div>}
  </div>
}
