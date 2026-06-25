import {
  attachCache,
  browserAsyncNoop,
  browserNoop,
  getBrowserEnvFlag,
  getBrowserEnvValue,
} from './browserRuntime.js'

const browserAuthToken = () => ({
  hasToken: false,
  source: 'none',
})

function makeCacheable(fn) {
  return attachCache(fn)
}

export function isAnthropicAuthEnabled() {
  return (
    getBrowserEnvFlag('ANTHROPIC_API_KEY') ||
    getBrowserEnvFlag('CLAUDE_CODE_OAUTH_TOKEN') ||
    getBrowserEnvFlag('CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR')
  )
}

export function getAuthTokenSource() {
  if (getBrowserEnvFlag('CLAUDE_CODE_OAUTH_TOKEN')) {
    return { source: 'CLAUDE_CODE_OAUTH_TOKEN', hasToken: true }
  }
  if (getBrowserEnvFlag('CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR')) {
    return {
      source: 'CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR',
      hasToken: true,
    }
  }
  if (getBrowserEnvValue('ANTHROPIC_API_KEY')) {
    return { source: 'ANTHROPIC_API_KEY', hasToken: true }
  }
  return browserAuthToken()
}

export function getAnthropicApiKey() {
  return getAnthropicApiKeyWithSource().key
}

export function hasAnthropicApiKeyAuth() {
  return Boolean(getAnthropicApiKey())
}

export function getAnthropicApiKeyWithSource() {
  const apiKey = getBrowserEnvValue('ANTHROPIC_API_KEY')
  if (apiKey) {
    return { key: apiKey, source: 'ANTHROPIC_API_KEY' }
  }
  return { key: null, source: 'none' }
}

export function getConfiguredApiKeyHelper() {
  return undefined
}

export function isAwsAuthRefreshFromProjectSettings() {
  return false
}

export function isAwsCredentialExportFromProjectSettings() {
  return false
}

export function calculateApiKeyHelperTTL() {
  return 0
}

export function getApiKeyHelperElapsedMs() {
  return 0
}

export async function getApiKeyFromApiKeyHelper() {
  return null
}

export function getApiKeyFromApiKeyHelperCached() {
  return null
}

export function clearApiKeyHelperCache() {}

export function prefetchApiKeyFromApiKeyHelperIfSafe() {}

export async function refreshAwsAuth() {
  return false
}

export const refreshAndGetAwsCredentials = makeCacheable(async () => null)

export function clearAwsCredentialsCache() {
  refreshAndGetAwsCredentials.cache.clear()
}

export function isGcpAuthRefreshFromProjectSettings() {
  return false
}

export async function checkGcpCredentialsValid() {
  return false
}

export async function refreshGcpAuth() {
  return false
}

export const refreshGcpCredentialsIfNeeded = makeCacheable(async () => false)

export function clearGcpCredentialsCache() {
  refreshGcpCredentialsIfNeeded.cache.clear()
}

export function prefetchGcpCredentialsIfSafe() {}

export function prefetchAwsCredentialsAndBedRockInfoIfSafe() {}

export const getApiKeyFromConfigOrMacOSKeychain = makeCacheable(() => null)

export async function saveApiKey() {}

export function isCustomApiKeyApproved() {
  return false
}

export async function removeApiKey() {}

export function saveOAuthTokensIfNeeded() {
  return { success: true }
}

export const getClaudeAIOAuthTokens = makeCacheable(() => null)

export function clearOAuthTokenCache() {
  getClaudeAIOAuthTokens.cache.clear()
}

export async function handleOAuth401Error() {
  return false
}

export async function getClaudeAIOAuthTokensAsync() {
  return null
}

export async function checkAndRefreshOAuthTokenIfNeeded() {
  return false
}

export function isClaudeAISubscriber() {
  return false
}

export function hasProfileScope() {
  return false
}

export function is1PApiCustomer() {
  return false
}

export function getOauthAccountInfo() {
  return undefined
}

export function isOverageProvisioningAllowed() {
  return false
}

export function hasOpusAccess() {
  return false
}

export function getSubscriptionType() {
  return null
}

export function isMaxSubscriber() {
  return false
}

export function isTeamSubscriber() {
  return false
}

export function isTeamPremiumSubscriber() {
  return false
}

export function isEnterpriseSubscriber() {
  return false
}

export function isProSubscriber() {
  return false
}

export function getRateLimitTier() {
  return null
}

export function getSubscriptionName() {
  return 'browser'
}

export function isUsing3PServices() {
  return (
    getBrowserEnvFlag('CLAUDE_CODE_USE_OPENAI') ||
    getBrowserEnvFlag('CLAUDE_CODE_USE_GEMINI') ||
    getBrowserEnvFlag('CLAUDE_CODE_USE_MISTRAL') ||
    getBrowserEnvFlag('CLAUDE_CODE_USE_GITHUB') ||
    getBrowserEnvFlag('CLAUDE_CODE_USE_BEDROCK') ||
    getBrowserEnvFlag('CLAUDE_CODE_USE_VERTEX') ||
    getBrowserEnvFlag('CLAUDE_CODE_USE_FOUNDRY')
  )
}

export function isOtelHeadersHelperFromProjectOrLocalSettings() {
  return false
}

export function getOtelHeadersFromHelper() {
  return {}
}

export function isConsumerSubscriber() {
  return false
}

export function getAccountInformation() {
  return undefined
}

export async function validateForceLoginOrg() {
  return { valid: true }
}

export const browserAuthExports = {
  calculateApiKeyHelperTTL,
  checkAndRefreshOAuthTokenIfNeeded,
  checkGcpCredentialsValid,
  clearApiKeyHelperCache,
  clearAwsCredentialsCache,
  clearGcpCredentialsCache,
  clearOAuthTokenCache,
  getAccountInformation,
  getApiKeyFromApiKeyHelper,
  getApiKeyFromApiKeyHelperCached,
  getApiKeyFromConfigOrMacOSKeychain,
  getApiKeyHelperElapsedMs,
  getAnthropicApiKey,
  getAnthropicApiKeyWithSource,
  getAuthTokenSource,
  getClaudeAIOAuthTokens,
  getClaudeAIOAuthTokensAsync,
  getConfiguredApiKeyHelper,
  getOauthAccountInfo,
  getOtelHeadersFromHelper,
  getRateLimitTier,
  getSubscriptionName,
  getSubscriptionType,
  handleOAuth401Error,
  hasAnthropicApiKeyAuth,
  hasOpusAccess,
  hasProfileScope,
  is1PApiCustomer,
  isAnthropicAuthEnabled,
  isAwsAuthRefreshFromProjectSettings,
  isAwsCredentialExportFromProjectSettings,
  isClaudeAISubscriber,
  isConsumerSubscriber,
  isCustomApiKeyApproved,
  isEnterpriseSubscriber,
  isGcpAuthRefreshFromProjectSettings,
  isMaxSubscriber,
  isOtelHeadersHelperFromProjectOrLocalSettings,
  isOverageProvisioningAllowed,
  isProSubscriber,
  isTeamPremiumSubscriber,
  isTeamSubscriber,
  isUsing3PServices,
  prefetchApiKeyFromApiKeyHelperIfSafe,
  prefetchAwsCredentialsAndBedRockInfoIfSafe,
  prefetchGcpCredentialsIfSafe,
  refreshAndGetAwsCredentials,
  refreshAwsAuth,
  refreshGcpAuth,
  refreshGcpCredentialsIfNeeded,
  removeApiKey,
  saveApiKey,
  saveOAuthTokensIfNeeded,
  validateForceLoginOrg,
}

