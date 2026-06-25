export function getBrowserEnv() {
  return globalThis.process?.env ?? {}
}

export function getBrowserEnvValue(name) {
  const value = getBrowserEnv()[name]
  return typeof value === 'string' ? value : undefined
}

export function getBrowserEnvFlag(name) {
  const value = getBrowserEnvValue(name)
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'on'
  )
}

export function attachCache(fn) {
  fn.cache = {
    clear() {},
  }
  return fn
}

export function browserNoop() {}

export async function browserAsyncNoop() {
  return undefined
}

