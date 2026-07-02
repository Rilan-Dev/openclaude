import React, { useEffect, useState } from 'react'

type CapturedWrite = {
  stream: string
  text: string
  timestamp: number
  terminalFrame?: string
}

type BrowserGlobals = typeof globalThis & {
  __openclaudeProcessWrites?: CapturedWrite[]
  __openclaudeTerminalFrame?: string
}

function stripAnsiControl(text: string): string {
  return text
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
}

function ansiToSpans(text: string): React.ReactNode[] {
  const spans: React.ReactNode[] = []
  const ansiRe = /\x1b\[([0-9;]*)m/g
  let lastIndex = 0
  let color: string | undefined
  let key = 0

  for (const match of text.matchAll(ansiRe)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      spans.push(
        <span key={key++} style={color ? { color } : undefined}>
          {text.slice(lastIndex, index)}
        </span>,
      )
    }

    const parts = (match[1] || '').split(';').map(Number)
    if (parts.includes(0)) color = undefined

    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 38 && parts[i + 1] === 2) {
        const [r, g, b] = parts.slice(i + 2, i + 5)
        if (
          Number.isFinite(r) &&
          Number.isFinite(g) &&
          Number.isFinite(b)
        ) {
          color = `rgb(${r}, ${g}, ${b})`
        }
        i += 4
      }
    }

    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) {
    spans.push(
      <span key={key++} style={color ? { color } : undefined}>
        {text.slice(lastIndex)}
      </span>,
    )
  }

  return spans
}

function getLatestInkTerminalOutput(): string {
  const globals = globalThis as BrowserGlobals
  if (globals.__openclaudeTerminalFrame?.trim()) {
    return globals.__openclaudeTerminalFrame
  }

  const writes = (globals.__openclaudeProcessWrites ?? []) as CapturedWrite[]
  const frames = writes.filter(
    write =>
      write.stream === 'stdout' &&
      stripAnsiControl(write.text).trim().length > 0,
  )
  return frames.at(-1)?.text ?? ''
}

export function LiveInkTerminalOutput() {
  const [terminalOutput, setTerminalOutput] = useState(getLatestInkTerminalOutput)

  useEffect(() => {
    const update = () => setTerminalOutput(getLatestInkTerminalOutput())
    globalThis.addEventListener('openclaude:process-write', update)
    update()
    return () => globalThis.removeEventListener('openclaude:process-write', update)
  }, [])

  if (!terminalOutput) {
    return null
  }

  return (
    <pre className="openclaude-web-inkTerminal" aria-live="polite">
      {ansiToSpans(terminalOutput)}
    </pre>
  )
}

export const CapturedStartupTerminal = LiveInkTerminalOutput
