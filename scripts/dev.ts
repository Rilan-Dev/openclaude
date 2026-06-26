import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { loadLocalCodexAuthEnv } from './provider-env.ts'

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

const DEFAULT_CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex'

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

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return (
    normalized !== '' &&
    normalized !== '0' &&
    normalized !== 'false' &&
    normalized !== 'no'
  )
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

  const explicit = normalizeUpstreamBaseUrl(process.env.OPENAI_BASE_URL)
  const isDefaultOpenAIUpstream =
    explicit.origin === 'https://api.openai.com' &&
    explicit.pathname.replace(/\/+$/, '') === '/v1'
  const isCodexUpstream =
    explicit.origin === 'https://chatgpt.com' &&
    explicit.pathname.replace(/\/+$/, '') === '/backend-api/codex'

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
  process.env.OPENAI_BASE_URL = DEFAULT_CODEX_BASE_URL
  if (auth.accountId) {
    process.env.CHATGPT_ACCOUNT_ID = auth.accountId
    process.env.CODEX_ACCOUNT_ID = auth.accountId
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

    applyBrowserCodexRuntimeEnv()

    process.exitCode = await run(process.execPath, [
      'run',
      '--cwd',
      'webui',
      'dev',
    ])
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
