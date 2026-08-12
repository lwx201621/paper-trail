import { describe, expect, it } from 'vitest'
import { ROLE_OPTIONS, bestQuartile, buildDemoState, computeInsights, computeStats, parseJournalCsv } from './domain.js'

describe('paper trail domain', () => {
  it('keeps paper count separate from submission attempts', () => {
    const stats = computeStats(buildDemoState())
    expect(stats.papers).toBe(3)
    expect(stats.attempts).toBe(4)
  })

  it('offers second author as an authorship role', () => {
    expect(ROLE_OPTIONS).toContain('第二作者')
  })

  it('uses the best JCR category quartile', () => {
    expect(bestQuartile({ categories: [{ quartile: 'Q3' }, { quartile: 'Q1' }] })).toBe('Q1')
  })

  it('imports multiple JCR categories for one journal', () => {
    const csv = 'journal,issn,publisher,jcrYear,jif,category,quartile,rank,total\nTest Journal,1234-5678,Test,2025,8.2,Biology,Q1,10,100\nTest Journal,1234-5678,Test,2025,8.2,Medicine,Q2,40,120'
    const journals = parseJournalCsv(csv)
    expect(journals).toHaveLength(1)
    expect(journals[0].metrics[0].categories).toHaveLength(2)
  })

  it('handles quoted journal names and categories containing commas', () => {
    const csv = 'journal,issn,publisher,jcrYear,jif,category,quartile,rank,total\n"Journal, Advanced",1234-5678,Test,2025,8.2,"Education, Scientific Disciplines",Q1,10,100'
    const journals = parseJournalCsv(csv)
    expect(journals[0].name).toBe('Journal, Advanced')
    expect(journals[0].metrics[0].categories[0].name).toBe('Education, Scientific Disciplines')
  })

  it('computes decision-cycle and acceptance analytics', () => {
    const insights = computeInsights(buildDemoState())
    expect(insights.acceptanceRate).toBe(50)
    expect(insights.medianFirstDecision).toBeGreaterThan(0)
    expect(insights.revisionRounds).toBe(3)
  })
})
