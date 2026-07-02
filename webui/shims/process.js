const runtimeEnv = Object.create(null)

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
export const version = 'v22.22.2'
export const versions = {
  node: '22.22.2',
}
export const platform = 'browser'
export const arch = 'x64'
export const pid = 0
export const title = 'browser'
export const execPath = ''

function createEventTargetLike() {
  const listenersByEvent = new Map()

  const target = {
    on(event, listener) {
      if (typeof listener === 'function') {
        const key = String(event)
        const listeners = listenersByEvent.get(key) ?? []
        listeners.push(listener)
        listenersByEvent.set(key, listeners)
      }
      return target
    },
    addListener(event, listener) {
      return target.on(event, listener)
    },
    once(event, listener) {
      if (typeof listener !== 'function') return target
      const wrapper = (...args) => {
        target.removeListener(event, wrapper)
        listener(...args)
      }
      wrapper.listener = listener
      return target.on(event, wrapper)
    },
    prependListener(event, listener) {
      if (typeof listener === 'function') {
        const key = String(event)
        const listeners = listenersByEvent.get(key) ?? []
        listeners.unshift(listener)
        listenersByEvent.set(key, listeners)
      }
      return target
    },
    prependOnceListener(event, listener) {
      if (typeof listener !== 'function') return target
      const wrapper = (...args) => {
        target.removeListener(event, wrapper)
        listener(...args)
      }
      wrapper.listener = listener
      return target.prependListener(event, wrapper)
    },
    off(event, listener) {
      return target.removeListener(event, listener)
    },
    removeListener(event, listener) {
      const key = String(event)
      const listeners = listenersByEvent.get(key)
      if (!listeners) return target
      listenersByEvent.set(
        key,
        listeners.filter(
          current => current !== listener && current.listener !== listener,
        ),
      )
      return target
    },
    removeAllListeners(event) {
      if (event === undefined) {
        listenersByEvent.clear()
      } else {
        listenersByEvent.delete(String(event))
      }
      return target
    },
    listeners(event) {
      return [...(listenersByEvent.get(String(event)) ?? [])]
    },
    listenerCount(event) {
      return listenersByEvent.get(String(event))?.length ?? 0
    },
    emit(event, ...args) {
      const listeners = target.listeners(event)
      for (const listener of listeners) {
        listener(...args)
      }
      return listeners.length > 0
    },
  }

  return target
}

function isTerminalControlOnly(text) {
  const stripped = text
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\s+/g, '')
  return text.includes('\x1b') && stripped.length === 0
}

function createTerminalScreen(columns = 120, rows = 30) {
  let width = columns
  let height = rows
  let cursorX = 0
  let cursorY = 0
  let lines = Array.from({ length: height }, () => Array(width).fill(' '))

  const clampCursor = () => {
    cursorX = Math.max(0, Math.min(width - 1, cursorX))
    cursorY = Math.max(0, Math.min(height - 1, cursorY))
  }

  const clearLineRange = (row, start, end) => {
    if (row < 0 || row >= height) return
    const from = Math.max(0, Math.min(width - 1, start))
    const to = Math.max(0, Math.min(width - 1, end))
    for (let col = from; col <= to; col++) {
      lines[row][col] = ' '
    }
  }

  const clearScreen = () => {
    lines = Array.from({ length: height }, () => Array(width).fill(' '))
    cursorX = 0
    cursorY = 0
  }

  const scroll = () => {
    lines.shift()
    lines.push(Array(width).fill(' '))
    cursorY = height - 1
  }

  const putChar = char => {
    if (char === '\r') {
      cursorX = 0
      return
    }
    if (char === '\n') {
      cursorX = 0
      cursorY += 1
      if (cursorY >= height) scroll()
      return
    }
    if (char === '\b') {
      cursorX = Math.max(0, cursorX - 1)
      return
    }
    if (char < ' ') {
      return
    }

    lines[cursorY][cursorX] = char
    cursorX += 1
    if (cursorX >= width) {
      cursorX = 0
      cursorY += 1
      if (cursorY >= height) scroll()
    }
  }

  const parseParams = body => {
    const normalized = body.replace(/^[?>]/, '')
    if (!normalized) return []
    return normalized
      .split(';')
      .map(value => (value === '' ? undefined : Number(value)))
  }

  const applyCsi = (body, final) => {
    const params = parseParams(body)
    const first = Number.isFinite(params[0]) ? params[0] : undefined
    const second = Number.isFinite(params[1]) ? params[1] : undefined
    const n = first ?? 1

    switch (final) {
      case 'A':
        cursorY -= n
        break
      case 'B':
        cursorY += n
        break
      case 'C':
        cursorX += n
        break
      case 'D':
        cursorX -= n
        break
      case 'E':
        cursorY += n
        cursorX = 0
        break
      case 'F':
        cursorY -= n
        cursorX = 0
        break
      case 'G':
        cursorX = Math.max(0, n - 1)
        break
      case 'H':
      case 'f':
        cursorY = Math.max(0, (first ?? 1) - 1)
        cursorX = Math.max(0, (second ?? 1) - 1)
        break
      case 'J':
        if ((first ?? 0) === 2 || (first ?? 0) === 3) {
          clearScreen()
        } else if ((first ?? 0) === 0) {
          clearLineRange(cursorY, cursorX, width - 1)
          for (let row = cursorY + 1; row < height; row++) {
            clearLineRange(row, 0, width - 1)
          }
        } else if (first === 1) {
          for (let row = 0; row < cursorY; row++) {
            clearLineRange(row, 0, width - 1)
          }
          clearLineRange(cursorY, 0, cursorX)
        }
        break
      case 'K':
        if ((first ?? 0) === 2) {
          clearLineRange(cursorY, 0, width - 1)
        } else if ((first ?? 0) === 1) {
          clearLineRange(cursorY, 0, cursorX)
        } else {
          clearLineRange(cursorY, cursorX, width - 1)
        }
        break
      case 'S':
        for (let i = 0; i < n; i++) scroll()
        break
      default:
        break
    }

    clampCursor()
  }

  const apply = chunk => {
    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i]
      if (char !== '\x1b') {
        putChar(char)
        continue
      }

      const next = chunk[i + 1]
      if (next === '[') {
        let j = i + 2
        while (j < chunk.length && !/[@-~]/.test(chunk[j])) j++
        if (j < chunk.length) {
          applyCsi(chunk.slice(i + 2, j), chunk[j])
          i = j
          continue
        }
      }

      if (next === ']') {
        const bel = chunk.indexOf('\x07', i + 2)
        const st = chunk.indexOf('\x1b\\', i + 2)
        const end =
          bel === -1 ? st + 1 : st === -1 ? bel : Math.min(bel, st + 1)
        if (end > i) {
          i = end
          continue
        }
      }

      if (next === 'P') {
        const st = chunk.indexOf('\x1b\\', i + 2)
        if (st !== -1) {
          i = st + 1
          continue
        }
      }

      if (next === 'c') {
        clearScreen()
        i += 1
        continue
      }

      i += 1
    }
  }

  const frame = () =>
    lines
      .map(line => line.join('').replace(/\s+$/g, ''))
      .join('\n')
      .replace(/\s+$/g, '')

  const resize = (nextColumns, nextRows) => {
    width = nextColumns
    height = nextRows
    clearScreen()
  }

  return { apply, frame, resize }
}

const browserTerminalScreen = createTerminalScreen(
  Math.max(80, Math.floor((globalThis.innerWidth ?? 960) / 8)),
  Math.max(24, Math.floor((globalThis.innerHeight ?? 720) / 24)),
)

function createBrowserWriteStream(name) {
  return {
    ...createEventTargetLike(),
    isTTY: true,
    writable: true,
    columns: 120,
    rows: 30,
    write(chunk, encodingOrCallback, callback) {
      const callbackFn =
        typeof encodingOrCallback === 'function' ? encodingOrCallback : callback
      const text =
        typeof chunk === 'string'
          ? chunk
          : chunk instanceof Uint8Array
            ? new TextDecoder().decode(chunk)
            : String(chunk ?? '')
      if (name === 'stdout') {
        browserTerminalScreen.apply(text)
      }
      const terminalFrame =
        name === 'stdout' ? browserTerminalScreen.frame() : undefined
      if (text.trim() || terminalFrame?.trim()) {
        const globals = globalThis
        globals.__openclaudeProcessWrites ??= []
        if (terminalFrame !== undefined) {
          globals.__openclaudeTerminalFrame = terminalFrame
        }
        const entry = {
          stream: name,
          text,
          timestamp: Date.now(),
          terminalFrame,
        }
        globals.__openclaudeProcessWrites.push(entry)
        globals.dispatchEvent?.(
          new CustomEvent('openclaude:process-write', { detail: entry }),
        )
      }
      callbackFn?.()
      return true
    },
    clearLine() {
      return true
    },
    cursorTo() {
      return true
    },
    moveCursor() {
      return true
    },
  }
}

function createBrowserReadStream() {
  return {
    ...createEventTargetLike(),
    isTTY: true,
    readable: true,
    setEncoding() {
      return this
    },
    setRawMode() {
      return this
    },
    resume() {
      return this
    },
    pause() {
      return this
    },
    ref() {
      return this
    },
    unref() {
      return this
    },
    read() {
      return null
    },
  }
}

export const stdin = createBrowserReadStream()
export const stdout = createBrowserWriteStream('stdout')
export const stderr = createBrowserWriteStream('stderr')

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

const eventListeners = new Map()

function getEventListeners(event) {
  const key = String(event)
  const listeners = eventListeners.get(key) ?? []
  if (!eventListeners.has(key)) {
    eventListeners.set(key, listeners)
  }
  return listeners
}

export function on(event, listener) {
  if (typeof listener === 'function') {
    getEventListeners(event).push(listener)
  }
  return process
}

export function addListener(event, listener) {
  return on(event, listener)
}

export function once(event, listener) {
  if (typeof listener !== 'function') return process
  const wrapper = (...args) => {
    removeListener(event, wrapper)
    listener(...args)
  }
  wrapper.listener = listener
  return on(event, wrapper)
}

export function prependListener(event, listener) {
  if (typeof listener === 'function') {
    getEventListeners(event).unshift(listener)
  }
  return process
}

export function prependOnceListener(event, listener) {
  if (typeof listener !== 'function') return process
  const wrapper = (...args) => {
    removeListener(event, wrapper)
    listener(...args)
  }
  wrapper.listener = listener
  return prependListener(event, wrapper)
}

export function off(event, listener) {
  return removeListener(event, listener)
}

export function removeListener(event, listener) {
  if (typeof listener !== 'function') return process
  const key = String(event)
  const listeners = eventListeners.get(key)
  if (!listeners) return process
  eventListeners.set(
    key,
    listeners.filter(
      current => current !== listener && current.listener !== listener,
    ),
  )
  return process
}

export function removeAllListeners(event) {
  if (event === undefined) {
    eventListeners.clear()
  } else {
    eventListeners.delete(String(event))
  }
  return process
}

export function listeners(event) {
  return [...(eventListeners.get(String(event)) ?? [])]
}

export function listenerCount(event) {
  return eventListeners.get(String(event))?.length ?? 0
}

export function emit(event, ...args) {
  const current = listeners(event)
  for (const listener of current) {
    listener(...args)
  }
  return current.length > 0
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
  execPath,
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
  addListener,
  once,
  prependListener,
  prependOnceListener,
  off,
  removeListener,
  removeAllListeners,
  listeners,
  listenerCount,
  emit,
  setEnv,
  updateEnv,
  clearEnv,
}

export default process
