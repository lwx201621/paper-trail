import { describe, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { decryptState, encryptState } from './backupCrypto.js'

globalThis.crypto ||= webcrypto
globalThis.btoa ||= (value) => Buffer.from(value, 'binary').toString('base64')
globalThis.atob ||= (value) => Buffer.from(value, 'base64').toString('binary')

describe('encrypted backups', () => {
  it('round-trips local state without exposing the paper title', async () => {
    const state = { version: 1, papers: [{ title: 'Private manuscript' }], journals: [] }
    const encrypted = await encryptState(state, 'research-passphrase')
    expect(JSON.stringify(encrypted)).not.toContain('Private manuscript')
    await expect(decryptState(encrypted, 'research-passphrase')).resolves.toEqual(state)
  })

  it('rejects an incorrect passphrase', async () => {
    const encrypted = await encryptState({ papers: [], journals: [] }, 'correct-password')
    await expect(decryptState(encrypted, 'wrong-password')).rejects.toThrow()
  })
})
