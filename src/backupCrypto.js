const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bytesToBase64(bytes) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

async function deriveKey(password, salt, usages) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  )
}

export async function encryptState(state, password) {
  if (!password || password.length < 8) throw new Error('Password must contain at least 8 characters')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, ['encrypt'])
  const payload = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(state)))
  return {
    format: 'paper-trail-encrypted',
    version: 1,
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: 250000,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    payload: bytesToBase64(new Uint8Array(payload)),
  }
}

export async function decryptState(backup, password) {
  if (backup?.format !== 'paper-trail-encrypted' || backup.version !== 1) throw new Error('Unsupported backup format')
  const salt = base64ToBytes(backup.salt)
  const iv = base64ToBytes(backup.iv)
  const key = await deriveKey(password, salt, ['decrypt'])
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, base64ToBytes(backup.payload))
  return JSON.parse(decoder.decode(decrypted))
}
