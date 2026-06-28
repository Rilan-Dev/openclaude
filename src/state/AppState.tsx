import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { feature } from 'bun:bundle'
import { MailboxProvider } from '../context/mailbox.js'
import { useEffectEventCompat } from '../hooks/useEffectEventCompat.js'
import { useSettingsChange } from '../hooks/useSettingsChange.js'
import { logForDebugging } from '../utils/debug.js'
import { isBrowserRuntime } from '../utils/imports.js'
import {
  createDisabledBypassPermissionsContext,
  isBypassPermissionsModeDisabled,
} from '../utils/permissions/permissionSetup.js'
import { applySettingsChange } from '../utils/settings/applySettingsChange.js'
import type { SettingSource } from '../utils/settings/constants.js'
import { createStore } from './store.js'
import type { AppState, AppStateStore } from './AppStateStore.js'
import { getDefaultAppState } from './AppStateStore.js'

// DCE: voice context is internal-only. External builds get a passthrough.
/* eslint-disable @typescript-eslint/no-require-imports */
const VoiceProvider: React.ComponentType<{
  children: React.ReactNode
}> = !isBrowserRuntime() && feature('VOICE_MODE')
  ? require('../context/voice.js').VoiceProvider
  : ({ children }) => children
/* eslint-enable @typescript-eslint/no-require-imports */

// TODO: Remove these re-exports once all callers import directly from
// ./AppStateStore.js. Kept for back-compat during migration so .ts callers
// can incrementally move off the .tsx import and stop pulling React.
export {
  type AppState,
  type AppStateStore,
  type CompletionBoundary,
  getDefaultAppState,
  IDLE_SPECULATION_STATE,
  type SpeculationResult,
  type SpeculationState,
} from './AppStateStore.js'

export const AppStoreContext = React.createContext<AppStateStore | null>(null)

type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N

type Props = {
  children: React.ReactNode
  initialState?: AppState
  onChangeAppState?: (args: {
    newState: AppState
    oldState: AppState
  }) => void
}

const HasAppStateContext = React.createContext<boolean>(false)

let browserAppStore: AppStateStore | undefined

function BrowserAppStateProvider({
  children,
  initialState,
  onChangeAppState,
}: Props): React.ReactNode {
  if (!browserAppStore) {
    browserAppStore = createStore(
      initialState ?? getDefaultAppState(),
      onChangeAppState,
    )
  }

  return (
    <HasAppStateContext.Provider value={true}>
      <AppStoreContext.Provider value={browserAppStore}>
        <MailboxProvider>{children}</MailboxProvider>
      </AppStoreContext.Provider>
    </HasAppStateContext.Provider>
  )
}

export function AppStateProvider(t0: Props): React.ReactNode {
  if (isBrowserRuntime()) {
    return <BrowserAppStateProvider {...t0} />
  }

  const { children, initialState, onChangeAppState } = t0

  const hasAppStateContext = useContext(HasAppStateContext)
  if (hasAppStateContext) {
    throw new Error(
      'AppStateProvider can not be nested within another AppStateProvider',
    )
  }

  const [store] = useState<AppStateStore>(() =>
    createStore(initialState ?? getDefaultAppState(), onChangeAppState),
  )

  useEffect(() => {
    const { toolPermissionContext } = store.getState()
    if (
      toolPermissionContext.isBypassPermissionsModeAvailable &&
      isBypassPermissionsModeDisabled()
    ) {
      logForDebugging(
        'Disabling bypass permissions mode on mount (remote settings loaded before mount)',
      )
      store.setState(prev => ({
        ...prev,
        toolPermissionContext: createDisabledBypassPermissionsContext(
          prev.toolPermissionContext,
        ),
      }))
    }
  }, [store])

  const onSettingsChange = useEffectEventCompat((source: SettingSource) =>
    applySettingsChange(source, store.setState),
  )
  useSettingsChange(onSettingsChange)

  const childrenTree = isBrowserRuntime() ? (
    children
  ) : (
    <MailboxProvider>
      <VoiceProvider>{children}</VoiceProvider>
    </MailboxProvider>
  )

  return (
    <HasAppStateContext.Provider value={true}>
      <AppStoreContext.Provider value={store}>
        {childrenTree}
      </AppStoreContext.Provider>
    </HasAppStateContext.Provider>
  )
}

function useAppStore(): AppStateStore {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const store = useContext(AppStoreContext)
  if (!store) {
    throw new ReferenceError(
      'useAppState/useSetAppState cannot be called outside of an <AppStateProvider />',
    )
  }
  return store
}

/**
 * Subscribe to a slice of AppState. Only re-renders when the selected value
 * changes (compared via Object.is).
 *
 * For multiple independent fields, call the hook multiple times:
 * ```
 * const verbose = useAppState(s => s.verbose)
 * const model = useAppState(s => s.mainLoopModel)
 * ```
 *
 * Do NOT return new objects from the selector -- Object.is will always see
 * them as changed. Instead, select an existing sub-object reference:
 * ```
 * const { text, promptId } = useAppState(s => s.promptSuggestion) // good
 * ```
 */
export function useAppState<T>(selector: (state: AppState) => T): T
export function useAppState<T>(selector: IfAny<T, T, never>): any
export function useAppState<T>(selector: (state: AppState) => T): T {
  const store = useAppStore()
  const selectorRef = useRef<(state: AppState) => T>(selector)
  const storeRef = useRef<AppStateStore>(store)

  // Update refs during render so get() always calls the latest selector/store
  // without creating a new function identity that would trigger useSyncExternalStore
  // to re-sync and cause re-render loops.
  selectorRef.current = selector
  storeRef.current = store

  const get = useCallback((): T => {
    return selectorRef.current(storeRef.current.getState())
  }, [])

  return useSyncExternalStore(store.subscribe, get, get)
}

/**
 * Get the setAppState updater without subscribing to any state.
 * Returns a stable reference that never changes -- components using only
 * this hook will never re-render from state changes.
 */
export function useSetAppState(): AppStateStore['setState'] {
  return useAppStore().setState
}

/**
 * Get the store directly (for passing getState/setState to non-React code).
 */
export function useAppStateStore(): AppStateStore {
  return useAppStore()
}

const NOOP_SUBSCRIBE: AppStateStore['subscribe'] = () => () => {}

/**
 * Safe version of useAppState that returns undefined if called outside of AppStateProvider.
 * Useful for components that may be rendered in contexts where AppStateProvider isn't available.
 */
export function useAppStateMaybeOutsideOfProvider<T>(
  selector: (state: AppState) => T,
): T | undefined
export function useAppStateMaybeOutsideOfProvider<T>(
  selector: IfAny<T, T, never>,
): any
export function useAppStateMaybeOutsideOfProvider<T>(
  selector: (state: AppState) => T,
): T | undefined {
  const store = useContext(AppStoreContext)
  const selectorRef = useRef<(state: AppState) => T>(selector)
  const storeRef = useRef<AppStateStore | null>(store)

  // Update refs during render so get() always calls the latest selector/store
  // without creating a new function identity.
  selectorRef.current = selector
  storeRef.current = store

  const get = useCallback((): T | undefined => {
    return storeRef.current
      ? selectorRef.current(storeRef.current.getState())
      : undefined
  }, [])

  return useSyncExternalStore(store ? store.subscribe : NOOP_SUBSCRIBE, get)
}
