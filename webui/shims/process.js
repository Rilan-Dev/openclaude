const runtimeEnv = Object.create(null)

if (typeof __OPENCLAUDE_ENV__ !== 'undefined') {
  Object.assign(runtimeEnv, __OPENCLAUDE_ENV__)
}

// Merge compile-time injected env
if (typeof __OPENCLAUDE_ENV__ !== 'undefined') {
  Object.assign(runtimeEnv, __OPENCLAUDE_ENV__)
}

export const env = new Proxy(runtimeEnv, {
  get(target, prop) {
    return target[prop]
  },

  set(target, prop, value) {
    target[prop] = value
    return true
  },

  has(target, prop) {
    return prop in target
  },

  ownKeys(target) {
    return Reflect.ownKeys(target)
  },

  getOwnPropertyDescriptor() {
    return {
      enumerable: true,
      configurable: true,
    }
  },
})

export function setEnv(values = {}) {
  Object.keys(runtimeEnv).forEach((k) => delete runtimeEnv[k])
  Object.assign(runtimeEnv, values)
}

export function updateEnv(values = {}) {
  Object.assign(runtimeEnv, values)
}

export function clearEnv() {
  Object.keys(runtimeEnv).forEach((k) => delete runtimeEnv[k])
}

export const argv = []
export const execArgv = []
export const version = ''
export const versions = {}
export const platform = 'browser'
export const arch = 'browser'
export const pid = 0
export const title = 'browser'
export const stdin = undefined
export const stdout = undefined
export const stderr = undefined

export function cwd() {
  return '/'
}

export function chdir() {}

export function exit(code = 0) {
  throw new Error(`process.exit(${code}) is not available in browser`)
}

export function nextTick(cb, ...args) {
  queueMicrotask(() => cb(...args))
}

export function uptime() {
  return performance.now() / 1000
}

export function memoryUsage() {
  return {
    rss: 0,
    heapTotal: 0,
    heapUsed: 0,
    external: 0,
    arrayBuffers: 0,
  }
}

export function resourceUsage() {
  return {
    maxRSS: 0,
    userCPUTime: 0,
    systemCPUTime: 0,
  }
}

export function on() {
  return process
}

export function once() {
  return process
}

export function off() {
  return process
}

export function removeListener() {
  return process
}

export const process = {
  env,
  argv,
  execArgv,
  version,
  versions,
  platform,
  arch,
  pid,
  title,
  stdin,
  stdout,
  stderr,
  cwd,
  chdir,
  exit,
  nextTick,
  uptime,
  memoryUsage,
  resourceUsage,
  on,
  once,
  off,
  removeListener,
  setEnv,
  updateEnv,
  clearEnv,
}

export default process