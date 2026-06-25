import { afterEach, describe, expect, test } from 'bun:test'
import { getRuntimeRenderMode } from './imports.js'

const originalRenderMode = process.env.OPENCLAUDE_RENDER_MODE

afterEach(() => {
  if (originalRenderMode === undefined) {
    delete process.env.OPENCLAUDE_RENDER_MODE
  } else {
    process.env.OPENCLAUDE_RENDER_MODE = originalRenderMode
  }
})

describe('getRuntimeRenderMode', () => {
  test('defaults to terminal mode in node runtime', () => {
    delete process.env.OPENCLAUDE_RENDER_MODE

    expect(getRuntimeRenderMode()).toBe('terminal')
  })

  test('honors explicit web mode', () => {
    process.env.OPENCLAUDE_RENDER_MODE = 'web'

    expect(getRuntimeRenderMode()).toBe('web')
  })

  test('honors explicit terminal mode', () => {
    process.env.OPENCLAUDE_RENDER_MODE = 'terminal'

    expect(getRuntimeRenderMode()).toBe('terminal')
  })
})
