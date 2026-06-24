import { useContext, useEffect, useState } from 'react'
import { TerminalSizeContext } from 'src/ink/components/TerminalSizeContext.js'
import { isBrowserRuntime } from 'src/utils/imports.js'

export function useTerminalSize(): { columns: number; rows: number } {
  const inkSize = useContext(TerminalSizeContext)

  const getBrowserSize = () => {
    if (!isBrowserRuntime()) {
      return { columns: 80, rows: 24 }
    }

    return {
      columns: Math.max(80, Math.floor(window.innerWidth / 8)),
      rows: Math.max(24, Math.floor(window.innerHeight / 18)),
    }
  }

  const [browserSize, setBrowserSize] = useState(getBrowserSize)

  useEffect(() => {
    if (!isBrowserRuntime()) return

    const onResize = () => setBrowserSize(getBrowserSize())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (isBrowserRuntime()) {
    return browserSize
  }

  if (!inkSize) {
    throw new Error('useTerminalSize must be used within an Ink App component')
  }

  return inkSize
}