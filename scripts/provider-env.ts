import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  parseEnvFile,
  loadEnvFile,
  parseProviderEnvFileArgs,
} from '../src/utils/envFile.ts'

const CODEX_LOCAL_ENV_KEYS = new Set([
  'CODEX_AUTH_JSON_PATH',
  'CODEX_HOME',
  'CODEX_API_KEY',
  'CHATGPT_ACCOUNT_ID',
  'CODEX_ACCOUNT_ID',
])

export function loadProviderEnvFiles(
  argv: string[],
): void {
  const providerEnvFiles = parseProviderEnvFileArgs(argv)
  if (providerEnvFiles.error) {
    throw new Error(providerEnvFiles.error)
  }

  for (const filePath of providerEnvFiles.paths) {
    loadEnvFile(filePath)
  }
}

export function loadLocalCodexAuthEnv(options?: {
  cwd?: string
}): void {
  const localEnvPath = join(options?.cwd ?? process.cwd(), '.env')
  if (!existsSync(localEnvPath)) {
    return
  }

  // Only import Codex auth-related keys from a local .env so provider/model
  // settings in the rest of the file do not override launch selection.
  const parsed = parseEnvFile(readFileSync(localEnvPath, 'utf8'))
  for (const [key, value] of Object.entries(parsed)) {
    if (CODEX_LOCAL_ENV_KEYS.has(key) && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}
