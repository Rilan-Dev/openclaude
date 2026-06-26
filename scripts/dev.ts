import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { loadLocalCodexAuthEnv } from './provider-env.ts'
import { redactUrlForDisplay } from '../src/utils/urlRedaction.js'

function run(
  command: string,
  args: string[],
  options: {
    cwd?: string
    env?: NodeJS.ProcessEnv
  } = {},
): Promise<number> {
  return new Promise(resolve => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
      stdio: 'inherit',
    })

    child.on('close', code => resolve(code ?? 1))
    child.on('error', () => resolve(1))
  })
}

function readRenderModeFromDotEnv(): string | undefined {
  for (const filePath of ['.env', 'webui/.env']) {
    try {
      const raw = readFileSync(filePath, 'utf8')
      const match = raw.match(/^\s*OPENCLAUDE_RENDER_MODE\s*=\s*(.+)\s*$/m)
      if (!match?.[1]) continue
      return match[1].trim().replace(/^['"]|['"]$/g, '')
    } catch {
      // Try the next file.
    }
  }

  return undefined
}

type CodexBrowserAuth = {
  accessToken?: string
  accountId?: string
}

function resolveCodexAuthPath(): string | undefined {
  const explicit = process.env.CODEX_AUTH_JSON_PATH?.trim()
  if (explicit) return explicit

  const codexHome = process.env.CODEX_HOME?.trim()
  if (codexHome) return join(codexHome, 'auth.json')

  const fallback = join(process.cwd(), '.openai-codex-auth.json')
  return fallback
}

function readCodexAuthFromDisk(): CodexBrowserAuth | undefined {
  const authPath = resolveCodexAuthPath()
  if (!authPath) return undefined

  try {
    const raw = readFileSync(authPath, 'utf8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const tokens =
      parsed.tokens && typeof parsed.tokens === 'object'
        ? (parsed.tokens as Record<string, unknown>)
        : undefined

    const accessToken =
      (typeof parsed.access_token === 'string' && parsed.access_token.trim()) ||
      (typeof parsed.accessToken === 'string' && parsed.accessToken.trim()) ||
      (typeof tokens?.access_token === 'string' && tokens.access_token.trim()) ||
      (typeof tokens?.accessToken === 'string' && tokens.accessToken.trim()) ||
      undefined
    const accountId =
      (typeof parsed.account_id === 'string' && parsed.account_id.trim()) ||
      (typeof parsed.accountId === 'string' && parsed.accountId.trim()) ||
      (typeof tokens?.account_id === 'string' && tokens.account_id.trim()) ||
      (typeof tokens?.accountId === 'string' && tokens.accountId.trim()) ||
      undefined

    if (!accessToken && !accountId) return undefined
    return { accessToken, accountId }
  } catch {
    return undefined
  }
}

function buildProbeHeaders(auth?: CodexBrowserAuth): Record<string, string> {
  const headers: Record<string, string> = {}
  if (auth?.accessToken) {
    headers.authorization = `Bearer ${auth.accessToken}`
  }
  if (auth?.accountId) {
    headers['chatgpt-account-id'] = auth.accountId
  }
  return headers
}

async function runWebProviderPrecheck(): Promise<number> {
  const upstreamBase = normalizeUpstreamBaseUrl(process.env.OPENAI_BASE_URL)
  const auth = readCodexAuthFromDisk()
  const useResponsesProbe =
    upstreamBase.pathname.includes('/backend-api/codex') ||
    (process.env.OPENAI_API_FORMAT?.trim().toLowerCase() === 'responses')
  const probePath = useResponsesProbe ? '/responses' : '/models'
  const probeUrl = new URL(upstreamBase.toString())
  probeUrl.pathname = joinUrlPath(upstreamBase.pathname, probePath)
  probeUrl.search = ''
  probeUrl.hash = ''

  const body = useResponsesProbe
    ? JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || 'codexplan',
        instructions: 'OpenClaude web dev preflight.',
        input: [
          {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: 'ping' }],
          },
        ],
        stream: true,
        store: false,
      })
    : undefined

  try {
    const response = await fetch(probeUrl, {
      method: useResponsesProbe ? 'POST' : 'GET',
      headers: {
        ...buildProbeHeaders(auth),
        ...(useResponsesProbe ? { 'content-type': 'application/json' } : {}),
      },
      body,
    })

    if (response.status === 200 || response.status === 401 || response.status === 403) {
      console.log(
        `[web] Provider precheck reached ${redactUrlForDisplay(probeUrl.toString())} (status ${response.status})`,
      )
      return 0
    }

    const text = await response.text().catch(() => '')
    console.error(
      `[web] Provider precheck failed for ${redactUrlForDisplay(probeUrl.toString())}: unexpected status ${response.status}${text ? ` - ${text.slice(0, 240)}` : ''}`,
    )
    return 1
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      `[web] Provider precheck failed for ${redactUrlForDisplay(probeUrl.toString())}: ${message}`,
    )
    return 1
  }
}

type WebApiProxy = {
  stop: () => void
  url: string
}

async function isHealthyExistingWebApiProxy(
  proxyUrl: string,
  expectedUpstream: string,
): Promise<boolean> {
  const healthUrl = new URL('/__health', proxyUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1000)

  try {
    const response = await fetch(healthUrl, { signal: controller.signal })
    if (!response.ok) return false

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; upstream?: string }
      | null
    return (
      payload?.ok === true &&
      typeof payload.upstream === 'string' &&
      payload.upstream === expectedUpstream
    )
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeUpstreamBaseUrl(raw: string | undefined): URL {
  const fallback = 'https://api.openai.com/v1'
  const candidate = raw?.trim() || fallback
  try {
    return new URL(candidate)
  } catch {
    return new URL(fallback)
  }
}

function joinUrlPath(basePath: string, requestPath: string): string {
  const left = basePath.replace(/\/+$/, '')
  const right = requestPath.replace(/^\/+/, '')
  if (!left && !right) return '/'
  if (!left) return `/${right}`
  if (!right) return left
  return `${left}/${right}`.replace(/\/{2,}/g, '/')
}

function makeCorsHeaders(request: Request): Headers {
  const headers = new Headers()
  const origin = request.headers.get('origin')
  headers.set('Access-Control-Allow-Origin', origin?.trim() || '*')
  headers.set(
    'Access-Control-Allow-Methods',
    'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
  )
  headers.set(
    'Access-Control-Allow-Headers',
    request.headers.get('access-control-request-headers') ||
      'authorization,content-type,chatgpt-account-id,originator,openai-organization,openai-project,openai-beta,x-request-id',
  )
  headers.set('Access-Control-Max-Age', '86400')
  headers.set('Vary', 'Origin')
  return headers
}

function addCorsHeaders(headers: Headers, request: Request): void {
  const corsHeaders = makeCorsHeaders(request)
  for (const [key, value] of corsHeaders) {
    headers.set(key, value)
  }
  headers.set('Access-Control-Expose-Headers', 'content-type,x-request-id,openai-processing-ms')
}

function stripHopByHopHeaders(headers: Headers): void {
  for (const key of [
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
    'transfer-encoding',
    'upgrade',
    'content-length',
    'content-encoding',
  ]) {
    headers.delete(key)
  }
}

async function startWebApiProxy(): Promise<WebApiProxy> {
  const upstreamBaseUrl = normalizeUpstreamBaseUrl(process.env.OPENAI_BASE_URL)
  const proxyUrl = 'http://127.0.0.1:31337'
  const expectedUpstream = redactUrlForDisplay(upstreamBaseUrl.toString())

  if (await isHealthyExistingWebApiProxy(proxyUrl, expectedUpstream)) {
    console.log(
      `[web] Reusing existing transparent OpenAI proxy at ${proxyUrl} -> ${expectedUpstream}`,
    )
    return {
      stop: () => {},
      url: proxyUrl,
    }
  }

  try {
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 31337,
      fetch: async request => {
        const url = new URL(request.url)

      if (request.method === 'OPTIONS') {
        const headers = makeCorsHeaders(request)
        headers.set('Content-Type', 'text/plain; charset=utf-8')
        return new Response(null, { status: 204, headers })
      }

      if (url.pathname === '/__health') {
        const headers = makeCorsHeaders(request)
        headers.set('Content-Type', 'application/json; charset=utf-8')
        return new Response(
          JSON.stringify({
            ok: true,
            upstream: redactUrlForDisplay(upstreamBaseUrl.toString()),
          }),
          { status: 200, headers },
        )
      }

      const targetUrl = new URL(upstreamBaseUrl.toString())
      targetUrl.pathname = joinUrlPath(upstreamBaseUrl.pathname, url.pathname)
      targetUrl.search = url.search
      targetUrl.hash = ''

      const upstreamHeaders = new Headers(request.headers)
      for (const key of [
        'host',
        'origin',
        'referer',
        'content-length',
        'accept-encoding',
      ]) {
        upstreamHeaders.delete(key)
      }

      const upstreamResponse = await fetch(targetUrl, {
        method: request.method,
        headers: upstreamHeaders,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        signal: request.signal,
      })

      const responseHeaders = new Headers(upstreamResponse.headers)
      stripHopByHopHeaders(responseHeaders)
      addCorsHeaders(responseHeaders, request)

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      })
      },
    })

    const proxy = {
      stop: () => server.stop(true),
      url: `http://127.0.0.1:${server.port}`,
    }

    console.log(
      `[web] Transparent OpenAI proxy listening at ${proxy.url} -> ${expectedUpstream}`,
    )

    return proxy
  } catch (error) {
    const code = error && typeof error === 'object' ? (error as { code?: string }).code : undefined
    if (code === 'EADDRINUSE' && (await isHealthyExistingWebApiProxy(proxyUrl, expectedUpstream))) {
      console.log(
        `[web] Reusing existing transparent OpenAI proxy at ${proxyUrl} -> ${expectedUpstream}`,
      )
      return {
        stop: () => {},
        url: proxyUrl,
      }
    }

    throw error
  }
}

async function main(): Promise<void> {
  loadLocalCodexAuthEnv()

  const renderMode =
    process.env.OPENCLAUDE_RENDER_MODE?.trim().toLowerCase() ??
    readRenderModeFromDotEnv()?.trim().toLowerCase()

  if (renderMode === 'web') {
    const buildCode = await run(process.execPath, ['run', 'build'])
    if (buildCode !== 0) {
      process.exitCode = buildCode
      return
    }

    const precheckCode = await runWebProviderPrecheck()
    if (precheckCode !== 0) {
      process.stderr.write(
        'Web provider precheck failed. Fix configuration before launching the web UI.\n',
      )
      process.exitCode = precheckCode
      return
    }

    const webProxy = await startWebApiProxy()
    try {
      process.exitCode = await run(process.execPath, [
        'run',
        '--cwd',
        'webui',
        'dev',
      ])
    } finally {
      webProxy.stop()
    }
    return
  }

  const buildCode = await run(process.execPath, ['run', 'build'])
  if (buildCode !== 0) {
    process.exitCode = buildCode
    return
  }

  process.exitCode = await run('node', ['bin/openclaude'])
}

void main()
