import { useContext } from 'react'
import { isBrowserRuntime } from '../../utils/imports.js'
import TerminalFocusContext from '../components/TerminalFocusContext.js'

/**
 * Hook to check if the terminal has focus.
 *
 * Uses DECSET 1004 focus reporting - the terminal sends escape sequences
 * when it gains or loses focus. These are handled automatically
 * by Ink and filtered from useInput.
 *
 * @returns true if the terminal is focused (or focus state is unknown)
 */
export function useTerminalFocus(): boolean {
  if (isBrowserRuntime()) {
    return true
  }

  const { isTerminalFocused } = useContext(TerminalFocusContext)
  return isTerminalFocused
}
