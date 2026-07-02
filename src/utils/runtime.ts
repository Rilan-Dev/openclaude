export function isBrowserRuntime(): boolean {
  return process.env.OPENCLAUDE_RENDER_MODE === 'web'
}
