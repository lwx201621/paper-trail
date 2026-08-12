import { describe, expect, it } from 'vitest'
import { computeConferenceStats, conferenceDateState, demoConferences } from './conferenceDomain.js'

describe('conference tracking', () => {
  it('counts upcoming meetings and locations', () => {
    const stats = computeConferenceStats(demoConferences(), new Date('2026-08-12T00:00:00'))
    expect(stats.total).toBe(2)
    expect(stats.upcoming).toBe(2)
    expect(stats.countries).toBe(2)
  })

  it('calculates deadline distance using calendar days', () => {
    const conference = { submissionDeadline: '2026-08-22', startDate: '2027-01-01' }
    expect(conferenceDateState(conference, new Date('2026-08-12T12:00:00')).deadlineDays).toBe(10)
  })
})
