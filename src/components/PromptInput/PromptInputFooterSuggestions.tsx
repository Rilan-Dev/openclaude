import figures from 'figures'
import { memo, type ReactNode } from 'react'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { stringWidth } from '../../ink/stringWidth.js'
import { Box, Text } from '../../ink.js'
import { truncatePathMiddle, truncateToWidth } from '../../utils/format.js'
import { isBrowserRuntime } from '../../utils/imports.js'
import type { Theme } from '../../utils/theme.js'

export type SuggestionItem = {
  id: string
  displayText: string
  tag?: string
  description?: string
  metadata?: unknown
  color?: keyof Theme
}

export type SuggestionType =
  | 'command'
  | 'file'
  | 'directory'
  | 'agent'
  | 'shell'
  | 'custom-title'
  | 'slack-channel'
  | 'none'

export const OVERLAY_MAX_ITEMS = 5

const SELECTED_PREFIX = `${figures.pointer} `
const UNSELECTED_PREFIX = '  '
const PREFIX_WIDTH = stringWidth(SELECTED_PREFIX)

function getIcon(itemId: string): string {
  if (itemId.startsWith('file-')) return '+'
  if (itemId.startsWith('mcp-resource-')) return '◇'
  if (itemId.startsWith('agent-')) return '*'
  return '+'
}

function isUnifiedSuggestion(itemId: string): boolean {
  return (
    itemId.startsWith('file-') ||
    itemId.startsWith('mcp-resource-') ||
    itemId.startsWith('agent-')
  )
}

function getBrowserMaxWidth(maxColumnWidth?: number): string {
  if (maxColumnWidth === undefined) {
    return 'min(100%, 42ch)'
  }

  return `min(100%, ${Math.max(24, Math.min(maxColumnWidth + 6, 72))}ch)`
}

function BrowserSuggestionItemRow({
  item,
  maxColumnWidth,
  isSelected,
}: {
  item: SuggestionItem
  maxColumnWidth?: number
  isSelected: boolean
}): ReactNode {
  const icon = getIcon(item.id)
  const unified = isUnifiedSuggestion(item.id)

  return (
    <div
      className="repl-suggestionItem"
      data-selected={isSelected ? 'true' : undefined}
      data-unified={unified ? 'true' : undefined}
      role="option"
      aria-selected={isSelected}
      style={{
        maxWidth: getBrowserMaxWidth(maxColumnWidth),
      }}
    >
      <div className="repl-suggestionItemMain">
        <span className="repl-suggestionIcon">{icon}</span>
        <span className="repl-suggestionName">{item.displayText}</span>
        {item.tag ? <span className="repl-suggestionTag">{item.tag}</span> : null}
      </div>
      {item.description ? (
        <div className="repl-suggestionDescription">{item.description}</div>
      ) : null}
    </div>
  )
}

const SuggestionItemRow = memo(function SuggestionItemRow({
  item,
  maxColumnWidth,
  isSelected,
}: {
  item: SuggestionItem
  maxColumnWidth?: number
  isSelected: boolean
}): ReactNode {
  const columns = useTerminalSize().columns
  const selectionPrefix = isSelected ? SELECTED_PREFIX : UNSELECTED_PREFIX
  const rowBackgroundColor: keyof Theme | undefined = isSelected
    ? 'suggestion'
    : undefined
  const textColor: keyof Theme | undefined = isSelected ? 'inverseText' : undefined

  if (isUnifiedSuggestion(item.id)) {
    const icon = getIcon(item.id)
    const dimColor = !isSelected
    const isFile = item.id.startsWith('file-')
    const isMcpResource = item.id.startsWith('mcp-resource-')
    const iconWidth = 2
    const paddingWidth = 4
    const separatorWidth = item.description ? 3 : 0

    let displayText: string
    if (isFile) {
      const descReserve = item.description
        ? Math.min(20, stringWidth(item.description))
        : 0
      const maxPathLength =
        columns -
        PREFIX_WIDTH -
        iconWidth -
        paddingWidth -
        separatorWidth -
        descReserve
      displayText = truncatePathMiddle(item.displayText, maxPathLength)
    } else if (isMcpResource) {
      displayText = truncateToWidth(item.displayText, 30)
    } else {
      displayText = item.displayText
    }

    const availableWidth =
      columns -
      PREFIX_WIDTH -
      iconWidth -
      stringWidth(displayText) -
      separatorWidth -
      paddingWidth

    let lineContent: string
    if (item.description) {
      const truncatedDesc = truncateToWidth(
        item.description.replace(/\s+/g, ' '),
        Math.max(0, availableWidth),
      )
      lineContent = `${selectionPrefix}${icon} ${displayText} - ${truncatedDesc}`
    } else {
      lineContent = `${selectionPrefix}${icon} ${displayText}`
    }

    return (
      <Box width="100%" opaque={true} backgroundColor={rowBackgroundColor}>
        <Text color={textColor} dimColor={dimColor} bold={isSelected} wrap="truncate">
          {lineContent}
        </Text>
      </Box>
    )
  }

  const maxNameWidth = Math.floor(columns * 0.4)
  const displayTextWidth = Math.min(
    maxColumnWidth ?? stringWidth(item.displayText) + 5,
    maxNameWidth,
  )

  let displayText = item.displayText
  if (stringWidth(displayText) > displayTextWidth - 2) {
    displayText = truncateToWidth(displayText, displayTextWidth - 2)
  }

  const paddedDisplayText =
    selectionPrefix +
    displayText +
    ' '.repeat(Math.max(0, displayTextWidth - stringWidth(displayText)))
  const tagText = item.tag ? `[${item.tag}] ` : ''
  const tagWidth = stringWidth(tagText)
  const descriptionWidth = Math.max(
    0,
    columns - PREFIX_WIDTH - displayTextWidth - tagWidth - 4,
  )
  const truncatedDescription = item.description
    ? truncateToWidth(item.description.replace(/\s+/g, ' '), descriptionWidth)
    : ''
  const lineContent = `${paddedDisplayText}${tagText}${truncatedDescription}`

  return (
    <Box width="100%" opaque={true} backgroundColor={rowBackgroundColor}>
      <Text
        color={textColor}
        dimColor={!isSelected}
        bold={isSelected}
        wrap="truncate"
      >
        {lineContent}
      </Text>
    </Box>
  )
})

type Props = {
  suggestions: SuggestionItem[]
  selectedSuggestion: number
  maxColumnWidth?: number
  overlay?: boolean
}

export function PromptInputFooterSuggestions({
  suggestions,
  selectedSuggestion,
  maxColumnWidth: maxColumnWidthProp,
  overlay,
}: Props): ReactNode {
  const { rows } = useTerminalSize()
  const maxVisibleItems = overlay
    ? OVERLAY_MAX_ITEMS
    : isBrowserRuntime()
      ? Math.min(6, Math.max(1, suggestions.length))
      : Math.min(6, Math.max(1, rows - 3))

  if (suggestions.length === 0) {
    return null
  }

  const maxColumnWidth =
    maxColumnWidthProp ??
    Math.max(...suggestions.map(item => stringWidth(item.displayText))) + 5

  const startIndex = Math.max(
    0,
    Math.min(
      selectedSuggestion - Math.floor(maxVisibleItems / 2),
      suggestions.length - maxVisibleItems,
    ),
  )
  const endIndex = Math.min(startIndex + maxVisibleItems, suggestions.length)
  const visibleItems = suggestions.slice(startIndex, endIndex)

  return (
    isBrowserRuntime() ? (
      <div
        className="repl-suggestionDeck"
        data-overlay={overlay ? 'true' : undefined}
        role="listbox"
        aria-label="Prompt suggestions"
        style={{
          width: '100%',
        }}
      >
        {visibleItems.map(item => (
          <BrowserSuggestionItemRow
            key={`${item.id}:${item.id === suggestions[selectedSuggestion]?.id ? 'selected' : 'idle'}`}
            item={item}
            maxColumnWidth={maxColumnWidth}
            isSelected={item.id === suggestions[selectedSuggestion]?.id}
          />
        ))}
      </div>
    ) : (
      <Box
        flexDirection="column"
        justifyContent={overlay ? undefined : 'flex-end'}
      >
        {visibleItems.map(item => (
          <SuggestionItemRow
            key={`${item.id}:${item.id === suggestions[selectedSuggestion]?.id ? 'selected' : 'idle'}`}
            item={item}
            maxColumnWidth={maxColumnWidth}
            isSelected={item.id === suggestions[selectedSuggestion]?.id}
          />
        ))}
      </Box>
    )
  )
}

export default memo(PromptInputFooterSuggestions)
