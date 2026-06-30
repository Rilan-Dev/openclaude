import figures from 'figures'
import * as React from 'react'
import { Box, Text } from 'src/ink.js'
import {
  AGENT_COLOR_TO_THEME_COLOR,
  AGENT_COLORS,
  type AgentColorName,
} from 'src/tools/AgentTool/agentColorManager.js'
import type { PromptInputMode } from 'src/types/textInputTypes.js'
import { getTeammateColor } from 'src/utils/teammate.js'
import type { Theme } from 'src/utils/theme.js'
import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js'
import { isBrowserRuntime } from '../../utils/imports.js'

type Props = {
  mode: PromptInputMode
  isLoading: boolean
  viewingAgentName?: string
  viewingAgentColor?: AgentColorName
}

type PromptCharProps = {
  isLoading: boolean
  themeColor?: keyof Theme
}

function getTeammateThemeColor(): keyof Theme | undefined {
  if (!isAgentSwarmsEnabled()) {
    return undefined
  }

  const colorName = getTeammateColor()

  if (!colorName) {
    return undefined
  }

  if (AGENT_COLORS.includes(colorName as AgentColorName)) {
    return AGENT_COLOR_TO_THEME_COLOR[colorName as AgentColorName]
  }

  return undefined
}

function webColorFromTheme(themeColor?: keyof Theme): string | undefined {
  if (!themeColor) {
    return undefined
  }

  const map: Partial<Record<keyof Theme, string>> = {
    subtle: '#94a3b8',
    bashBorder: '#f59e0b',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
    text: '#f3eadc',
  }

  return map[themeColor] ?? `var(--openclaude-${String(themeColor)}, #f3eadc)`
}

function WebPromptChar({ isLoading, themeColor }: PromptCharProps) {
  const resolvedColor = webColorFromTheme(themeColor)
  return (
    <span
      data-openclaude-prompt-char
      className="repl-promptGlyphSymbol"
      aria-hidden="true"
      style={{
        '--openclaude-promptGlyphColor': resolvedColor ?? '#f3eadc',
        '--openclaude-promptGlyphOpacity': isLoading ? 0.45 : 1,
      } as React.CSSProperties}
    >
      {figures.pointer}
    </span>
  )
}

function TerminalPromptChar({ isLoading, themeColor }: PromptCharProps) {
  const color = themeColor ?? undefined

  return (
    <Text color={color} dimColor={isLoading}>
      {figures.pointer} 
    </Text>
  )
}

function PromptChar(props: PromptCharProps) {
  if (isBrowserRuntime()) {
    return <WebPromptChar {...props} />
  }

  return <TerminalPromptChar {...props} />
}

function WebPromptInputModeIndicator({
  mode,
  isLoading,
  viewingAgentName,
  viewingAgentColor,
}: Props) {
  const teammateThemeColor = getTeammateThemeColor()

  const viewedTeammateThemeColor = viewingAgentColor
    ? AGENT_COLOR_TO_THEME_COLOR[viewingAgentColor]
    : undefined

  const isBash = mode === 'bash'

  return (
    <span
      data-openclaude-prompt-mode={mode}
      data-openclaude-viewing-agent={viewingAgentName ?? undefined}
      className="repl-promptGlyph"
      aria-hidden="true"
      style={{
        '--openclaude-promptGlyphColor': webColorFromTheme(
          viewingAgentName
            ? viewedTeammateThemeColor
            : isBash
              ? 'bashBorder'
              : isAgentSwarmsEnabled()
                ? teammateThemeColor
                : undefined,
        ) ?? '#f3eadc',
        '--openclaude-promptGlyphOpacity': isLoading ? 0.45 : 1,
      } as React.CSSProperties}
    >
      {viewingAgentName ? (
        <PromptChar
          isLoading={isLoading}
          themeColor={viewedTeammateThemeColor}
        />
      ) : isBash ? (
        <span className="repl-promptGlyphSymbol">!</span>
      ) : (
        <PromptChar
          isLoading={isLoading}
          themeColor={
            isAgentSwarmsEnabled() ? teammateThemeColor : undefined
          }
        />
      )}
    </span>
  )
}

function TerminalPromptInputModeIndicator({
  mode,
  isLoading,
  viewingAgentName,
  viewingAgentColor,
}: Props) {
  const teammateThemeColor = getTeammateThemeColor()

  const viewedTeammateThemeColor = viewingAgentColor
    ? AGENT_COLOR_TO_THEME_COLOR[viewingAgentColor]
    : undefined

  return (
    <Box
      alignItems="flex-start"
      alignSelf="flex-start"
      flexWrap="nowrap"
      justifyContent="flex-start"
    >
      {viewingAgentName ? (
        <PromptChar
          isLoading={isLoading}
          themeColor={viewedTeammateThemeColor}
        />
      ) : mode === 'bash' ? (
        <Text color="bashBorder" dimColor={isLoading}>
          ! 
        </Text>
      ) : (
        <PromptChar
          isLoading={isLoading}
          themeColor={
            isAgentSwarmsEnabled() ? teammateThemeColor : undefined
          }
        />
      )}
    </Box>
  )
}

export function PromptInputModeIndicator(props: Props) {
  if (isBrowserRuntime()) {
    return <WebPromptInputModeIndicator {...props} />
  }

  return <TerminalPromptInputModeIndicator {...props} />
}
