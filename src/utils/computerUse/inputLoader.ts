import { runtimeRequire } from '../imports.js'

const COMPUTER_USE_INPUT_PACKAGE = ['@ant', 'computer-use-input'].join('/')


export type ComputerUseInputAPI = {
  moveMouse: (
    x: number,
    y: number,
    animated?: boolean,
  ) => Promise<void>

  mouseLocation: () => Promise<{ x: number; y: number }>

  key: (
    key: string,
    action: 'press' | 'release',
  ) => Promise<void>

  keys: (keys: string[]) => Promise<void>

  typeText: (text: string) => Promise<void>

  mouseButton: (
    button: 'left' | 'right' | 'middle',
    action: 'click' | 'press' | 'release',
    count?: 1 | 2 | 3,
  ) => Promise<void>

  mouseScroll: (
    amount: number,
    axis: 'vertical' | 'horizontal',
  ) => Promise<void>

  getFrontmostAppInfo: () =>
    | {
        bundleId?: string | null
        appName?: string | null
      }
    | null
    | undefined
}

type ComputerUseInput =
  | ({ isSupported: true } & ComputerUseInputAPI)
  | { isSupported: false }

let cached: ComputerUseInputAPI | undefined

/**
 * Package's js/index.js reads COMPUTER_USE_INPUT_NODE_PATH (baked by
 * build-with-plugins.ts on darwin targets, unset otherwise — falls through to
 * the node_modules prebuilds/ path).
 *
 * The package exports a discriminated union on `isSupported` — narrowed here
 * once so callers get the bare `ComputerUseInputAPI` without re-checking.
 *
 * key()/keys() dispatch enigo work onto DispatchQueue.main via
 * dispatch2::run_on_main, then block a tokio worker on a channel. Under
 * Electron (CFRunLoop drains the main queue) this works; under libuv
 * (Node/bun) the main queue never drains and the promise hangs. The executor
 * calls these inside drainRunLoop().
 */
export function requireComputerUseInput(): ComputerUseInputAPI {
  if (cached) return cached
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const input = runtimeRequire<ComputerUseInput>(COMPUTER_USE_INPUT_PACKAGE)
  if (!input.isSupported) {
    throw new Error('@ant/computer-use-input is not supported on this platform')
  }
  return (cached = input)
}

