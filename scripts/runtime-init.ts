import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadLocalCodexAuthEnv } from './provider-env.ts'

export type OpenClaudeRenderMode = 'terminal' | 'web'

const DEFAULT_CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex'

type CodexBrowserAuth = {
  accessToken?: string
  accountId?: string
}

function readRenderModeFromDotEnv(): OpenClaudeRenderMode | undefined {
  for (const filePath of ['.env', 'webui/.env']) {
    try {
      const raw = readFileSync(filePath, 'utf8')
      const match = raw.match(/^\s*OPENCLAUDE_RENDER_MODE\s*=\s*(.+)\s*$/m)
      if (!match?.[1]) continue
      const value = match[1].trim().replace(/^['"]|['"]$/g, '')
      if (value === 'web' || value === 'terminal') {
        return value
      }
    } catch {
      // Try the next file.
    }
  }

  return undefined
}

function resolveOpenClaudeRenderMode(): OpenClaudeRenderMode {
  const explicit = process.env.OPENCLAUDE_RENDER_MODE?.trim().toLowerCase()
  if (explicit === 'web' || explicit === 'terminal') {
    return explicit
  }

  return readRenderModeFromDotEnv() ?? 'terminal'
}

function resolveCodexAuthPath(): string {
  const explicit = process.env.CODEX_AUTH_JSON_PATH?.trim()
  if (explicit) return explicit

  const codexHome = process.env.CODEX_HOME?.trim()
  if (codexHome) return join(codexHome, 'auth.json')

  return join(process.cwd(), '.openai-codex-auth.json')
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized !== '' && normalized !== '0' && normalized !== 'false' && normalized !== 'no'
}

function readCodexAuthFromDisk(): CodexBrowserAuth | undefined {
  const authPath = resolveCodexAuthPath()

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

function applyBrowserCodexRuntimeEnv(): void {
  const auth = readCodexAuthFromDisk()
  if (!auth?.accessToken) return

  if (
    process.env.CLAUDE_CODE_USE_OPENAI !== undefined &&
    !isTruthyEnv(process.env.CLAUDE_CODE_USE_OPENAI)
  ) {
    return
  }

  const currentBaseUrl = (process.env.OPENAI_BASE_URL ?? '').trim() || 'https://api.openai.com/v1'
  let baseUrl: URL
  try {
    baseUrl = new URL(currentBaseUrl)
  } catch {
    baseUrl = new URL('https://api.openai.com/v1')
  }

  const isDefaultOpenAIUpstream =
    baseUrl.origin === 'https://api.openai.com' &&
    baseUrl.pathname.replace(/\/+$/, '') === '/v1'
  const isCodexUpstream =
    baseUrl.origin === 'https://chatgpt.com' &&
    baseUrl.pathname.replace(/\/+$/, '') === '/backend-api/codex'

  if (!isDefaultOpenAIUpstream && !isCodexUpstream) {
    return
  }

  process.env.CLAUDE_CODE_USE_OPENAI = '1'
  process.env.CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED = '1'
  process.env.CLAUDE_CODE_OAUTH_TOKEN = auth.accessToken
  process.env.CODEX_API_KEY = auth.accessToken
  process.env.CODEX_CREDENTIAL_SOURCE = 'oauth'
  process.env.OPENAI_API_KEY = auth.accessToken
  process.env.OPENAI_API_FORMAT = 'responses'
  process.env.OPENAI_MODEL = 'codexplan'
  process.env.OPENAI_BASE_URL = '/api'
  process.env.VITE_BACKEND_ORIGIN = DEFAULT_CODEX_BASE_URL
  if (auth.accountId) {
    process.env.CHATGPT_ACCOUNT_ID = auth.accountId
    process.env.CODEX_ACCOUNT_ID = auth.accountId
  }
}

export function initializeOpenClaudeRuntime(): {
  renderMode: OpenClaudeRenderMode
  isWebRuntime: boolean
} {
  loadLocalCodexAuthEnv()

  const renderMode = resolveOpenClaudeRenderMode()
  process.env.OPENCLAUDE_RENDER_MODE = renderMode

  const isWebRuntime = renderMode === 'web'
  if (isWebRuntime) {
    applyBrowserCodexRuntimeEnv()
  }

  return {
    renderMode,
    isWebRuntime,
  }
}
