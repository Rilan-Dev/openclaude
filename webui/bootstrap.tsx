import processShim from './shims/process.js'
import * as browserNodeBuiltins from './shims/nodeBuiltins.js'
import { Buffer as BrowserBuffer } from './shims/nodeBuiltins.js'
import hljs from 'highlight.js'

globalThis.process = processShim

processShim.updateEnv({
  OPENCLAUDE_RENDER_MODE: 'web',
  OPENCLAUDE_DISABLE_CLI_ENTRYPOINT_AUTO_RUN: '1',
  CLAUDE_CODE_NO_FLICKER: '1',
  CLAUDE_CODE_DISABLE_MOUSE: '1',
  OPENCLAUDE_USE_DATA_STDIN: '1',
})

if (!globalThis.Buffer) {
  globalThis.Buffer = BrowserBuffer
}

if (!('global' in globalThis)) {
  ;(globalThis as typeof globalThis & { global: typeof globalThis }).global =
    globalThis
}

type TimerCompatHandle = {
  readonly __openclaudeTimerHandle: ReturnType<typeof setTimeout>
  ref: () => TimerCompatHandle
  unref: () => TimerCompatHandle
  hasRef: () => boolean
  valueOf: () => ReturnType<typeof setTimeout>
  [Symbol.toPrimitive]: () => ReturnType<typeof setTimeout>
}

type BootstrapOptions = {
  rootId?: string
}

type BrowserGlobals = typeof globalThis & {
  __openclaudeProcessWrites?: Array<{
    stream: string
    text: string
    timestamp: number
    terminalFrame?: string
  }>
  __openclaudeTerminalFrame?: string
}

function hasBrowserProviderProfileConfig(): boolean {
  try {
    const rawVfs = globalThis.localStorage?.getItem('openclaude.webui.fs.v1')
    if (!rawVfs) {
      return false
    }

    const vfs = JSON.parse(rawVfs) as {
      files?: Record<string, { content?: string }>
    }
    const rawConfig = vfs.files?.['/.openclaude.json']?.content
    if (!rawConfig) {
      return false
    }

    const config = JSON.parse(rawConfig) as {
      activeProviderProfileId?: unknown
      providerProfiles?: unknown
    }
    return (
      Array.isArray(config.providerProfiles) &&
      config.providerProfiles.length > 0
    )
  } catch {
    return false
  }
}

function getConcreteProviderEnvKeys(): string[] {
  const env = processShim.env as Record<string, string | undefined>
  const openAIKeyIsCodexOAuthToken =
    Boolean(env.OPENAI_API_KEY) &&
    env.OPENAI_API_KEY === env.CLAUDE_CODE_OAUTH_TOKEN &&
    !env.OPENAI_BASE_URL &&
    !env.OPENAI_API_BASE &&
    !env.OPENAI_MODEL &&
    !env.CLAUDE_CODE_USE_OPENAI
  return [
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'CLAUDE_CODE_USE_OPENAI',
    'CLAUDE_CODE_USE_GITHUB',
    'CLAUDE_CODE_USE_GEMINI',
    'CLAUDE_CODE_USE_MISTRAL',
    'CLAUDE_CODE_USE_BEDROCK',
    'CLAUDE_CODE_USE_VERTEX',
    'CLAUDE_CODE_USE_FOUNDRY',
    'OPENAI_BASE_URL',
    'OPENAI_API_BASE',
    'OPENAI_MODEL',
    ...(openAIKeyIsCodexOAuthToken ? [] : ['OPENAI_API_KEY']),
    'OPENAI_API_KEYS',
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
  ].filter(key => Boolean(env[key]))
}

function hasConcreteProviderEnv(): boolean {
  return getConcreteProviderEnvKeys().length > 0
}

function logProviderEnvCheckpoint(label: string): void {
  if (processShim.env.OPENCLAUDE_WEBUI_DEBUG_PROVIDER_ENV !== '1') {
    return
  }

  const env = processShim.env as Record<string, string | undefined>
  console.log(`[OpenClaude WebUI provider-env] ${label}`, {
    CLAUDE_CODE_USE_OPENAI: env.CLAUDE_CODE_USE_OPENAI ?? null,
    CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED:
      env.CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED ?? null,
    OPENAI_BASE_URL: env.OPENAI_BASE_URL ?? null,
    OPENAI_API_BASE: env.OPENAI_API_BASE ?? null,
    OPENAI_MODEL: env.OPENAI_MODEL ?? null,
    OPENAI_API_FORMAT: env.OPENAI_API_FORMAT ?? null,
    CODEX_API_KEY: env.CODEX_API_KEY ? '<set>' : null,
    CODEX_CREDENTIAL_SOURCE: env.CODEX_CREDENTIAL_SOURCE ?? null,
    CHATGPT_ACCOUNT_ID: env.CHATGPT_ACCOUNT_ID ? '<set>' : null,
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY ? '<set>' : null,
    CLAUDE_CODE_OAUTH_TOKEN: env.CLAUDE_CODE_OAUTH_TOKEN ? '<set>' : null,
    VITE_BACKEND_ORIGIN: env.VITE_BACKEND_ORIGIN ?? null,
  })
}

function stripAnsiControl(text: string): string {
  return text
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
}

function getLatestTerminalOutput(): string {
  const globals = globalThis as BrowserGlobals
  if (globals.__openclaudeTerminalFrame?.trim()) {
    return globals.__openclaudeTerminalFrame
  }

  const writes = globals.__openclaudeProcessWrites ?? []
  const frames = writes.filter(write =>
    write.stream === 'stdout' && stripAnsiControl(write.text).trim().length > 0,
  )
  return frames.at(-1)?.text ?? ''
}

function rewriteExternalRequestUrl(url: string): string | null {
  try {
    const parsed = new URL(url, globalThis.location?.href)
    const currentOrigin = globalThis.location?.origin
    if (
      parsed.origin === currentOrigin ||
      !['http:', 'https:'].includes(parsed.protocol)
    ) {
      return null
    }

    return `/__openclaude_provider?url=${encodeURIComponent(parsed.toString())}`
  } catch {
    return null
  }
}

function installBootPlaceholder(rootId = 'root'): void {
  const root = globalThis.document?.getElementById(rootId)
  if (!root) {
    return
  }

  const container = globalThis.document.createElement('div')
  container.className = 'openclaude-web-tuiBoot'
  container.setAttribute('data-openclaude-boot', 'true')

  const terminal = globalThis.document.createElement('pre')
  terminal.className = 'openclaude-web-tuiBoot__terminal'
  container.appendChild(terminal)
  root.replaceChildren(container)

  const update = () => {
    terminal.textContent =
      stripAnsiControl(getLatestTerminalOutput()) ||
      'Starting OpenClaude CLI entrypoint...'
  }

  globalThis.addEventListener('openclaude:process-write', update)
  update()
}

function installSetImmediateCompat(): void {
  const globals = globalThis as typeof globalThis & {
    setImmediate?: (
      callback: (...args: unknown[]) => void,
      ...args: unknown[]
    ) => TimerCompatHandle
    clearImmediate?: (handle: TimerCompatHandle) => void
  }

  globals.setImmediate ??= (callback, ...args) =>
    globalThis.setTimeout(() => callback(...args), 0) as TimerCompatHandle
  globals.clearImmediate ??= handle => {
    globalThis.clearTimeout(handle)
  }
}

function installForbiddenHeaderCompat(): void {
  if (typeof XMLHttpRequest === 'undefined') {
    return
  }

  const prototype = XMLHttpRequest.prototype as XMLHttpRequest & {
    __openclaudeForbiddenHeaderCompatInstalled__?: boolean
  }

  if (prototype.__openclaudeForbiddenHeaderCompatInstalled__) {
    return
  }

  prototype.__openclaudeForbiddenHeaderCompatInstalled__ = true
  const nativeOpen = prototype.open
  const nativeSetRequestHeader = prototype.setRequestHeader

  prototype.open = function open(
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
    const urlString = typeof url === 'string' ? url : url.href
    const rewrittenUrl = rewriteExternalRequestUrl(urlString) ?? urlString
    return nativeOpen.call(
      this,
      method,
      rewrittenUrl,
      async ?? true,
      username ?? null,
      password ?? null,
    )
  }

  prototype.setRequestHeader = function setRequestHeader(name, value) {
    if (name.toLowerCase() === 'user-agent') {
      return
    }

    return nativeSetRequestHeader.call(this, name, value)
  }
}

function installBrowserFetchCompat(): void {
  const globals = globalThis as typeof globalThis & {
    __openclaudeFetchCompatInstalled__?: boolean
  }

  if (globals.__openclaudeFetchCompatInstalled__ || typeof fetch === 'undefined') {
    return
  }

  globals.__openclaudeFetchCompatInstalled__ = true
  const nativeFetch = globalThis.fetch.bind(globalThis)

  const createCodexModelsResponse = (): Response => {
    const configuredModel =
      processShim.env.OPENAI_MODEL?.trim() || 'codexplan'
    const ids = Array.from(
      new Set([
        configuredModel,
        'gpt-5.5',
        'gpt-5.4',
        'gpt-5.3-codex',
        'gpt-5.3-codex-spark',
        'gpt-5.2-codex',
        'gpt-5.1-codex-max',
        'gpt-5.1-codex-mini',
        'gpt-5.5-mini',
        'gpt-5.4-mini',
      ]),
    )

    return new Response(
      JSON.stringify({
        object: 'list',
        data: ids.map(id => ({
          id,
          object: 'model',
          created: 0,
          owned_by: 'openclaude-codex-oauth',
        })),
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    )
  }

  globalThis.fetch = ((input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url

    try {
      const parsed = new URL(url, globalThis.location?.href)
      if (
        parsed.origin === 'https://chatgpt.com' &&
        parsed.pathname.replace(/\/+$/, '') === '/backend-api/codex/models'
      ) {
        return Promise.resolve(createCodexModelsResponse())
      }
    } catch {}

    const rewrittenUrl = rewriteExternalRequestUrl(url)
    if (rewrittenUrl) {
      if (input instanceof Request) {
        return nativeFetch(new Request(rewrittenUrl, input), init)
      }

      return nativeFetch(rewrittenUrl, init)
    }

    return nativeFetch(input, init)
  }) as typeof globalThis.fetch
}

function removeBrowserLocalProviderOverrides(): void {
  const env = processShim.env as Record<string, string | undefined>

  const isLocalBrowserApiUrl = (value: string | undefined): boolean => {
    if (!value) {
      return false
    }

    const trimmed = value.trim()
    if (trimmed === '/api' || trimmed.startsWith('/api/')) {
      return true
    }

    try {
      const parsed = new URL(trimmed, globalThis.location?.href)
      const currentOrigin = globalThis.location?.origin

      return (
        parsed.origin === currentOrigin ||
        ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)
      )
    } catch {
      return false
    }
  }

  const hasLocalOverride =
    isLocalBrowserApiUrl(env.OPENAI_BASE_URL) ||
    isLocalBrowserApiUrl(env.OPENAI_API_BASE) ||
    isLocalBrowserApiUrl(env.VITE_BACKEND_ORIGIN)

  if (!hasLocalOverride) {
    return
  }

  for (const key of [
    'CLAUDE_CODE_USE_OPENAI',
    'CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED',
    'CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED_ID',
    'OPENAI_BASE_URL',
    'OPENAI_API_BASE',
    'OPENAI_MODEL',
    'OPENAI_API_FORMAT',
    'OPENAI_AUTH_HEADER',
    'OPENAI_AUTH_SCHEME',
    'OPENAI_AUTH_HEADER_VALUE',
    'VITE_BACKEND_ORIGIN',
  ]) {
    delete env[key]
  }
}

function removePlaceholderProviderSecrets(): void {
  const env = processShim.env as Record<string, string | undefined>
  const placeholderValues = new Set([
    'sk-ant-your-key-here',
    'sk-your-key-here',
    'your-api-key-here',
    'your-key-here',
  ])

  for (const key of [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'OPENGATEWAY_API_KEY',
    'GEMINI_API_KEY',
  ]) {
    const value = env[key]?.trim()
    if (value && placeholderValues.has(value)) {
      delete env[key]
    }
  }
}

async function applyBrowserCodexOAuthFallback(): Promise<void> {
  const env = processShim.env as Record<string, string | undefined>
  const oauthToken = env.CLAUDE_CODE_OAUTH_TOKEN?.trim()
  logProviderEnvCheckpoint('before codex oauth fallback')
  const hasConcreteEnv = hasConcreteProviderEnv()
  const hasProfiles = hasBrowserProviderProfileConfig()

  if (!oauthToken || hasConcreteEnv || hasProfiles) {
    if (env.OPENCLAUDE_WEBUI_DEBUG_PROVIDER_ENV === '1') {
      console.log('[OpenClaude WebUI provider-env] skipped codex oauth fallback', {
        hasOAuthToken: Boolean(oauthToken),
        hasConcreteProviderEnv: hasConcreteEnv,
        concreteProviderEnvKeys: getConcreteProviderEnvKeys(),
        hasBrowserProviderProfileConfig: hasProfiles,
      })
    }
    return
  }

  const { buildCodexOAuthProfileEnv } = await import(
    '../src/utils/providerProfile.js'
  )
  const profileEnv = buildCodexOAuthProfileEnv({ accessToken: oauthToken })

  if (!profileEnv) {
    return
  }

  processShim.updateEnv({
    CLAUDE_CODE_USE_OPENAI: '1',
    CODEX_API_KEY: oauthToken,
    ...profileEnv,
  })
  logProviderEnvCheckpoint('after codex oauth fallback')
}

function installNodeTimerCompat(): void {
  const globals = globalThis as typeof globalThis & {
    __openclaudeNodeTimerCompatInstalled__?: boolean
  }

  if (globals.__openclaudeNodeTimerCompatInstalled__) {
    return
  }

  globals.__openclaudeNodeTimerCompatInstalled__ = true

  const nativeSetTimeout = globalThis.setTimeout.bind(globalThis)
  const nativeSetInterval = globalThis.setInterval.bind(globalThis)
  const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis)
  const nativeClearInterval = globalThis.clearInterval.bind(globalThis)

  const unwrapTimerHandle = (
    handle: Parameters<typeof clearTimeout>[0] | TimerCompatHandle,
  ): Parameters<typeof clearTimeout>[0] => {
    if (
      handle &&
      typeof handle === 'object' &&
      '__openclaudeTimerHandle' in handle
    ) {
      return handle.__openclaudeTimerHandle
    }

    return handle
  }

  const makeTimerHandle = (
    nativeHandle: ReturnType<typeof setTimeout>,
  ): TimerCompatHandle => {
    let refed = true
    const compatHandle: TimerCompatHandle = {
      __openclaudeTimerHandle: nativeHandle,
      ref() {
        refed = true
        return compatHandle
      },
      unref() {
        refed = false
        return compatHandle
      },
      hasRef() {
        return refed
      },
      valueOf() {
        return nativeHandle
      },
      [Symbol.toPrimitive]() {
        return nativeHandle
      },
    }

    return compatHandle
  }

  globalThis.setTimeout = ((handler, timeout, ...args) =>
    makeTimerHandle(
      nativeSetTimeout(handler as TimerHandler, timeout, ...args),
    )) as typeof globalThis.setTimeout

  globalThis.setInterval = ((handler, timeout, ...args) =>
    makeTimerHandle(
      nativeSetInterval(handler as TimerHandler, timeout, ...args),
    )) as typeof globalThis.setInterval

  globalThis.clearTimeout = (handle => {
    nativeClearTimeout(unwrapTimerHandle(handle))
  }) as typeof globalThis.clearTimeout

  globalThis.clearInterval = (handle => {
    nativeClearInterval(unwrapTimerHandle(handle))
  }) as typeof globalThis.clearInterval
}

function installBrowserRequire(): void {
  const browserRequire = (id: string) => {
    if (id === 'crypto' || id === 'node:crypto') {
      return browserNodeBuiltins
    }
    if (id === 'highlight.js') {
      return hljs
    }

    throw new Error(
      `Untransformed require("${id}") reached the browser bundle. ` +
        `The browserRequireToStaticImport() Vite plugin should rewrite ` +
        `literal internal require('./x') calls before runtime.`,
    )
  }

  const globals = globalThis as typeof globalThis & {
    require?: typeof browserRequire
  }

  if (!globals.require) {
    globals.require = browserRequire
  }
}

function browserKeyToTerminalInput(event: KeyboardEvent): string | null {
  const key = event.key

  if (event.ctrlKey && key.length === 1) {
    const upper = key.toUpperCase()
    const code = upper.charCodeAt(0)
    if (code >= 64 && code <= 95) {
      return String.fromCharCode(code - 64)
    }
  }

  const base =
    key === 'Enter'
      ? '\r'
      : key === 'Backspace'
        ? '\x7f'
        : key === 'Delete'
          ? '\x1b[3~'
          : key === 'Escape'
            ? '\x1b'
            : key === 'Tab'
              ? event.shiftKey
                ? '\x1b[Z'
                : '\t'
              : key === 'ArrowUp'
                ? event.shiftKey
                  ? '\x1b[a'
                  : event.ctrlKey
                    ? '\x1bOa'
                    : '\x1b[A'
                : key === 'ArrowDown'
                  ? event.shiftKey
                    ? '\x1b[b'
                    : event.ctrlKey
                      ? '\x1bOb'
                      : '\x1b[B'
                  : key === 'ArrowRight'
                    ? event.shiftKey
                      ? '\x1b[c'
                      : event.ctrlKey
                        ? '\x1bOc'
                        : '\x1b[C'
                    : key === 'ArrowLeft'
                      ? event.shiftKey
                        ? '\x1b[d'
                        : event.ctrlKey
                          ? '\x1bOd'
                          : '\x1b[D'
                      : key === 'Home'
                        ? '\x1b[H'
                        : key === 'End'
                          ? '\x1b[F'
                          : key === 'PageUp'
                            ? '\x1b[5~'
                            : key === 'PageDown'
                              ? '\x1b[6~'
                              : key.length === 1 && !event.metaKey && !event.ctrlKey
                                ? key
                                : null

  if (!base) {
    return null
  }

  return event.altKey && base !== '\x1b' ? `\x1b${base}` : base
}

function isBrowserPasteShortcut(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    event.key.toLowerCase() === 'v'
  )
}

function installBrowserKeyboardInputCompat(): void {
  const globals = globalThis as typeof globalThis & {
    __openclaudeKeyboardInputCompatInstalled__?: boolean
  }

  if (globals.__openclaudeKeyboardInputCompatInstalled__) {
    return
  }

  globals.__openclaudeKeyboardInputCompatInstalled__ = true

  globalThis.document?.body?.setAttribute('tabindex', '-1')
  globalThis.document?.body?.focus()

  const shouldIgnoreEventTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false
    }

    const tag = target.tagName.toLowerCase()
    return (
      target.isContentEditable ||
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select'
    )
  }

  globalThis.addEventListener(
    'keydown',
    event => {
      if (shouldIgnoreEventTarget(event.target)) {
        return
      }

      if (isBrowserPasteShortcut(event)) {
        return
      }

      const input = browserKeyToTerminalInput(event)
      if (!input) {
        return
      }

      event.preventDefault()
      processShim.stdin.emit('data', input)
    },
    { capture: true },
  )

  globalThis.addEventListener(
    'paste',
    event => {
      if (shouldIgnoreEventTarget(event.target)) {
        return
      }

      const text = event.clipboardData?.getData('text/plain')
      if (!text) {
        return
      }

      event.preventDefault()
      processShim.stdin.emit('data', `\x1b[200~${text}\x1b[201~`)
    },
    { capture: true },
  )

  globalThis.addEventListener('pointerdown', () => {
    globalThis.document?.body?.focus()
  })
}

export async function bootstrapOpenClaudeWebUI(
  options: BootstrapOptions = {},
): Promise<void> {
  installBootPlaceholder(options.rootId)
  installNodeTimerCompat()
  installSetImmediateCompat()
  installForbiddenHeaderCompat()
  installBrowserFetchCompat()
  installBrowserRequire()
  installBrowserKeyboardInputCompat()
  removeBrowserLocalProviderOverrides()
  removePlaceholderProviderSecrets()
  await applyBrowserCodexOAuthFallback()
  logProviderEnvCheckpoint('before cli entrypoint import')

  if (options.rootId) {
    ;(globalThis as typeof globalThis & {
      __OPENCLAUDE_WEB_ROOT_ID__?: string
    }).__OPENCLAUDE_WEB_ROOT_ID__ = options.rootId
  }

  const { main } = await import('../src/entrypoints/cli.js')

  await main([])
}
