type SnipCompactModule = typeof import('./snipCompact.js')

const isBrowserLikeRuntime =
  typeof window !== 'undefined' && typeof document !== 'undefined'

function getBrowserSnipCompactModule(): SnipCompactModule {
  const browserRequire = (
    globalThis as typeof globalThis & {
      require?: (id: string) => SnipCompactModule
    }
  ).require
  const browserModule =
    browserRequire?.('../services/compact/snipCompact.js') ??
    browserRequire?.('./services/compact/snipCompact.js') ??
    browserRequire?.('../../services/compact/snipCompact.js')

  if (browserModule) {
    return browserModule
  }

  return {
    markForSnip: () => [],
    isSnipRuntimeEnabled: () => true,
    SNIP_NUDGE_TEXT: '',
    shouldNudgeForSnips: () => false,
    snipCompactIfNeeded: (messages: any[]) => ({
      messages,
      tokensFreed: 0,
    }),
  } as unknown as SnipCompactModule
}

export function getSnipCompactRuntimeModule(): SnipCompactModule {
  if (isBrowserLikeRuntime) {
    return getBrowserSnipCompactModule()
  }

  return require('./snipCompact.js') as SnipCompactModule
}
