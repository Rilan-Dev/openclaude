import * as React from 'react'
import { Ansi, Box, Text, useAnimationFrame } from '../../ink.js'
import { isBrowserRuntime } from '../../utils/imports.js'
import { stripVTControlCharacters } from '../../utils/stripVTControlCharacters.js'
import {
  segmentTextByHighlights,
  type TextHighlight,
} from '../../utils/textHighlighting.js'
import type { Theme } from '../../utils/theme.js'
import { ShimmerChar } from '../Spinner/ShimmerChar.js'

type Props = {
  text: string
  highlights: TextHighlight[]
}

type LinePart = {
  text: string
  highlight: TextHighlight | undefined
  start: number
}

function buildLineParts(text: string, highlights: TextHighlight[]): LinePart[][] {
  const segments = segmentTextByHighlights(text, highlights)
  const lines: LinePart[][] = [[]]
  let position = 0

  for (const segment of segments) {
    const parts = segment.text.split('\n')

    for (let index = 0; index < parts.length; index++) {
      if (index > 0) {
        lines.push([])
        position += 1
      }

      const part = parts[index] ?? ''

      if (part.length > 0) {
        lines[lines.length - 1]?.push({
          text: part,
          highlight: segment.highlight,
          start: position,
        })
      }

      position += part.length
    }
  }

  return lines
}

function getShimmerBounds(highlights: TextHighlight[]): {
  cycleLength: number
  sweepStart: number
} {
  let low = Infinity
  let high = -Infinity

  for (const highlight of highlights) {
    if (!highlight.shimmerColor) {
      continue
    }

    low = Math.min(low, highlight.start)
    high = Math.max(high, highlight.end)
  }

  return {
    sweepStart: low - 10,
    cycleLength: high - low + 20,
  }
}

function themeColorToCss(color?: keyof Theme): string | undefined {
  if (!color) {
    return undefined
  }

  const map: Partial<Record<keyof Theme, string>> = {
    text: '#f8fafc',
    subtle: '#94a3b8',
    suggestion: '#60a5fa',
    warning: '#f59e0b',
    success: '#22c55e',
    error: '#ef4444',
    inverseText: '#0f172a',
    promptBorder: '#64748b',
    promptBorderShimmer: '#94a3b8',
    bashBorder: '#f59e0b',
    brand: '#fb923c',
    brandShimmer: '#fdba74',
    claude: '#fb923c',
    claudeShimmer: '#fdba74',
    warningShimmer: '#fbbf24',
    fastMode: '#fb923c',
    fastModeShimmer: '#fdba74',
    rainbow_red: '#ef4444',
    rainbow_orange: '#f97316',
    rainbow_yellow: '#facc15',
    rainbow_green: '#22c55e',
    rainbow_blue: '#3b82f6',
    rainbow_indigo: '#6366f1',
    rainbow_violet: '#a855f7',
    rainbow_red_shimmer: '#f87171',
    rainbow_orange_shimmer: '#fb923c',
    rainbow_yellow_shimmer: '#fde047',
    rainbow_green_shimmer: '#4ade80',
    rainbow_blue_shimmer: '#60a5fa',
    rainbow_indigo_shimmer: '#818cf8',
    rainbow_violet_shimmer: '#c084fc',
  }

  return map[color] ?? `var(--openclaude-${String(color)}, #f8fafc)`
}

function BrowserHighlightedInput({ text, highlights }: Props): React.ReactNode {
  const lines = React.useMemo(() => buildLineParts(text, highlights), [highlights, text])
  const hasShimmer = React.useMemo(
    () => highlights.some(highlight => Boolean(highlight.shimmerColor)),
    [highlights],
  )
  const { cycleLength, sweepStart } = React.useMemo(
    () => (hasShimmer ? getShimmerBounds(highlights) : { cycleLength: 1, sweepStart: 0 }),
    [hasShimmer, highlights],
  )
  const [tick, setTick] = React.useState(0)

  React.useEffect(() => {
    if (!hasShimmer) {
      return
    }

    const timer = window.setInterval(() => {
      setTick(current => current + 1)
    }, 50)

    return () => {
      window.clearInterval(timer)
    }
  }, [hasShimmer])

  const glimmerIndex = hasShimmer
    ? sweepStart + (tick % Math.max(cycleLength, 1))
    : -100

  return (
    <div
      data-openclaude-highlighted-input="web"
      className="repl-highlightedInput"
    >
      {lines.map((lineParts, lineIndex) => (
        <div key={lineIndex} className="repl-highlightedInputLine">
          {lineParts.length === 0 ? (
            <span>&nbsp;</span>
          ) : (
            lineParts.map((part, partIndex) => {
              if (part.highlight?.shimmerColor && part.highlight.color) {
                return (
                  <span key={partIndex} className="repl-highlightedInputSegment">
                    {stripVTControlCharacters(part.text)
                      .split('')
                      .map((char, charIndex) => {
                        const index = part.start + charIndex
                        const isGlint = index === glimmerIndex

                        return (
                          <span
                            key={charIndex}
                            className="repl-highlightedInputChar"
                            style={{
                              color: themeColorToCss(
                                isGlint
                                  ? part.highlight?.shimmerColor
                                  : part.highlight?.color,
                              ),
                              textShadow: isGlint
                                ? '0 0 14px rgba(255, 255, 255, 0.16)'
                                : undefined,
                              transition:
                                'color 120ms ease, text-shadow 120ms ease, opacity 120ms ease',
                            }}
                          >
                            {char}
                          </span>
                        )
                      })}
                  </span>
                )
              }

              return (
                <span
                  key={partIndex}
                  className="repl-highlightedInputSegment"
                  style={{
                    color: themeColorToCss(part.highlight?.color) ?? '#f8fafc',
                    opacity: part.highlight?.dimColor ? 0.65 : 1,
                    background: part.highlight?.inverse ? '#f8fafc' : undefined,
                    borderRadius: part.highlight?.inverse ? 4 : undefined,
                    padding: part.highlight?.inverse ? '0 1px' : undefined,
                  }}
                >
                  {stripVTControlCharacters(part.text)}
                </span>
              )
            })
          )}
        </div>
      ))}
    </div>
  )
}

function TerminalHighlightedInput({ text, highlights }: Props): React.ReactNode {
  const lines = React.useMemo(() => buildLineParts(text, highlights), [highlights, text])
  const hasShimmer = React.useMemo(
    () => highlights.some(highlight => Boolean(highlight.shimmerColor)),
    [highlights],
  )
  const { cycleLength, sweepStart } = React.useMemo(
    () => (hasShimmer ? getShimmerBounds(highlights) : { cycleLength: 1, sweepStart: 0 }),
    [hasShimmer, highlights],
  )
  const [ref, time] = useAnimationFrame(hasShimmer ? 50 : null)
  const glimmerIndex = hasShimmer
    ? sweepStart + (Math.floor(time / 50) % Math.max(cycleLength, 1))
    : -100

  return (
    <Box ref={ref} flexDirection="column">
      {lines.map((lineParts, lineIndex) => (
        <Box key={lineIndex}>
          {lineParts.length === 0 ? (
            <Text> </Text>
          ) : (
            lineParts.map((part, partIndex) => {
              if (part.highlight?.shimmerColor && part.highlight.color) {
                return (
                  <Text key={partIndex}>
                    {part.text.split('').map((char, charIndex) => (
                      <ShimmerChar
                        key={charIndex}
                        char={char}
                        index={part.start + charIndex}
                        glimmerIndex={glimmerIndex}
                        messageColor={part.highlight?.color}
                        shimmerColor={part.highlight?.shimmerColor}
                      />
                    ))}
                  </Text>
                )
              }

              return (
                <Text
                  key={partIndex}
                  color={part.highlight?.color}
                  dimColor={part.highlight?.dimColor}
                  inverse={part.highlight?.inverse}
                >
                  <Ansi>{part.text}</Ansi>
                </Text>
              )
            })
          )}
        </Box>
      ))}
    </Box>
  )
}

export function HighlightedInput(props: Props): React.ReactNode {
  if (isBrowserRuntime()) {
    return <BrowserHighlightedInput {...props} />
  }

  return <TerminalHighlightedInput {...props} />
}
