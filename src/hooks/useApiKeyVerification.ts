import { useCallback, useEffect, useState } from 'react'
import { isBrowserRuntime, runtimeImport } from '../utils/imports.js'

export type VerificationStatus =
  | 'loading'
  | 'valid'
  | 'invalid'
  | 'missing'
  | 'error'

export type ApiKeyVerificationResult = {
  status: VerificationStatus
  reverify: () => Promise<void>
  error: Error | null
}

export function useApiKeyVerification(): ApiKeyVerificationResult {
  if (isBrowserRuntime()) {
    return {
      status: 'valid',
      reverify: async () => {},
      error: null,
    }
  }

  const [status, setStatus] = useState<VerificationStatus>(
    () => 'loading',
  )
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let alive = true

    void (async () => {
      try {
        const {
          getAnthropicApiKeyWithSource,
          isAnthropicAuthEnabled,
          isClaudeAISubscriber,
        } = await runtimeImport<typeof import('../utils/auth.js')>(
          '../utils/auth.js',
        )

        const nextStatus =
          isAnthropicAuthEnabled() && !isClaudeAISubscriber()
            ? (() => {
                const { key, source } = getAnthropicApiKeyWithSource({
                  skipRetrievingKeyFromApiKeyHelper: true,
                })
                if (key || source === 'apiKeyHelper') {
                  return 'loading' as VerificationStatus
                }
                return 'missing' as VerificationStatus
              })()
            : ('valid' as VerificationStatus)

        if (!alive) return
        setStatus(nextStatus)
        if (nextStatus !== 'error') {
          setError(null)
        }
      } catch (err) {
        if (!alive) return
        setStatus('error')
        setError(err instanceof Error ? err : new Error(String(err)))
      }
    })()

    return () => {
      alive = false
    }
  }, [])

  const verify = useCallback(async (): Promise<void> => {
    try {
      const {
        getAnthropicApiKeyWithSource,
        getApiKeyFromApiKeyHelper,
        isAnthropicAuthEnabled,
        isClaudeAISubscriber,
      } = await runtimeImport<typeof import('../utils/auth.js')>(
        '../utils/auth.js',
      )

      if (!isAnthropicAuthEnabled() || isClaudeAISubscriber()) {
        setStatus('valid')
        return
      }

      // Warm the apiKeyHelper cache (no-op if not configured), then read from
      // all sources. getAnthropicApiKeyWithSource() reads the now-warm cache.
      const { getIsNonInteractiveSession } = await runtimeImport<
        typeof import('../bootstrap/state.js')
      >('../bootstrap/state.js')
      await getApiKeyFromApiKeyHelper(getIsNonInteractiveSession())
      const { key: apiKey, source } = getAnthropicApiKeyWithSource()
      if (!apiKey) {
        if (source === 'apiKeyHelper') {
          setStatus('error')
          setError(new Error('API key helper did not return a valid key'))
          return
        }
        setStatus('missing')
        return
      }

      const { verifyApiKey } = await runtimeImport<
        typeof import('../services/api/claude.js')
      >('../services/api/claude.js')
      const isValid = await verifyApiKey(apiKey, false)
      setStatus(isValid ? 'valid' : 'invalid')
    } catch (error) {
      // This happens when there an error response from the API but it's not an invalid API key error
      // In this case, we still mark the API key as invalid - but we also log the error so we can
      // display it to the user to be more helpful
      setError(error as Error)
      setStatus('error')
    }
  }, [])

  return {
    status,
    reverify: verify,
    error,
  }
}
