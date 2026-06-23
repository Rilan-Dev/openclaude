import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  acquireEnvMutex,
  releaseEnvMutex,
} from '../src/entrypoints/sdk/shared.js'
import {
  loadLocalCodexAuthEnv,
  loadProviderEnvFiles,
} from './provider-env.ts'

const ENV_KEYS = [
  'CHATGPT_ACCOUNT_ID',
  'CODEX_ACCOUNT_ID',
  'CODEX_API_KEY',
  'CODEX_AUTH_JSON_PATH',
  'CODEX_HOME',
  'OPENAI_MODEL',
  'OPENAI_BASE_URL',
] as const

const originalEnv: Record<(typeof ENV_KEYS)[number], string | undefined> = {
  CHATGPT_ACCOUNT_ID: undefined,
  CODEX_ACCOUNT_ID: undefined,
  CODEX_API_KEY: undefined,
  CODEX_AUTH_JSON_PATH: undefined,
  CODEX_HOME: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_BASE_URL: undefined,
}

beforeEach(async () => {
  await acquireEnvMutex()
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = originalEnv[key]
    }
  }
  releaseEnvMutex()
})

test('loads only Codex auth env from a local .env file', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'openclaude-provider-env-'))
  try {
    writeFileSync(
      join(cwd, '.env'),
      [
        'CLAUDE_CODE_USE_OPENAI=1',
        'OPENAI_BASE_URL=https://api.openai.com/v1',
        'OPENAI_MODEL=gpt-5.5',
        'CODEX_AUTH_JSON_PATH=.openai-codex-auth.json',
        'CHATGPT_ACCOUNT_ID=acct_local_codex',
      ].join('\n'),
      'utf8',
    )

    loadLocalCodexAuthEnv({ cwd })

    expect(process.env.CODEX_AUTH_JSON_PATH).toBe('.openai-codex-auth.json')
    expect(process.env.CHATGPT_ACCOUNT_ID).toBe('acct_local_codex')
    expect(process.env.OPENAI_MODEL).toBeUndefined()
    expect(process.env.OPENAI_BASE_URL).toBeUndefined()
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('loads explicit provider env files', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'openclaude-provider-env-priority-'))
  try {
    const explicitEnvFile = join(cwd, 'codex.env')
    writeFileSync(
      explicitEnvFile,
      'CODEX_AUTH_JSON_PATH=explicit-auth.json',
      'utf8',
    )

    loadProviderEnvFiles(['--provider-env-file', explicitEnvFile])

    expect(process.env.CODEX_AUTH_JSON_PATH).toBe('explicit-auth.json')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
