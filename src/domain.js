import { demoConferences } from './conferenceDomain.js'

export const STATUS_OPTIONS = [
  { value: 'submitted', label: '已提交', tone: 'neutral', active: true },
  { value: 'technical_check', label: '技术检查', tone: 'neutral', active: true },
  { value: 'with_editor', label: '编辑处理中', tone: 'amber', active: true },
  { value: 'reviewers_invited', label: '邀请审稿人', tone: 'amber', active: true },
  { value: 'under_review', label: '外审中', tone: 'blue', active: true },
  { value: 'decision_pending', label: '等待决定', tone: 'violet', active: true },
  { value: 'minor_revision', label: '小修', tone: 'orange', active: true, action: true },
  { value: 'major_revision', label: '大修', tone: 'orange', active: true, action: true },
  { value: 'revision_submitted', label: '修回稿已提交', tone: 'blue', active: true },
  { value: 'accepted', label: '已接收', tone: 'green', accepted: true },
  { value: 'proofing', label: '校样中', tone: 'green', accepted: true },
  { value: 'online', label: 'Online', tone: 'green', accepted: true, published: true },
  { value: 'published', label: '正式出版', tone: 'green', accepted: true, published: true },
  { value: 'rejected', label: '拒稿', tone: 'red', closed: true },
  { value: 'withdrawn', label: '撤稿', tone: 'red', closed: true },
  { value: 'transferred', label: '已转投', tone: 'neutral', closed: true },
]

export const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map((item) => [item.value, item]))

export const ROLE_OPTIONS = ['第一作者', '共同一作', '第二作者', '通讯作者', '共同通讯', '其他作者']

export function uid(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID()}`
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function daysBetween(start, end = today()) {
  if (!start) return 0
  const a = new Date(`${start}T00:00:00`)
  const b = new Date(`${end}T00:00:00`)
  return Math.max(0, Math.round((b - a) / 86400000))
}

export function currentSubmission(paper) {
  return [...paper.submissions].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))[0]
}

export function latestMetric(journal) {
  return [...(journal?.metrics || [])].sort((a, b) => Number(b.editionYear) - Number(a.editionYear))[0]
}

export function bestQuartile(metric) {
  const values = (metric?.categories || [])
    .map((item) => Number(String(item.quartile || '').replace('Q', '')))
    .filter((value) => value >= 1 && value <= 4)
  return values.length ? `Q${Math.min(...values)}` : '—'
}

export function computeStats(state) {
  const submissions = state.papers.flatMap((paper) => paper.submissions.map((submission) => ({ paper, submission })))
  const current = state.papers.map((paper) => ({ paper, submission: currentSubmission(paper) })).filter((item) => item.submission)
  const acceptedPapers = current.filter(({ submission }) => STATUS_MAP[submission.status]?.accepted)
  const publishedPapers = current.filter(({ submission }) => STATUS_MAP[submission.status]?.published)
  const active = current.filter(({ submission }) => STATUS_MAP[submission.status]?.active)
  const quartiles = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, '未分区': 0 }

  current.forEach(({ submission }) => {
    const journal = state.journals.find((item) => item.id === submission.journalId)
    const quartile = bestQuartile(latestMetric(journal))
    quartiles[quartile === '—' ? '未分区' : quartile] += 1
  })

  const years = {}
  submissions.forEach(({ submission }) => {
    const year = (submission.submittedAt || '').slice(0, 4) || '未知'
    years[year] ||= { submissions: 0, accepted: 0 }
    years[year].submissions += 1
    if (STATUS_MAP[submission.status]?.accepted) years[year].accepted += 1
  })

  return {
    papers: state.papers.length,
    attempts: submissions.length,
    active: active.length,
    accepted: acceptedPapers.length,
    published: publishedPapers.length,
    quartiles,
    years,
  }
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

export function computeInsights(state) {
  const attempts = state.papers.flatMap((paper) => paper.submissions.map((submission) => ({ paper, submission })))
  const current = state.papers.map((paper) => ({ paper, submission: currentSubmission(paper) })).filter((item) => item.submission)
  const acceptedAttempts = attempts.filter(({ submission }) => STATUS_MAP[submission.status]?.accepted)
  const rejectedAttempts = attempts.filter(({ submission }) => submission.status === 'rejected')
  const decidedAttempts = acceptedAttempts.length + rejectedAttempts.length
  const firstDecisionDays = []
  const acceptanceDays = []
  const decisionStatuses = new Set(['minor_revision', 'major_revision', 'accepted', 'rejected'])

  attempts.forEach(({ submission }) => {
    const ordered = [...submission.events].sort((a, b) => a.date.localeCompare(b.date))
    const firstDecision = ordered.find((event) => decisionStatuses.has(event.status))
    const accepted = ordered.find((event) => STATUS_MAP[event.status]?.accepted)
    if (firstDecision) firstDecisionDays.push(daysBetween(submission.submittedAt, firstDecision.date))
    if (accepted) acceptanceDays.push(daysBetween(submission.submittedAt, accepted.date))
  })

  const statusCounts = {}
  const roleCounts = {}
  const publisherCounts = {}
  const attention = []
  current.forEach(({ paper, submission }) => {
    const status = STATUS_MAP[submission.status]
    statusCounts[status?.label || submission.status] = (statusCounts[status?.label || submission.status] || 0) + 1
    roleCounts[paper.role || '未标注'] = (roleCounts[paper.role || '未标注'] || 0) + 1
    const journal = state.journals.find((item) => item.id === submission.journalId)
    const publisher = journal?.publisher || '未知出版社'
    publisherCounts[publisher] = (publisherCounts[publisher] || 0) + 1
    const lastEvent = submission.events.at(-1)
    const deadline = lastEvent?.deadline
    if (deadline && status?.action) {
      const remaining = Math.round((new Date(`${deadline}T00:00:00`) - new Date(`${today()}T00:00:00`)) / 86400000)
      if (remaining < 0) attention.push({ id: `${submission.id}-overdue`, severity: 'critical', kind: '修回逾期', paper, submission, detail: `已逾期 ${Math.abs(remaining)} 天`, deadline })
      else if (remaining <= 14) attention.push({ id: `${submission.id}-deadline`, severity: remaining <= 3 ? 'critical' : 'warning', kind: '修回临近', paper, submission, detail: `还有 ${remaining} 天`, deadline })
    }
    const stalledDays = daysBetween(lastEvent?.date || submission.submittedAt)
    if (status?.active && !status?.action && stalledDays >= 60) attention.push({ id: `${submission.id}-stalled`, severity: 'warning', kind: '长期未更新', paper, submission, detail: `${stalledDays} 天`, stalledDays })
    if (status?.active && !submission.url) attention.push({ id: `${submission.id}-link`, severity: 'info', kind: '缺少链接', paper, submission, detail: '建议补充投稿系统链接' })
    if (!latestMetric(journal)) attention.push({ id: `${submission.id}-jcr`, severity: 'info', kind: '缺少 JCR', paper, submission, detail: '期刊尚未匹配指标' })
  })

  attention.sort((a, b) => ({ critical: 0, warning: 1, info: 2 }[a.severity] - { critical: 0, warning: 1, info: 2 }[b.severity]))
  return {
    acceptanceRate: decidedAttempts ? Math.round((acceptedAttempts.length / decidedAttempts) * 100) : null,
    acceptedAttempts: acceptedAttempts.length,
    rejectedAttempts: rejectedAttempts.length,
    medianFirstDecision: median(firstDecisionDays),
    medianAcceptance: median(acceptanceDays),
    revisionRounds: attempts.reduce((sum, { submission }) => sum + submission.events.filter((event) => ['minor_revision', 'major_revision'].includes(event.status)).length, 0),
    statusCounts,
    roleCounts,
    publisherCounts,
    attention,
  }
}

export function buildDemoState() {
  const journalA = 'journal_nature_methods'
  const journalB = 'journal_bioinformatics'
  const journalC = 'journal_cell_reports'
  return {
    version: 1,
    demo: true,
    journals: [
      {
        id: journalA,
        demo: true,
        name: 'Nature Methods',
        publisher: 'Springer Nature',
        issn: '1548-7091',
        metrics: [{ editionYear: 2025, dataYear: 2024, jif: 36.1, categories: [{ name: 'Biochemical Research Methods', quartile: 'Q1', rank: 2, total: 85 }] }],
      },
      {
        id: journalB,
        demo: true,
        name: 'Bioinformatics',
        publisher: 'Oxford University Press',
        issn: '1367-4803',
        metrics: [{ editionYear: 2025, dataYear: 2024, jif: 4.7, categories: [{ name: 'Mathematical & Computational Biology', quartile: 'Q1', rank: 8, total: 67 }] }],
      },
      {
        id: journalC,
        demo: true,
        name: 'Cell Reports',
        publisher: 'Elsevier',
        issn: '2211-1247',
        metrics: [{ editionYear: 2025, dataYear: 2024, jif: 6.7, categories: [{ name: 'Cell Biology', quartile: 'Q2', rank: 54, total: 205 }] }],
      },
    ],
    papers: [
      {
        id: 'paper_demo_1',
        demo: true,
        title: 'A spatial atlas of adaptive cellular states',
        shortTitle: 'Spatial atlas',
        field: '单细胞组学',
        role: '第一作者',
        tags: ['课题 A', '空间转录组'],
        createdAt: '2025-10-18',
        submissions: [
          {
            id: 'submission_demo_1', journalId: journalA, journalName: 'Nature Methods',
            url: 'https://www.nature.com/nmeth/', manuscriptId: 'NMETH-A00001', submittedAt: '2026-05-02',
            status: 'under_review', round: 'R1', doi: '',
            events: [
              { id: 'event_1', status: 'submitted', date: '2026-05-02', note: '首次投稿' },
              { id: 'event_2', status: 'technical_check', date: '2026-05-05', note: '' },
              { id: 'event_3', status: 'with_editor', date: '2026-05-09', note: '' },
              { id: 'event_4', status: 'under_review', date: '2026-05-17', note: '进入外审' },
            ],
          },
        ],
      },
      {
        id: 'paper_demo_2',
        demo: true,
        title: 'Interpretable graph learning for rare disease prioritization',
        shortTitle: 'Rare disease GNN',
        field: '计算生物学',
        role: '共同一作',
        tags: ['课题 B', '图神经网络'],
        createdAt: '2025-07-11',
        submissions: [
          {
            id: 'submission_demo_2a', journalId: journalC, journalName: 'Cell Reports',
            url: 'https://www.cell.com/cell-reports/home', manuscriptId: 'CELL-REPORTS-D-25-00001', submittedAt: '2025-09-14',
            status: 'rejected', round: 'R0', doi: '',
            events: [
              { id: 'event_5', status: 'submitted', date: '2025-09-14', note: '' },
              { id: 'event_6', status: 'rejected', date: '2025-10-01', note: '编辑拒稿，建议转投' },
            ],
          },
          {
            id: 'submission_demo_2b', journalId: journalB, journalName: 'Bioinformatics',
            url: 'https://academic.oup.com/bioinformatics', manuscriptId: 'BIOINF-2025-0001', submittedAt: '2025-11-08',
            status: 'accepted', round: 'R2', doi: '',
            events: [
              { id: 'event_7', status: 'submitted', date: '2025-11-08', note: '转投' },
              { id: 'event_8', status: 'major_revision', date: '2026-01-22', note: '', deadline: '2026-03-22' },
              { id: 'event_9', status: 'revision_submitted', date: '2026-03-18', note: 'R1' },
              { id: 'event_10', status: 'minor_revision', date: '2026-04-28', note: '', deadline: '2026-05-28' },
              { id: 'event_11', status: 'accepted', date: '2026-06-12', note: 'Accepted!' },
            ],
          },
        ],
      },
      {
        id: 'paper_demo_3',
        demo: true,
        title: 'Benchmarking foundation models for perturbation response',
        shortTitle: 'Perturbation benchmark',
        field: 'AI for Science',
        role: '通讯作者',
        tags: ['课题 C'],
        createdAt: '2026-02-20',
        submissions: [
          {
            id: 'submission_demo_3', journalId: journalC, journalName: 'Cell Reports',
            url: 'https://www.cell.com/cell-reports/home', manuscriptId: 'CELL-REPORTS-D-26-00002', submittedAt: '2026-07-18',
            status: 'major_revision', round: 'R1', doi: '',
            events: [
              { id: 'event_12', status: 'submitted', date: '2026-07-18', note: '' },
              { id: 'event_13', status: 'under_review', date: '2026-07-29', note: '' },
              { id: 'event_14', status: 'major_revision', date: '2026-08-08', note: '补充消融实验', deadline: '2026-09-08' },
            ],
          },
        ],
      },
    ],
    conferences: demoConferences(),
    preferences: { quartileMode: 'best', jcrMode: 'latest' },
  }
}

export function emptyState() {
  return { version: 1, demo: false, journals: [], papers: [], conferences: [], preferences: { quartileMode: 'best', jcrMode: 'latest' } }
}

export function normalizeState(state) {
  return { ...emptyState(), ...state, papers: state?.papers || [], journals: state?.journals || [], conferences: state?.conferences || [] }
}

export function parseJournalCsv(text, existing = []) {
  const rows = []
  let row = []
  let value = ''
  let quoted = false
  const source = text.replace(/^\ufeff/, '')
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (char === '"' && quoted && source[index + 1] === '"') { value += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { row.push(value); value = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      row.push(value)
      if (row.some((cellValue) => cellValue.trim())) rows.push(row)
      row = []; value = ''
    } else value += char
  }
  row.push(value)
  if (row.some((cellValue) => cellValue.trim())) rows.push(row)
  if (rows.length < 2) return existing
  const headers = rows[0].map((header) => header.trim().toLowerCase())
  const cell = (row, ...names) => {
    const index = names.map((name) => headers.indexOf(name)).find((value) => value >= 0)
    return index === undefined ? '' : (row[index] || '').trim()
  }
  const journals = structuredClone(existing)

  rows.slice(1).forEach((row) => {
    const name = cell(row, 'journal', 'name', '期刊')
    if (!name) return
    const issn = cell(row, 'issn')
    let journal = journals.find((item) => (issn && item.issn === issn) || item.name.toLowerCase() === name.toLowerCase())
    if (!journal) {
      journal = { id: uid('journal'), name, issn, publisher: cell(row, 'publisher', '出版社'), metrics: [] }
      journals.push(journal)
    }
    const editionYear = Number(cell(row, 'jcryear', 'editionyear', 'jcr年度')) || new Date().getFullYear()
    let metric = journal.metrics.find((item) => Number(item.editionYear) === editionYear)
    if (!metric) {
      metric = { editionYear, dataYear: Number(cell(row, 'datayear', '数据年度')) || editionYear - 1, jif: Number(cell(row, 'jif', '影响因子')) || null, categories: [] }
      journal.metrics.push(metric)
    }
    const category = cell(row, 'category', '学科')
    if (category) metric.categories.push({
      name: category,
      quartile: cell(row, 'quartile', '分区').toUpperCase(),
      rank: Number(cell(row, 'rank', '排名')) || null,
      total: Number(cell(row, 'total', '期刊总数')) || null,
    })
  })
  return journals
}
