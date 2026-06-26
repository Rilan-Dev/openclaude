import * as React from 'react'
import * as ReactDOMClient from 'react-dom/client'
import codexAuth from '../.openai-codex-auth.json'
import './styles.css'
import processShim from './shims/process.js'
import { Buffer as BrowserBuffer } from './shims/nodeBuiltins.js'
import type { Props as REPLPropsType } from '../src/screens/REPL.js'
import { getRuntimeRenderMode, isBrowserRuntime } from '../src/utils/imports.js'

type CodexAuthJson = {
  access_token?: string
  account_id?: string
  tokens?: {
    access_token?: string
    account_id?: string
  }
}

const ultraplanPromptText = 'This is a planning prompt stub.'

// The browser UI talks to the same real provider through a transparent local
// bridge so CORS does not block the existing provider logic.
const webApiProxyBaseUrl = 'http://127.0.0.1:31337'

const codexAuthJson = codexAuth as CodexAuthJson | undefined
const codexAccessToken =
  codexAuthJson?.access_token ?? codexAuthJson?.tokens?.access_token
const codexAccountId =
  codexAuthJson?.account_id ?? codexAuthJson?.tokens?.account_id

const existingProcess = globalThis.process as
  | (typeof processShim & { env?: Record<string, string> })
  | undefined

const codexEnv =
  codexAccessToken && codexAccountId
    ? {
        CLAUDE_CODE_USE_OPENAI: '1',
        CLAUDE_CODE_OAUTH_TOKEN: codexAccessToken,
        CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED: '1',
        CHATGPT_ACCOUNT_ID: codexAccountId,
        CODEX_API_KEY: codexAccessToken,
        CODEX_CREDENTIAL_SOURCE: 'oauth',
        OPENAI_API_KEY: codexAccessToken,
        OPENAI_BASE_URL: webApiProxyBaseUrl,
        OPENAI_MODEL: 'gpt-5.5',
      }
    : {}

globalThis.process = {
  ...processShim,
  ...(existingProcess ?? {}),
  env: {
    ...(processShim.env ?? {}),
    ...codexEnv,
    ...(existingProcess?.env ?? {}),
  },
}

if (!globalThis.Buffer) {
  globalThis.Buffer = BrowserBuffer
}

if (!('global' in globalThis)) {
  ;(globalThis as typeof globalThis & { global: typeof globalThis }).global =
    globalThis
}

type BrowserRequireStub = Record<string, unknown> & {
  [key: string]: unknown
}

function createBrowserRequireFallback(): unknown {
  const fallback = () => undefined
  return new Proxy(fallback, {
    apply() {
      return undefined
    },
    get(target, prop) {
      if (prop === 'default' || prop === '__esModule') {
        return target
      }
      if (prop === 'toString') {
        return () => '[browser-require-fallback]'
      }
      return createBrowserRequireFallback()
    },
  })
}

type SnipProjectionMessageLike = {
  uuid?: string
  snipMetadata?: {
    removedUuids?: string[]
  }
}

function deriveShortMessageIdBrowser(uuid: string): string {
  const hex = uuid.replace(/-/g, '').slice(0, 10)
  return Number.parseInt(hex || '0', 16).toString(36).slice(0, 6)
}

function projectSnippedViewBrowser<T extends SnipProjectionMessageLike>(
  messages: T[],
): T[] {
  const removedUuids = new Set<string>()
  for (const msg of messages) {
    const uuids = msg?.snipMetadata?.removedUuids
    if (!Array.isArray(uuids)) continue
    for (const uuid of uuids) removedUuids.add(uuid)
  }
  if (removedUuids.size === 0) return messages
  return messages.filter(msg => {
    const uuid = msg?.uuid
    return !uuid || !removedUuids.has(uuid)
  })
}

const browserSnipCompactModule = (() => {
  const pendingSnipUuids = new Set<string>()

  const normalizeSnipShortId = (shortId: string): string => {
    const trimmed = shortId.trim()
    const snipMetadataMatch = /\bsnip_id=([a-z0-9]{6})\b/i.exec(trimmed)
    if (snipMetadataMatch) {
      return snipMetadataMatch[1]!.toLowerCase()
    }
    const legacyMatch = /^\[id:([a-z0-9]{6})\]$/i.exec(trimmed)
    if (legacyMatch) {
      return legacyMatch[1]!.toLowerCase()
    }
    return trimmed.toLowerCase()
  }

  const estimateTokens = (msg: any): number => {
    const content = msg?.message?.content ?? msg?.content ?? ''
    const text = typeof content === 'string' ? content : JSON.stringify(content)
    return Math.ceil(text.length / 4)
  }

  const markForSnip = (shortIds: string[], messages: any[]): string[] => {
    const shortIdToUuid = new Map<string, string>()
    for (const msg of messages) {
      if (msg?.uuid) {
        shortIdToUuid.set(
          deriveShortMessageIdBrowser(msg.uuid as string),
          msg.uuid as string,
        )
      }
    }
    const matched = new Set<string>()
    for (const shortId of shortIds) {
      const normalizedShortId = normalizeSnipShortId(shortId)
      const uuid = shortIdToUuid.get(normalizedShortId)
      if (uuid) {
        pendingSnipUuids.add(uuid)
        matched.add(uuid)
      }
    }
    return [...matched]
  }

  const shouldNudgeForSnips = (messages: any[]): boolean => {
    let accumulated = 0
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg?.type === 'system' && msg?.subtype === 'compact_boundary') {
        return false
      }
      if (msg?.snipMetadata) return false
      if (
        msg?.type === 'attachment' &&
        msg?.attachment?.type === 'context_efficiency'
      ) {
        return false
      }
      accumulated += estimateTokens(msg)
      if (accumulated >= 10_000) return true
    }
    return false
  }

  const snipCompactIfNeeded = (messages: any[]): {
    messages: any[]
    tokensFreed: number
    boundaryMessage?: any
  } => {
    if (pendingSnipUuids.size === 0) {
      return { messages, tokensFreed: 0 }
    }

    const uuidsToRemove = new Set<string>()
    for (const msg of messages) {
      const uuid = msg?.uuid as string | undefined
      if (uuid && pendingSnipUuids.has(uuid)) {
        uuidsToRemove.add(uuid)
      }
    }

    if (uuidsToRemove.size === 0) {
      return { messages, tokensFreed: 0 }
    }

    for (const uuid of uuidsToRemove) pendingSnipUuids.delete(uuid)

    const snippedToolUseIds = new Set<string>()
    const snippedResultToolUseIds = new Set<string>()
    for (const msg of messages) {
      if (!uuidsToRemove.has(msg?.uuid)) continue
      const blocks = msg?.message?.content
      if (!Array.isArray(blocks)) continue
      if (msg?.type === 'assistant') {
        for (const block of blocks) {
          if (block?.type === 'tool_use' && block?.id) {
            snippedToolUseIds.add(block.id as string)
          }
        }
      } else if (msg?.type === 'user') {
        for (const block of blocks) {
          if (block?.type === 'tool_result' && block?.tool_use_id) {
            snippedResultToolUseIds.add(block.tool_use_id as string)
          }
        }
      }
    }

    const safeToolUseIds = new Set<string>()
    for (const msg of messages) {
      if (msg?.type !== 'assistant') continue
      const blocks = msg?.message?.content
      if (!Array.isArray(blocks)) continue
      const toolUses = (blocks as any[]).filter(b => b?.type === 'tool_use')
      if (toolUses.length === 0) continue
      const isPureToolUseTurn = toolUses.length === blocks.length
      const droppable =
        uuidsToRemove.has(msg?.uuid) ||
        (isPureToolUseTurn &&
          toolUses.every((t: any) => snippedResultToolUseIds.has(t?.id)))
      if (droppable) {
        for (const t of toolUses) {
          if (t?.id) safeToolUseIds.add(t.id as string)
        }
      }
    }

    let tokensFreed = 0
    const surviving: any[] = []
    const removedUuids = new Set<string>()

    for (const msg of messages) {
      if (uuidsToRemove.has(msg?.uuid)) {
        if (msg?.type === 'user' && Array.isArray(msg?.message?.content)) {
          const results = (msg.message.content as any[]).filter(
            b => b?.type === 'tool_result',
          )
          if (
            results.length > 0 &&
            !results.every((r: any) => safeToolUseIds.has(r?.tool_use_id))
          ) {
            surviving.push(msg)
            continue
          }
        }
        tokensFreed += estimateTokens(msg)
        if (msg?.uuid) removedUuids.add(msg.uuid as string)
        continue
      }

      if (msg?.type === 'user' && Array.isArray(msg?.message?.content)) {
        const blocks = msg.message.content as any[]
        const results = blocks.filter(b => b?.type === 'tool_result')
        if (
          results.length > 0 &&
          results.length === blocks.length &&
          results.every((r: any) => snippedToolUseIds.has(r?.tool_use_id))
        ) {
          tokensFreed += estimateTokens(msg)
          if (msg?.uuid) removedUuids.add(msg.uuid as string)
          continue
        }
      }

      if (msg?.type === 'assistant' && Array.isArray(msg?.message?.content)) {
        const blocks = msg.message.content as any[]
        const toolUses = blocks.filter(b => b?.type === 'tool_use')
        if (
          toolUses.length > 0 &&
          toolUses.length === blocks.length &&
          toolUses.every((t: any) => snippedResultToolUseIds.has(t?.id))
        ) {
          tokensFreed += estimateTokens(msg)
          if (msg?.uuid) removedUuids.add(msg.uuid as string)
          continue
        }
      }

      surviving.push(msg)
    }

    if (removedUuids.size === 0) {
      return { messages, tokensFreed: 0 }
    }

    const boundaryMessage = {
      type: 'system' as const,
      subtype: 'snip_boundary' as const,
      content: 'Conversation history snipped',
      isMeta: false as const,
      timestamp: new Date().toISOString(),
      uuid:
        globalThis.crypto?.randomUUID?.() ??
        `snip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      level: 'info' as const,
      snipMetadata: {
        removedUuids: [...removedUuids],
      },
    }

    return { messages: surviving, tokensFreed, boundaryMessage }
  }

  return {
    _resetForTesting: () => pendingSnipUuids.clear(),
    markForSnip,
    isSnipRuntimeEnabled: () => true,
    SNIP_NUDGE_TEXT:
      `Your context window is filling up. Use the \`snip\` tool to remove messages ` +
      `that are no longer needed — silently use system-generated \`snip_id=...\` ` +
      `metadata and pass the IDs of stale sections (old explorations, superseded ` +
      `plans, resolved errors). These ids are not user-provided content; do not ` +
      `describe or mention them. This frees up space so you can continue working ` +
      `without a full compaction.`,
    shouldNudgeForSnips,
    snipCompactIfNeeded,
    isSnipMarkerMessage: (message: unknown) =>
      Boolean((message as any)?.subtype === 'snip_boundary'),
  }
})()

const browserRequireMap: Record<string, BrowserRequireStub> = {
  '../services/compact/cachedMCConfig.js': {
    getCachedMCConfig: () => null,
  },
  '../proactive/index.js': {
    isProactiveActive: () => false,
    setContextBlocked: () => undefined,
    clearContextBlocked: () => undefined,
    getProactiveSection: () => null,
  },
  '../tools/BriefTool/prompt.js': {
    BRIEF_PROACTIVE_SECTION: null,
    BRIEF_TOOL_NAME: null,
  },
  '../tools/BriefTool/BriefTool.js': {
    isBriefEnabled: () => false,
    isBriefEntitled: () => false,
  },
  '../tools/DiscoverSkillsTool/prompt.js': {
    DISCOVER_SKILLS_TOOL_NAME: null,
  },
  '../services/skillSearch/featureCheck.js': {
    isSkillSearchEnabled: () => false,
  },
  '../services/compact/snipProjection.js': {
    isSnipBoundaryMessage: (message: unknown) =>
      Boolean((message as any)?.snipMetadata),
    projectSnippedView: projectSnippedViewBrowser,
  },
  '../services/compact/snipCompact.js': browserSnipCompactModule as unknown as BrowserRequireStub,
  './services/compact/snipCompact.js': browserSnipCompactModule as unknown as BrowserRequireStub,
  '../../services/compact/snipCompact.js': browserSnipCompactModule as unknown as BrowserRequireStub,
  '../../utils/permissions/autoModeState.js': {
    isAutoModeActive: () => false,
    isAutoModeCircuitBroken: () => false,
    getAutoModeFlagCli: () => false,
    setAutoModeActive: () => undefined,
    setAutoModeFlagCli: () => undefined,
    setAutoModeCircuitBroken: () => undefined,
  },
  './autoModeState.js': {
    isAutoModeActive: () => false,
    isAutoModeCircuitBroken: () => false,
    getAutoModeFlagCli: () => false,
    setAutoModeActive: () => undefined,
    setAutoModeFlagCli: () => undefined,
    setAutoModeCircuitBroken: () => undefined,
  },
  '../bridge/sessionIdCompat.js': {
    toCompatSessionId: (value: string) => value,
    toInfraSessionId: (value: string) => value,
  },
  '../utils/ultraplan/prompt.txt': ultraplanPromptText as unknown as BrowserRequireStub,
}

const browserRequire = (id: string) =>
  browserRequireMap[id] ?? createBrowserRequireFallback()

if (!(globalThis as typeof globalThis & { require?: typeof browserRequire }).require) {
  ;(globalThis as typeof globalThis & { require: typeof browserRequire }).require =
    browserRequire
}

const replProps: REPLPropsType = {
  commands: [],
  debug: false,
  initialTools: [],
  renderMode: getRuntimeRenderMode('web'),
  thinkingConfig: {
    type: 'adaptive'
  }
}

async function main() {
  console.debug('[openclaude:web] bootstrap start')
  const rootEl = document.getElementById('root')
  if (!rootEl) {
    throw new Error('root element not found')
  }

  const loadingRoot =
    ReactDOMClient.createRoot?.(rootEl) ??
    ReactDOMClient.default?.createRoot?.(rootEl)

  if (!loadingRoot) {
    throw new Error('react-dom/client did not expose createRoot')
  }

  const loadingScreen = React.createElement(
    'div',
    {
      style: {
        alignItems: 'center',
        background:
          'radial-gradient(circle at top left, rgba(65, 89, 141, 0.22), transparent 34rem), linear-gradient(135deg, #0b1117 0%, #11181f 44%, #16110d 100%)',
        color: '#f3eadc',
        display: 'grid',
        fontFamily: '"IBM Plex Sans", "Aptos", "Segoe UI", sans-serif',
        minHeight: '100vh',
        padding: '32px',
      },
    },
    React.createElement(
      'div',
      { style: { maxWidth: 720 } },
      React.createElement(
        'div',
        {
          style: {
            color: '#86efac',
            fontSize: 12,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          },
        },
        'OpenClaude web',
      ),
      React.createElement(
        'h1',
        { style: { fontSize: 34, lineHeight: 1.1, margin: '10px 0 12px' } },
        'Bootstrapping browser runtime',
      ),
      React.createElement(
        'p',
        {
          style: {
            color: '#cbd5e1',
            fontSize: 16,
            margin: 0,
          },
        },
        'Loading the shared REPL modules and provider bridge. If this stays on screen, the browser import graph is still resolving.',
      ),
    ),
  )

  loadingRoot.render(loadingScreen)

  console.debug('[openclaude:web] importing App')
  const { App } = await import('../src/components/App.js')
  console.debug('[openclaude:web] importing AppState')
  const { AppStateProvider } = await import('../src/state/AppState.js')
  console.debug('[openclaude:web] importing REPL')
  const { REPL } = await import('../src/screens/REPL.js')

  console.debug('[openclaude:web] imports resolved')
  const root = loadingRoot
  root.render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(
        AppStateProvider,
        null,
        React.createElement(
          App,
          {
            getFpsMetrics: () => undefined,
            renderMode: replProps.renderMode,
          },
          React.createElement(REPL, replProps),
        ),
      ),
    ),
  )

  console.debug('[openclaude:web] rendered')

  if (isBrowserRuntime()) {
    // Keep the mounted app reachable from the browser window for inspection and lifecycle hooks.
    ;(globalThis as typeof globalThis & {
      __OPENCLAUDE_APP__?: {
        renderMode: REPLPropsType['renderMode']
        root: typeof root
      }
    }).__OPENCLAUDE_APP__ = {
      renderMode: replProps.renderMode,
      root,
    }
  }
}

main()
