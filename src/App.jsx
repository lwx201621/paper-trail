import { useEffect, useMemo, useRef, useState } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import {
  ArchiveRestore,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Database,
  Download,
  ExternalLink,
  FileText,
  HardDrive,
  LayoutDashboard,
  Library,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Timer,
  TrendingUp,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { loadState, saveState } from './db.js'
import { decryptState, encryptState } from './backupCrypto.js'
import {
  ROLE_OPTIONS,
  STATUS_MAP,
  STATUS_OPTIONS,
  bestQuartile,
  buildDemoState,
  computeStats,
  computeInsights,
  currentSubmission,
  daysBetween,
  emptyState,
  latestMetric,
  parseJournalCsv,
  today,
  uid,
} from './domain.js'

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, CanvasRenderer])

const NAV_ITEMS = [
  { id: 'dashboard', label: '总览', icon: LayoutDashboard },
  { id: 'papers', label: '论文', icon: FileText },
  { id: 'insights', label: '分析', icon: BarChart3 },
  { id: 'journals', label: '期刊库', icon: Library },
  { id: 'backup', label: '备份', icon: ArchiveRestore },
]

const PAGE_META = {
  dashboard: { eyebrow: 'OVERVIEW', title: '我的投稿轨迹', subtitle: '所有论文、状态与时间，都在一处。' },
  papers: { eyebrow: 'MANUSCRIPTS', title: '论文与投稿', subtitle: '一篇论文可以拥有多次独立投稿记录。' },
  insights: { eyebrow: 'INSIGHTS', title: '研究分析', subtitle: '从投稿周期、决策结果与成果结构理解你的研究进展。' },
  journals: { eyebrow: 'JOURNAL LIBRARY', title: '期刊指标库', subtitle: '按年度保存 JCR 指标与多学科分区。' },
  backup: { eyebrow: 'LOCAL DATA', title: '数据与备份', subtitle: '数据仅保存在当前浏览器中。' },
}

function formatDate(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

function downloadFile(name, content, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function StatusPill({ status }) {
  const meta = STATUS_MAP[status] || { label: status || '未开始', tone: 'neutral' }
  return <span className={`status-pill status-${meta.tone}`}><span />{meta.label}</span>
}

function QuartileBadge({ value, muted = false }) {
  const normalized = value === '—' ? 'N/A' : value
  return <span className={`quartile-badge q-${normalized.toLowerCase().replace('/', '')} ${muted ? 'muted' : ''}`}>{normalized}</span>
}

function Modal({ title, subtitle, children, onClose, wide = false }) {
  useEffect(() => {
    const handler = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <div><p className="eyebrow">NEW RECORD</p><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>
        {children}
      </section>
    </div>
  )
}

function Field({ label, children, hint, className = '' }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

function AppShell({ page, setPage, data, children, onNewPaper }) {
  const meta = PAGE_META[page]
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="wordmark" onClick={() => setPage('dashboard')} aria-label="返回总览">
            <strong>WENXUAN LI</strong>
            <span>Paper Trail</span>
          </button>
          <nav className="desktop-nav" aria-label="主导航">
            {NAV_ITEMS.map(({ id, label }) => (
              <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>{label}</button>
            ))}
          </nav>
          <div className="topbar-actions">
            <div className="local-indicator"><ShieldCheck size={14} /><span>仅本地保存</span><i /></div>
            <button className="primary-button" onClick={onNewPaper}><Plus size={16} />新增论文</button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <header className="page-header">
          <div><p className="eyebrow">{meta.eyebrow}</p><h1>{meta.title}<span>.</span></h1><p>{meta.subtitle}</p></div>
          <div className="page-context"><span>{data.papers.length}</span> papers <i /> <span>{data.papers.reduce((sum, paper) => sum + paper.submissions.length, 0)}</span> submissions</div>
        </header>
        {children}
      </main>

      <nav className="mobile-nav">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><Icon size={19} /><span>{label}</span></button>
        ))}
      </nav>
    </div>
  )
}

function MetricCard({ label, value, detail, icon: Icon, accent = false }) {
  return (
    <article className={`metric-card ${accent ? 'accent' : ''}`}>
      <div className="metric-top"><span>{label}</span><Icon size={17} /></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function Dashboard({ data, setPage, onUpdate }) {
  const stats = useMemo(() => computeStats(data), [data])
  const paperRows = useMemo(() => data.papers.map((paper) => {
    const submission = currentSubmission(paper)
    const journal = data.journals.find((item) => item.id === submission?.journalId)
    const lastEvent = submission?.events?.at(-1)
    return { paper, submission, journal, lastEvent }
  }).filter((item) => item.submission), [data])

  const recentEvents = useMemo(() => data.papers.flatMap((paper) => paper.submissions.flatMap((submission) =>
    submission.events.map((event) => ({ ...event, paper, submission }))))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5), [data])

  const deadlines = paperRows.filter(({ lastEvent, submission }) => lastEvent?.deadline && STATUS_MAP[submission.status]?.action)
    .sort((a, b) => a.lastEvent.deadline.localeCompare(b.lastEvent.deadline))

  const years = Object.keys(stats.years).sort()
  const trendOption = {
    animationDuration: 700,
    grid: { left: 4, right: 10, top: 20, bottom: 6, containLabel: true },
    tooltip: { trigger: 'axis', backgroundColor: '#232d4b', borderWidth: 0, textStyle: { color: '#fff' } },
    xAxis: { type: 'category', data: years, axisLine: { lineStyle: { color: '#e3e6ea' } }, axisTick: { show: false }, axisLabel: { color: '#57606a' } },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#e3e6ea', type: 'dashed' } }, axisLabel: { color: '#7a828c' } },
    series: [
      { name: '投稿次数', type: 'bar', barWidth: 18, data: years.map((year) => stats.years[year].submissions), itemStyle: { color: '#232d4b', borderRadius: [3, 3, 0, 0] } },
      { name: '已接收', type: 'line', smooth: true, data: years.map((year) => stats.years[year].accepted), symbolSize: 7, lineStyle: { color: '#e57200', width: 2 }, itemStyle: { color: '#e57200' } },
    ],
  }
  const quartileData = Object.entries(stats.quartiles).filter(([, value]) => value > 0).map(([name, value]) => ({ name, value }))
  const quartileOption = {
    animationDuration: 700,
    tooltip: { trigger: 'item', backgroundColor: '#232d4b', borderWidth: 0, textStyle: { color: '#fff' } },
    color: ['#232d4b', '#5477a6', '#b1824d', '#a95743', '#cfd3d8'],
    series: [{ type: 'pie', radius: ['58%', '78%'], center: ['50%', '48%'], itemStyle: { borderColor: '#ffffff', borderWidth: 4 }, label: { show: false }, data: quartileData.length ? quartileData : [{ name: '暂无', value: 1, itemStyle: { color: '#e3e6ea' } }] }],
  }

  return (
    <div className="dashboard-stack">
      <section className="metrics-grid">
        <MetricCard label="论文总数" value={stats.papers} detail={`${stats.attempts} 次投稿记录`} icon={FileText} />
        <MetricCard label="当前在投" value={stats.active} detail="包括修回阶段" icon={Send} accent />
        <MetricCard label="已经接收" value={stats.accepted} detail={`${stats.published} 篇已正式上线`} icon={CheckCircle2} />
        <MetricCard label="期刊库" value={data.journals.length} detail={`${Object.values(stats.quartiles).reduce((sum, value) => sum + value, 0)} 条当前匹配`} icon={BookOpen} />
      </section>

      <section className="dashboard-grid">
        <article className="panel trend-panel">
          <div className="panel-heading"><div><p className="eyebrow">PACE</p><h2>年度投稿节奏</h2></div><div className="legend"><span className="legend-bar">投稿次数</span><span className="legend-line">已接收</span></div></div>
          <ReactEChartsCore echarts={echarts} option={trendOption} style={{ height: 245 }} />
        </article>
        <article className="panel quartile-panel">
          <div className="panel-heading"><div><p className="eyebrow">JCR MIX</p><h2>当前投稿分区</h2></div></div>
          <div className="quartile-chart-wrap">
            <ReactEChartsCore echarts={echarts} option={quartileOption} style={{ height: 210, width: 210 }} />
            <div className="quartile-center"><strong>{stats.papers}</strong><span>篇论文</span></div>
            <div className="quartile-legend">
              {Object.entries(stats.quartiles).map(([name, value]) => <div key={name}><QuartileBadge value={name === '未分区' ? '—' : name} muted={!value} /><span>{value} 篇</span></div>)}
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-grid lower">
        <article className="panel current-panel">
          <div className="panel-heading"><div><p className="eyebrow">IN PROGRESS</p><h2>正在进行</h2></div><button className="text-button" onClick={() => setPage('papers')}>查看全部 <ArrowUpRight size={15} /></button></div>
          <div className="compact-table">
            {paperRows.filter(({ submission }) => STATUS_MAP[submission.status]?.active).slice(0, 4).map(({ paper, submission, journal, lastEvent }) => (
              <div className="compact-row" key={paper.id}>
                <div className="paper-monogram">{paper.shortTitle.slice(0, 1).toUpperCase()}</div>
                <div className="compact-title"><strong>{paper.shortTitle}</strong><span>{journal?.name || submission.journalName}</span></div>
                <QuartileBadge value={bestQuartile(latestMetric(journal))} />
                <StatusPill status={submission.status} />
                <span className="days-cell">{daysBetween(lastEvent?.date)} 天</span>
                <button className="row-action" onClick={() => onUpdate(paper, submission)}>更新</button>
              </div>
            ))}
            {!paperRows.some(({ submission }) => STATUS_MAP[submission.status]?.active) && <EmptyInline text="还没有进行中的投稿" />}
          </div>
        </article>
        <article className="panel side-list-panel">
          <div className="panel-heading"><div><p className="eyebrow">NEXT</p><h2>{deadlines.length ? '最近截止' : '最近动态'}</h2></div></div>
          <div className="activity-list">
            {(deadlines.length ? deadlines.slice(0, 4).map(({ paper, lastEvent, submission }) => ({ paper, submission, ...lastEvent })) : recentEvents).map((event) => (
              <div className="activity-item" key={event.id}>
                <div className="activity-dot" />
                <div><strong>{event.paper.shortTitle}</strong><span>{STATUS_MAP[event.status]?.label || event.status}{event.note ? ` · ${event.note}` : ''}</span></div>
                <time>{event.deadline ? `截止 ${formatDate(event.deadline)}` : formatDate(event.date)}</time>
              </div>
            ))}
            {!recentEvents.length && <EmptyInline text="更新状态后，动态会出现在这里" />}
          </div>
        </article>
      </section>
    </div>
  )
}

function InsightsPage({ data, setPage }) {
  const insights = useMemo(() => computeInsights(data), [data])
  const statusEntries = Object.entries(insights.statusCounts).sort((a, b) => b[1] - a[1])
  const roleEntries = Object.entries(insights.roleCounts).sort((a, b) => b[1] - a[1])
  const publisherEntries = Object.entries(insights.publisherCounts).sort((a, b) => b[1] - a[1])
  const statusOption = {
    animationDuration: 650,
    grid: { left: 8, right: 20, top: 10, bottom: 5, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#232d4b', borderWidth: 0, textStyle: { color: '#fff' } },
    xAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#e3e6ea', type: 'dashed' } }, axisLabel: { color: '#7a828c' } },
    yAxis: { type: 'category', data: statusEntries.map(([name]) => name), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: '#57606a', fontFamily: 'Helvetica Neue' } },
    series: [{ type: 'bar', barWidth: 12, data: statusEntries.map(([, value]) => value), itemStyle: { color: '#232d4b', borderRadius: [0, 3, 3, 0] } }],
  }
  const roleOption = {
    animationDuration: 650,
    tooltip: { trigger: 'item', backgroundColor: '#232d4b', borderWidth: 0, textStyle: { color: '#fff' } },
    color: ['#232d4b', '#5477a6', '#8b91a2', '#b1824d', '#cfd3d8'],
    series: [{ type: 'pie', radius: ['58%', '78%'], center: ['44%', '50%'], label: { show: false }, itemStyle: { borderColor: '#fff', borderWidth: 4 }, data: roleEntries.map(([name, value]) => ({ name, value })) }],
  }
  return <div className="insights-stack">
    <section className="insight-kpis">
      <article><span>投稿接收率</span><strong>{insights.acceptanceRate == null ? '—' : `${insights.acceptanceRate}%`}</strong><small>{insights.acceptedAttempts} 次接收 / {insights.rejectedAttempts} 次拒稿</small></article>
      <article><span>首次决定中位数</span><strong>{insights.medianFirstDecision ?? '—'}<em>{insights.medianFirstDecision != null ? '天' : ''}</em></strong><small>从首次提交到首轮决定</small></article>
      <article><span>接收周期中位数</span><strong>{insights.medianAcceptance ?? '—'}<em>{insights.medianAcceptance != null ? '天' : ''}</em></strong><small>从投稿到正式接收</small></article>
      <article><span>累计修回轮次</span><strong>{insights.revisionRounds}</strong><small>大修与小修事件总计</small></article>
    </section>

    <section className="analysis-grid">
      <article className="analysis-block">
        <div className="section-title"><div><p className="eyebrow">PIPELINE</p><h2>当前状态结构</h2></div><TrendingUp size={18} /></div>
        {statusEntries.length ? <ReactEChartsCore echarts={echarts} option={statusOption} style={{ height: 260 }} /> : <EmptyInline text="录入投稿后显示状态结构" />}
      </article>
      <article className="analysis-block">
        <div className="section-title"><div><p className="eyebrow">AUTHORSHIP</p><h2>作者身份构成</h2></div></div>
        <div className="role-chart">
          {roleEntries.length ? <ReactEChartsCore echarts={echarts} option={roleOption} style={{ height: 245, width: 245 }} /> : <EmptyInline text="暂无作者身份数据" />}
          <div className="role-legend">{roleEntries.map(([name, value], index) => <div key={name}><i style={{ '--role-color': ['#232d4b', '#5477a6', '#8b91a2', '#b1824d', '#cfd3d8'][index % 5] }} /><span>{name}</span><strong>{value}</strong></div>)}</div>
        </div>
      </article>
    </section>

    <section className="analysis-grid lower-analysis">
      <article className="analysis-block attention-block">
        <div className="section-title"><div><p className="eyebrow">ATTENTION</p><h2>需要留意</h2></div><span>{insights.attention.length}</span></div>
        <div className="attention-list">
          {insights.attention.slice(0, 8).map((item) => <div className={`attention-row severity-${item.severity}`} key={item.id}><i /><div><strong>{item.paper.shortTitle}</strong><span>{item.kind} · {item.detail}</span></div><small>{item.submission.journalName}</small></div>)}
          {!insights.attention.length && <div className="all-clear"><CheckCircle2 size={21} /><div><strong>目前没有需要处理的事项</strong><span>截止日期、长期停留和缺失信息会出现在这里。</span></div></div>}
        </div>
        {!!insights.attention.length && <button className="text-button" onClick={() => setPage('papers')}>前往论文列表 <ArrowUpRight size={14} /></button>}
      </article>
      <article className="analysis-block publisher-block">
        <div className="section-title"><div><p className="eyebrow">PUBLISHERS</p><h2>出版社分布</h2></div></div>
        <div className="rank-list">
          {publisherEntries.map(([name, value], index) => <div key={name}><span>{String(index + 1).padStart(2, '0')}</span><strong>{name}</strong><em>{value} 篇</em><i style={{ width: `${Math.max(8, (value / Math.max(...publisherEntries.map((entry) => entry[1]), 1)) * 100)}%` }} /></div>)}
          {!publisherEntries.length && <EmptyInline text="暂无出版社数据" />}
        </div>
      </article>
    </section>
  </div>
}

function EmptyInline({ text }) {
  return <div className="empty-inline"><span>·</span>{text}</div>
}

function PapersPage({ data, onUpdate, onAddSubmission, onEdit, onDeletePaper }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const rows = data.papers.filter((paper) => {
    const submission = currentSubmission(paper)
    const text = `${paper.title} ${paper.shortTitle} ${submission?.journalName || ''}`.toLowerCase()
    const matchesText = text.includes(query.toLowerCase())
    const meta = STATUS_MAP[submission?.status]
    const matchesFilter = filter === 'all' || (filter === 'active' && meta?.active) || (filter === 'accepted' && meta?.accepted) || (filter === 'closed' && meta?.closed)
    return matchesText && matchesFilter
  })

  return (
    <section className="papers-section">
      <div className="toolbar">
        <div className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索论文、期刊或编号" /></div>
        <div className="segmented-control">
          {[['all', '全部'], ['active', '在投'], ['accepted', '已接收'], ['closed', '已结束']].map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
      </div>

      <div className="papers-list">
        {rows.map((paper) => {
          const submission = currentSubmission(paper)
          const journal = data.journals.find((item) => item.id === submission?.journalId)
          const event = submission?.events?.at(-1)
          const isOpen = expanded === paper.id
          return (
            <article className={`paper-card ${isOpen ? 'expanded' : ''}`} key={paper.id}>
              <div className="paper-main-row">
                <button className="expand-button" onClick={() => setExpanded(isOpen ? null : paper.id)} aria-label={isOpen ? '收起' : '展开'}>{isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
                <div className="paper-identity" onClick={() => setExpanded(isOpen ? null : paper.id)}>
                  <div className="paper-kicker"><span>{paper.field || '未分类'}</span><span>{paper.role}</span></div>
                  <h3>{paper.shortTitle || paper.title}</h3>
                  <p>{paper.title}</p>
                </div>
                <div className="paper-journal"><span>当前期刊</span><strong>{submission?.journalName || '尚未投稿'}</strong><small>{submission?.manuscriptId || '—'}</small></div>
                <div className="paper-quartile"><span>JCR</span><QuartileBadge value={bestQuartile(latestMetric(journal))} /></div>
                <div className="paper-status"><span>当前状态</span>{submission ? <StatusPill status={submission.status} /> : <span>—</span>}<small>{event ? `${daysBetween(event.date)} 天前更新` : ''}</small></div>
                <div className="paper-actions">
                  {submission?.url && <a className="secondary-button" href={submission.url} target="_blank" rel="noreferrer"><ExternalLink size={15} />查看</a>}
                  {submission && <button className="primary-button small" onClick={() => onUpdate(paper, submission)}>更新</button>}
                </div>
              </div>
              {isOpen && (
                <div className="paper-detail">
                  <div className="submission-history">
                    <div className="detail-heading"><h4>投稿记录</h4><div className="detail-actions"><button className="text-button" onClick={() => onEdit(paper, submission)}><Pencil size={14} />编辑信息</button><button className="text-button" onClick={() => onAddSubmission(paper)}><Plus size={15} />新增转投</button></div></div>
                    {paper.submissions.map((item, index) => {
                      const itemJournal = data.journals.find((journalItem) => journalItem.id === item.journalId)
                      return <div className="submission-chip" key={item.id}><span>{index + 1}</span><div><strong>{item.journalName}</strong><small>{formatDate(item.submittedAt)} · {item.manuscriptId || '暂无编号'}</small></div><QuartileBadge value={bestQuartile(latestMetric(itemJournal))} /><StatusPill status={item.status} /></div>
                    })}
                  </div>
                  <div className="timeline-wrap">
                    <div className="detail-heading"><h4>当前投稿时间线</h4><span>{submission?.round || 'R0'}</span></div>
                    <div className="timeline">
                      {[...(submission?.events || [])].reverse().map((item, index) => (
                        <div className="timeline-item" key={item.id}><div className={`timeline-marker ${index === 0 ? 'latest' : ''}`}><Check size={12} /></div><div><strong>{STATUS_MAP[item.status]?.label || item.status}</strong><span>{formatDate(item.date)}{item.deadline ? ` · 截止 ${formatDate(item.deadline)}` : ''}</span>{item.note && <p>{item.note}</p>}</div></div>
                      ))}
                    </div>
                  </div>
                  <button className="danger-text-button" onClick={() => onDeletePaper(paper)}><Trash2 size={15} />删除整篇论文</button>
                </div>
              )}
            </article>
          )
        })}
        {!rows.length && <div className="empty-state"><FileText size={28} /><h3>没有找到论文</h3><p>调整筛选条件，或新增第一篇论文。</p></div>}
      </div>
    </section>
  )
}

function JournalsPage({ data, onNewJournal, onImportCsv }) {
  const fileRef = useRef(null)
  const [query, setQuery] = useState('')
  const journals = data.journals.filter((journal) => `${journal.name} ${journal.publisher} ${journal.issn}`.toLowerCase().includes(query.toLowerCase()))
  return (
    <section>
      <div className="toolbar">
        <div className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索期刊、出版社或 ISSN" /></div>
        <div className="toolbar-actions"><input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onImportCsv} /><button className="secondary-button" onClick={() => fileRef.current?.click()}><Upload size={16} />导入 JCR CSV</button><button className="primary-button small" onClick={onNewJournal}><Plus size={16} />新增期刊</button></div>
      </div>
      <div className="journal-grid">
        {journals.map((journal) => {
          const metric = latestMetric(journal)
          return <article className="journal-card" key={journal.id}>
            <div className="journal-card-head"><div><span>{journal.publisher || '未知出版社'}</span><h3>{journal.name}</h3><small>{journal.issn || '暂无 ISSN'}</small></div><div className="journal-head-actions"><QuartileBadge value={bestQuartile(metric)} /><button onClick={() => onNewJournal(journal)}>+ 指标</button></div></div>
            <div className="jif-row"><div><span>JIF</span><strong>{metric?.jif ?? '—'}</strong></div><div><span>JCR 版本</span><strong>{metric?.editionYear ?? '—'}</strong></div><div><span>数据年</span><strong>{metric?.dataYear ?? '—'}</strong></div></div>
            <div className="category-list">
              {(metric?.categories || []).map((category) => <div key={`${category.name}-${category.quartile}`}><span>{category.name}</span><strong>{category.quartile || '—'}</strong><small>{category.rank && category.total ? `${category.rank} / ${category.total}` : ''}</small></div>)}
              {!metric?.categories?.length && <EmptyInline text="还没有 JCR 分类数据" />}
            </div>
          </article>
        })}
        {!journals.length && <div className="empty-state wide"><Library size={28} /><h3>期刊库还是空的</h3><p>手动新增期刊，或导入 JCR CSV。</p></div>}
      </div>
      <aside className="csv-hint"><Database size={18} /><div><strong>CSV 字段格式</strong><span>journal, issn, publisher, jcrYear, dataYear, jif, category, quartile, rank, total</span></div></aside>
    </section>
  )
}

function BackupPage({ data, onRestore, onEncrypt, onClearDemo, onClearAll }) {
  const fileRef = useRef(null)
  const exportJson = () => downloadFile(`paper-trail-backup-${today()}.json`, JSON.stringify(data, null, 2))
  const exportCsv = () => {
    const header = ['论文标题', '简称', '作者身份', '研究方向', '期刊', '投稿编号', '投稿日期', '状态', '轮次', 'DOI']
    const rows = data.papers.flatMap((paper) => paper.submissions.map((submission) => [paper.title, paper.shortTitle, paper.role, paper.field, submission.journalName, submission.manuscriptId, submission.submittedAt, STATUS_MAP[submission.status]?.label, submission.round, submission.doi]))
    const escape = (value) => `"${String(value || '').replaceAll('"', '""')}"`
    downloadFile(`paper-trail-records-${today()}.csv`, `\ufeff${[header, ...rows].map((row) => row.map(escape).join(',')).join('\n')}`, 'text/csv;charset=utf-8')
  }
  const deadlines = data.papers.map((paper) => ({ paper, submission: currentSubmission(paper) })).filter(({ submission }) => {
    const event = submission?.events?.at(-1)
    return event?.deadline && STATUS_MAP[submission.status]?.action
  })
  const exportCalendar = () => {
    const escapeIcs = (value) => String(value || '').replaceAll('\\', '\\\\').replaceAll(',', '\\,').replaceAll(';', '\\;').replaceAll('\n', '\\n')
    const events = deadlines.map(({ paper, submission }) => {
      const event = submission.events.at(-1)
      return ['BEGIN:VEVENT', `UID:${submission.id}@paper-trail`, `DTSTAMP:${today().replaceAll('-', '')}T000000Z`, `DTSTART;VALUE=DATE:${event.deadline.replaceAll('-', '')}`, `SUMMARY:${escapeIcs(`修回截止：${paper.shortTitle}`)}`, `DESCRIPTION:${escapeIcs(`${submission.journalName} · ${STATUS_MAP[submission.status]?.label}${event.note ? ` · ${event.note}` : ''}`)}`, submission.url ? `URL:${submission.url}` : '', 'END:VEVENT'].filter(Boolean).join('\r\n')
    }).join('\r\n')
    downloadFile(`paper-trail-deadlines-${today()}.ics`, `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nCALSCALE:GREGORIAN\r\nPRODID:-//Paper Trail//Research Deadlines//ZH\r\n${events}\r\nEND:VCALENDAR`, 'text/calendar;charset=utf-8')
  }
  return (
    <section className="backup-grid">
      <article className="backup-hero">
        <div className="backup-icon"><HardDrive size={28} /></div>
        <p className="eyebrow">YOUR DATA, YOUR DEVICE</p><h2>没有服务器，也没有账户。</h2>
        <p>论文、投稿链接与 JCR 数据保存在此浏览器的 IndexedDB 中。GitHub 仓库和 Pages 部署不会包含这些内容。</p>
        <div className="backup-stats"><div><strong>{data.papers.length}</strong><span>篇论文</span></div><div><strong>{data.papers.reduce((sum, paper) => sum + paper.submissions.length, 0)}</strong><span>次投稿</span></div><div><strong>{data.journals.length}</strong><span>本期刊</span></div></div>
      </article>
      <div className="backup-actions-grid">
        <article className="backup-action"><Download size={22} /><h3>完整备份</h3><p>普通 JSON 方便迁移；加密备份适合存进网盘或长期归档。</p><div className="backup-button-row"><button className="primary-button" onClick={exportJson}>导出 JSON</button><button className="secondary-button" onClick={onEncrypt}><LockKeyhole size={14} />加密</button></div></article>
        <article className="backup-action"><BarChart3 size={22} /><h3>统计与日历</h3><p>导出 Excel 可读的投稿表，或把修回截止日期加入日历。</p><div className="backup-button-row"><button className="secondary-button" onClick={exportCsv}>CSV</button><button className="secondary-button" onClick={exportCalendar} disabled={!deadlines.length}><CalendarDays size={14} />截止日历</button></div></article>
        <article className="backup-action"><Upload size={22} /><h3>恢复数据</h3><p>支持普通或 AES-256 加密备份；恢复前会再次确认。</p><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onRestore} /><button className="secondary-button" onClick={() => fileRef.current?.click()}>选择备份</button></article>
        <article className="backup-action danger"><Trash2 size={22} /><h3>清理数据</h3><p>{data.demo ? '当前包含演示数据，可以一键清空后正式使用。' : '永久清空此浏览器中的全部记录。请先导出备份。'}</p><button className="danger-button" onClick={data.demo ? onClearDemo : onClearAll}>{data.demo ? '清空演示数据' : '清空全部数据'}</button></article>
      </div>
    </section>
  )
}

function NewPaperModal({ data, onClose, onSave }) {
  const [form, setForm] = useState({ title: '', shortTitle: '', field: '', role: '第一作者', tags: '', journalName: '', publisher: '', issn: '', url: '', manuscriptId: '', submittedAt: today(), status: 'submitted' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submit = (event) => { event.preventDefault(); if (form.title.trim()) onSave(form) }
  return <Modal title="新增论文" subtitle="可以现在填写首次投稿，也可以稍后添加。" onClose={onClose} wide>
    <form className="modal-form" onSubmit={submit}>
      <div className="form-section"><h3>论文信息</h3><div className="form-grid">
        <Field label="英文标题" className="span-2"><input required autoFocus value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Full manuscript title" /></Field>
        <Field label="论文简称"><input value={form.shortTitle} onChange={(event) => update('shortTitle', event.target.value)} placeholder="用于列表显示" /></Field>
        <Field label="作者身份"><select value={form.role} onChange={(event) => update('role', event.target.value)}>{ROLE_OPTIONS.map((role) => <option key={role}>{role}</option>)}</select></Field>
        <Field label="研究方向"><input value={form.field} onChange={(event) => update('field', event.target.value)} placeholder="如：单细胞组学" /></Field>
        <Field label="标签" hint="多个标签用逗号分隔"><input value={form.tags} onChange={(event) => update('tags', event.target.value)} placeholder="课题 A, 方法学" /></Field>
      </div></div>
      <div className="form-section"><h3>首次投稿（可选）</h3><div className="form-grid">
        <Field label="期刊名称"><input list="journal-options" value={form.journalName} onChange={(event) => update('journalName', event.target.value)} placeholder="输入或选择期刊" /><datalist id="journal-options">{data.journals.map((journal) => <option key={journal.id} value={journal.name} />)}</datalist></Field>
        <Field label="出版社"><input value={form.publisher} onChange={(event) => update('publisher', event.target.value)} placeholder="Elsevier / Springer Nature" /></Field>
        <Field label="投稿网站链接"><input type="url" value={form.url} onChange={(event) => update('url', event.target.value)} placeholder="https://..." /></Field>
        <Field label="Manuscript ID"><input value={form.manuscriptId} onChange={(event) => update('manuscriptId', event.target.value)} placeholder="可稍后补充" /></Field>
        <Field label="投稿日期"><input type="date" value={form.submittedAt} onChange={(event) => update('submittedAt', event.target.value)} /></Field>
        <Field label="当前状态"><select value={form.status} onChange={(event) => update('status', event.target.value)}>{STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></Field>
      </div></div>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" type="submit">保存论文</button></div>
    </form>
  </Modal>
}

function EditPaperModal({ paper, submission, onClose, onSave }) {
  const [form, setForm] = useState({ title: paper.title, shortTitle: paper.shortTitle, field: paper.field || '', role: paper.role, tags: (paper.tags || []).join(', '), url: submission?.url || '', manuscriptId: submission?.manuscriptId || '', submittedAt: submission?.submittedAt || '', doi: submission?.doi || '' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <Modal title="编辑论文信息" subtitle="修改论文信息和当前投稿的基本字段。状态变化仍通过时间线记录。" onClose={onClose} wide>
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (form.title.trim()) onSave(form) }}>
      <div className="form-section"><h3>论文信息</h3><div className="form-grid">
        <Field label="英文标题" className="span-2"><input required autoFocus value={form.title} onChange={(event) => update('title', event.target.value)} /></Field>
        <Field label="论文简称"><input value={form.shortTitle} onChange={(event) => update('shortTitle', event.target.value)} /></Field>
        <Field label="作者身份"><select value={form.role} onChange={(event) => update('role', event.target.value)}>{ROLE_OPTIONS.map((role) => <option key={role}>{role}</option>)}</select></Field>
        <Field label="研究方向"><input value={form.field} onChange={(event) => update('field', event.target.value)} /></Field>
        <Field label="标签"><input value={form.tags} onChange={(event) => update('tags', event.target.value)} /></Field>
      </div></div>
      {submission && <div className="form-section"><h3>当前投稿</h3><div className="form-grid">
        <Field label="投稿网站链接" className="span-2"><input type="url" value={form.url} onChange={(event) => update('url', event.target.value)} placeholder="https://..." /></Field>
        <Field label="Manuscript ID"><input value={form.manuscriptId} onChange={(event) => update('manuscriptId', event.target.value)} /></Field>
        <Field label="投稿日期"><input type="date" value={form.submittedAt} onChange={(event) => update('submittedAt', event.target.value)} /></Field>
        <Field label="DOI" className="span-2"><input value={form.doi} onChange={(event) => update('doi', event.target.value)} placeholder="10.xxxx/xxxxx" /></Field>
      </div></div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" type="submit">保存修改</button></div>
    </form>
  </Modal>
}

function SubmissionModal({ data, paper, onClose, onSave }) {
  const [form, setForm] = useState({ journalName: '', publisher: '', issn: '', url: '', manuscriptId: '', submittedAt: today(), status: 'submitted', round: 'R0' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <Modal title="新增投稿记录" subtitle={`为「${paper.shortTitle}」记录一次新投稿或转投。`} onClose={onClose}>
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (form.journalName.trim()) onSave(form) }}><div className="form-grid">
      <Field label="期刊名称" className="span-2"><input required autoFocus list="submission-journals" value={form.journalName} onChange={(event) => update('journalName', event.target.value)} /><datalist id="submission-journals">{data.journals.map((journal) => <option key={journal.id} value={journal.name} />)}</datalist></Field>
      <Field label="出版社"><input value={form.publisher} onChange={(event) => update('publisher', event.target.value)} /></Field><Field label="ISSN"><input value={form.issn} onChange={(event) => update('issn', event.target.value)} /></Field>
      <Field label="投稿链接" className="span-2"><input type="url" value={form.url} onChange={(event) => update('url', event.target.value)} placeholder="https://..." /></Field>
      <Field label="Manuscript ID"><input value={form.manuscriptId} onChange={(event) => update('manuscriptId', event.target.value)} /></Field><Field label="投稿日期"><input type="date" value={form.submittedAt} onChange={(event) => update('submittedAt', event.target.value)} /></Field>
      <Field label="当前状态"><select value={form.status} onChange={(event) => update('status', event.target.value)}>{STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></Field><Field label="轮次"><input value={form.round} onChange={(event) => update('round', event.target.value)} placeholder="R0" /></Field>
    </div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" type="submit">添加投稿</button></div></form>
  </Modal>
}

function UpdateStatusModal({ paper, submission, onClose, onSave }) {
  const [form, setForm] = useState({ status: submission.status, date: today(), round: submission.round || 'R0', deadline: '', note: '' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const selected = STATUS_MAP[form.status]
  return <Modal title="更新投稿状态" subtitle={`${paper.shortTitle} · ${submission.journalName}`} onClose={onClose}>
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSave(form) }}>
      <div className="current-status-strip"><span>当前</span><StatusPill status={submission.status} /><ArrowUpRight size={15} /><span>已停留 {daysBetween(submission.events.at(-1)?.date)} 天</span></div>
      <div className="form-grid"><Field label="最新状态" className="span-2"><select autoFocus value={form.status} onChange={(event) => update('status', event.target.value)}>{STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></Field>
      <Field label="状态日期"><input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} /></Field><Field label="当前轮次"><input value={form.round} onChange={(event) => update('round', event.target.value)} placeholder="R1" /></Field>
      {selected?.action && <Field label="修回截止日期" className="span-2"><input type="date" value={form.deadline} onChange={(event) => update('deadline', event.target.value)} /></Field>}
      <Field label="备注" className="span-2"><textarea rows="3" value={form.note} onChange={(event) => update('note', event.target.value)} placeholder="记录编辑要求、补充实验或其他信息" /></Field></div>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" type="submit">记录状态</button></div>
    </form>
  </Modal>
}

function NewJournalModal({ initialJournal, onClose, onSave }) {
  const recent = latestMetric(initialJournal)
  const [form, setForm] = useState({ journalId: initialJournal?.id || '', name: initialJournal?.name || '', publisher: initialJournal?.publisher || '', issn: initialJournal?.issn || '', editionYear: recent?.editionYear || new Date().getFullYear(), dataYear: recent?.dataYear || new Date().getFullYear() - 1, jif: recent?.jif || '', category: '', quartile: 'Q1', rank: '', total: '' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <Modal title={initialJournal ? '补充 JCR 指标' : '新增期刊'} subtitle={initialJournal ? `为「${initialJournal.name}」增加或更新年度学科分区。` : '先录入一个年度和学科，之后可继续补充。'} onClose={onClose}>
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (form.name.trim()) onSave(form) }}><div className="form-grid">
      <Field label="期刊名称" className="span-2"><input required autoFocus value={form.name} onChange={(event) => update('name', event.target.value)} /></Field><Field label="出版社"><input value={form.publisher} onChange={(event) => update('publisher', event.target.value)} /></Field><Field label="ISSN"><input value={form.issn} onChange={(event) => update('issn', event.target.value)} /></Field>
      <Field label="JCR 版本年度"><input type="number" value={form.editionYear} onChange={(event) => update('editionYear', event.target.value)} /></Field><Field label="指标数据年度"><input type="number" value={form.dataYear} onChange={(event) => update('dataYear', event.target.value)} /></Field><Field label="JIF"><input type="number" step="0.1" value={form.jif} onChange={(event) => update('jif', event.target.value)} /></Field>
      <Field label="学科类别" className="span-2"><input value={form.category} onChange={(event) => update('category', event.target.value)} placeholder="如：Cell Biology" /></Field><Field label="分区"><select value={form.quartile} onChange={(event) => update('quartile', event.target.value)}>{['Q1', 'Q2', 'Q3', 'Q4'].map((q) => <option key={q}>{q}</option>)}</select></Field><Field label="排名 / 总数"><div className="inline-inputs"><input type="number" value={form.rank} onChange={(event) => update('rank', event.target.value)} placeholder="排名" /><span>/</span><input type="number" value={form.total} onChange={(event) => update('total', event.target.value)} placeholder="总数" /></div></Field>
    </div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" type="submit">保存期刊</button></div></form>
  </Modal>
}

function BackupPasswordModal({ mode, onClose, onSubmit }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const exporting = mode === 'encrypt'
  const submit = async (event) => {
    event.preventDefault()
    if (password.length < 8) return setError('密码至少需要 8 个字符。')
    if (exporting && password !== confirm) return setError('两次输入的密码不一致。')
    setBusy(true); setError('')
    try { await onSubmit(password) } catch { setError(exporting ? '无法创建加密备份，请稍后重试。' : '密码错误，或备份文件已经损坏。'); setBusy(false) }
  }
  return <Modal title={exporting ? '创建加密备份' : '解锁加密备份'} subtitle={exporting ? '使用 AES-256-GCM 加密。密码不会保存，遗失后无法恢复。' : '输入创建备份时使用的密码。'} onClose={onClose}>
    <form className="modal-form" onSubmit={submit}>
      <div className="encryption-note"><LockKeyhole size={18} /><div><strong>端到端本地处理</strong><span>加密和解密均在当前浏览器完成，密码不会离开设备。</span></div></div>
      <div className="form-grid"><Field label="备份密码" className="span-2"><input autoFocus type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 个字符" /></Field>
      {exporting && <Field label="确认密码" className="span-2"><input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></Field>}</div>
      {error && <p className="form-error"><AlertTriangle size={14} />{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" type="submit" disabled={busy}>{busy ? '处理中…' : exporting ? '下载加密备份' : '解锁并恢复'}</button></div>
    </form>
  </Modal>
}

export default function App() {
  const [data, setData] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    loadState().then((stored) => setData(stored || buildDemoState())).catch(() => setData(buildDemoState()))
  }, [])

  useEffect(() => {
    if (!data) return
    const timer = setTimeout(() => saveState(data), 250)
    return () => clearTimeout(timer)
  }, [data])

  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }

  const ensureJournal = (draft, current) => {
    if (!draft.journalName?.trim()) return { journals: current.journals, journal: null }
    const existing = current.journals.find((journal) => journal.name.toLowerCase() === draft.journalName.trim().toLowerCase())
    if (existing) {
      const journal = existing.demo ? { ...existing, demo: false } : existing
      return { journals: current.journals.map((item) => item.id === journal.id ? journal : item), journal }
    }
    const journal = { id: uid('journal'), demo: false, name: draft.journalName.trim(), publisher: draft.publisher?.trim() || '', issn: draft.issn?.trim() || '', metrics: [] }
    return { journals: [...current.journals, journal], journal }
  }

  const savePaper = (form) => {
    setData((current) => {
      const { journals, journal } = ensureJournal(form, current)
      const paper = { id: uid('paper'), demo: false, title: form.title.trim(), shortTitle: form.shortTitle.trim() || form.title.trim().split(/[:—-]/)[0].slice(0, 42), field: form.field.trim(), role: form.role, tags: form.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean), createdAt: today(), submissions: [] }
      if (journal) paper.submissions.push({ id: uid('submission'), journalId: journal.id, journalName: journal.name, url: form.url.trim(), manuscriptId: form.manuscriptId.trim(), submittedAt: form.submittedAt, status: form.status, round: 'R0', doi: '', events: [{ id: uid('event'), status: form.status, date: form.submittedAt, note: '首次投稿' }] })
      return { ...current, journals, papers: [paper, ...current.papers] }
    })
    setModal(null); notify('论文已保存')
  }

  const savePaperEdit = (paper, submission, form) => {
    setData((current) => ({ ...current, papers: current.papers.map((item) => item.id === paper.id ? {
      ...item,
      demo: false,
      title: form.title.trim(),
      shortTitle: form.shortTitle.trim() || form.title.trim().slice(0, 42),
      field: form.field.trim(),
      role: form.role,
      tags: form.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
      submissions: item.submissions.map((entry) => entry.id === submission?.id ? { ...entry, url: form.url.trim(), manuscriptId: form.manuscriptId.trim(), submittedAt: form.submittedAt, doi: form.doi.trim() } : entry),
    } : item) }))
    setModal(null); notify('论文信息已更新')
  }

  const saveSubmission = (paper, form) => {
    setData((current) => {
      const { journals, journal } = ensureJournal(form, current)
      return { ...current, journals, papers: current.papers.map((item) => item.id === paper.id ? { ...item, submissions: [...item.submissions, { id: uid('submission'), journalId: journal.id, journalName: journal.name, url: form.url.trim(), manuscriptId: form.manuscriptId.trim(), submittedAt: form.submittedAt, status: form.status, round: form.round || 'R0', doi: '', events: [{ id: uid('event'), status: form.status, date: form.submittedAt, note: item.submissions.length ? '新增转投' : '首次投稿' }] }] } : item) }
    })
    setModal(null); notify('投稿记录已添加')
  }

  const saveStatus = (paper, submission, form) => {
    setData((current) => ({ ...current, papers: current.papers.map((item) => item.id === paper.id ? { ...item, submissions: item.submissions.map((entry) => entry.id === submission.id ? { ...entry, status: form.status, round: form.round, events: [...entry.events, { id: uid('event'), status: form.status, date: form.date, deadline: form.deadline || undefined, note: form.note.trim() }] } : entry) } : item) }))
    setModal(null); notify('状态时间线已更新')
  }

  const saveJournal = (form) => {
    const category = form.category.trim() ? [{ name: form.category.trim(), quartile: form.quartile, rank: Number(form.rank) || null, total: Number(form.total) || null }] : []
    setData((current) => {
      if (!form.journalId) return { ...current, journals: [{ id: uid('journal'), demo: false, name: form.name.trim(), publisher: form.publisher.trim(), issn: form.issn.trim(), metrics: [{ editionYear: Number(form.editionYear), dataYear: Number(form.dataYear), jif: Number(form.jif) || null, categories: category }] }, ...current.journals] }
      return { ...current, journals: current.journals.map((journal) => {
        if (journal.id !== form.journalId) return journal
        const metrics = [...journal.metrics]
        const index = metrics.findIndex((metric) => Number(metric.editionYear) === Number(form.editionYear))
        if (index < 0) metrics.push({ editionYear: Number(form.editionYear), dataYear: Number(form.dataYear), jif: Number(form.jif) || null, categories: category })
        else {
          const existing = metrics[index]
          const categories = [...existing.categories]
          category.forEach((item) => {
            const categoryIndex = categories.findIndex((entry) => entry.name.toLowerCase() === item.name.toLowerCase())
            if (categoryIndex >= 0) categories[categoryIndex] = item
            else categories.push(item)
          })
          metrics[index] = { ...existing, dataYear: Number(form.dataYear), jif: Number(form.jif) || null, categories }
        }
        return { ...journal, demo: false, name: form.name.trim(), publisher: form.publisher.trim(), issn: form.issn.trim(), metrics }
      }) }
    })
    setModal(null); notify(form.journalId ? 'JCR 指标已更新' : '期刊已加入指标库')
  }

  const deletePaper = (paper) => {
    if (!window.confirm(`确定删除「${paper.shortTitle}」及其全部投稿记录吗？`)) return
    setData((current) => ({ ...current, papers: current.papers.filter((item) => item.id !== paper.id) }))
    notify('论文已删除')
  }

  const importJcr = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try { const text = await file.text(); setData((current) => ({ ...current, journals: parseJournalCsv(text, current.journals) })); notify('JCR CSV 已导入') } catch { notify('CSV 无法读取，请检查格式') }
    event.target.value = ''
  }

  const restore = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const restored = JSON.parse(await file.text())
      if (restored?.format === 'paper-trail-encrypted') { setModal({ type: 'decrypt', backup: restored }); event.target.value = ''; return }
      if (!Array.isArray(restored.papers) || !Array.isArray(restored.journals)) throw new Error('invalid')
      if (window.confirm('恢复备份将替换当前所有数据，是否继续？')) { setData({ ...restored, demo: false }); notify('备份已恢复') }
    } catch { notify('这不是有效的 Paper Trail 备份') }
    event.target.value = ''
  }

  const exportEncrypted = async (password) => {
    const backup = await encryptState(data, password)
    downloadFile(`paper-trail-encrypted-${today()}.json`, JSON.stringify(backup, null, 2))
    setModal(null); notify('加密备份已下载')
  }

  const restoreEncrypted = async (backup, password) => {
    const restored = await decryptState(backup, password)
    if (!Array.isArray(restored.papers) || !Array.isArray(restored.journals)) throw new Error('invalid')
    if (window.confirm('密码正确。是否用此备份替换当前数据？')) { setData({ ...restored, demo: false }); setModal(null); notify('加密备份已恢复') }
  }

  if (!data) return <div className="loading-screen"><div className="brand-loader">PT</div><span>正在打开你的投稿台账…</span></div>

  return <>
    <AppShell page={page} setPage={setPage} data={data} onNewPaper={() => setModal({ type: 'paper' })}>
      {data.demo && <div className="demo-banner"><span>演示数据</span><p>这些记录用于展示功能。准备使用时，可前往“备份”一键清空。</p><button onClick={() => setPage('backup')}>管理数据 <ArrowUpRight size={14} /></button></div>}
      {page === 'dashboard' && <Dashboard data={data} setPage={setPage} onUpdate={(paper, submission) => setModal({ type: 'status', paper, submission })} />}
      {page === 'papers' && <PapersPage data={data} onUpdate={(paper, submission) => setModal({ type: 'status', paper, submission })} onAddSubmission={(paper) => setModal({ type: 'submission', paper })} onEdit={(paper, submission) => setModal({ type: 'edit', paper, submission })} onDeletePaper={deletePaper} />}
      {page === 'insights' && <InsightsPage data={data} setPage={setPage} />}
      {page === 'journals' && <JournalsPage data={data} onNewJournal={(journal = null) => setModal({ type: 'journal', journal })} onImportCsv={importJcr} />}
      {page === 'backup' && <BackupPage data={data} onRestore={restore} onEncrypt={() => setModal({ type: 'encrypt' })} onClearDemo={() => { if (window.confirm('清空演示数据并保留你新增的记录？')) { setData((current) => ({ ...current, demo: false, papers: current.papers.filter((item) => !item.demo), journals: current.journals.filter((item) => !item.demo) })); notify('演示数据已清空') } }} onClearAll={() => { if (window.confirm('这会永久删除全部数据。确定继续？')) { setData(emptyState()); notify('本地数据已清空') } }} />}
    </AppShell>
    {modal?.type === 'paper' && <NewPaperModal data={data} onClose={() => setModal(null)} onSave={savePaper} />}
    {modal?.type === 'edit' && <EditPaperModal paper={modal.paper} submission={modal.submission} onClose={() => setModal(null)} onSave={(form) => savePaperEdit(modal.paper, modal.submission, form)} />}
    {modal?.type === 'submission' && <SubmissionModal data={data} paper={modal.paper} onClose={() => setModal(null)} onSave={(form) => saveSubmission(modal.paper, form)} />}
    {modal?.type === 'status' && <UpdateStatusModal paper={modal.paper} submission={modal.submission} onClose={() => setModal(null)} onSave={(form) => saveStatus(modal.paper, modal.submission, form)} />}
    {modal?.type === 'journal' && <NewJournalModal initialJournal={modal.journal} onClose={() => setModal(null)} onSave={saveJournal} />}
    {modal?.type === 'encrypt' && <BackupPasswordModal mode="encrypt" onClose={() => setModal(null)} onSubmit={exportEncrypted} />}
    {modal?.type === 'decrypt' && <BackupPasswordModal mode="decrypt" onClose={() => setModal(null)} onSubmit={(password) => restoreEncrypted(modal.backup, password)} />}
    {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
  </>
}
