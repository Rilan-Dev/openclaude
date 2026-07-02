import type { CSSProperties } from 'react'
import type { Color, Styles } from '../../ink/styles.js'

const ANSI_COLORS: Record<string, string> = {
  'ansi:black': '#111111',
  'ansi:red': '#d35f5f',
  'ansi:green': '#7aa874',
  'ansi:yellow': '#d7a84f',
  'ansi:blue': '#7c9cff',
  'ansi:magenta': '#c58af9',
  'ansi:cyan': '#63c8c8',
  'ansi:white': '#e8e4dc',
  'ansi:blackBright': '#5f5f5f',
  'ansi:redBright': '#ff7a70',
  'ansi:greenBright': '#9bd48f',
  'ansi:yellowBright': '#ffd166',
  'ansi:blueBright': '#9bb4ff',
  'ansi:magentaBright': '#d9a6ff',
  'ansi:cyanBright': '#8fe7e7',
  'ansi:whiteBright': '#fff7ed',
}

function units(value: number | string | undefined): string | number | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'string') return value
  return `${value * 0.55}rem`
}

function color(value: Color | undefined): string | undefined {
  if (!value) return undefined
  if (value.startsWith('ansi256(')) return undefined
  return ANSI_COLORS[value] ?? value
}

export function inkBoxStylesToCss(style: Partial<Styles>): CSSProperties {
  const borderColor = color(style.borderColor)
  const borderStyle = style.borderStyle ? 'solid' : undefined
  const borderWidth = style.borderStyle ? 1 : undefined

  return {
    position: style.position,
    top: units(style.top),
    bottom: units(style.bottom),
    left: units(style.left),
    right: units(style.right),
    display: style.display === 'none' ? 'none' : 'flex',
    flexDirection: style.flexDirection,
    flexGrow: style.flexGrow,
    flexShrink: style.flexShrink,
    flexBasis: style.flexBasis,
    flexWrap: style.flexWrap,
    alignItems: style.alignItems,
    alignSelf: style.alignSelf,
    justifyContent: style.justifyContent,
    width: units(style.width),
    height: units(style.height),
    minWidth: units(style.minWidth),
    minHeight: units(style.minHeight),
    maxWidth: units(style.maxWidth),
    maxHeight: units(style.maxHeight),
    gap: units(style.gap),
    columnGap: units(style.columnGap),
    rowGap: units(style.rowGap),
    margin: units(style.margin),
    marginTop: units(style.marginTop ?? style.marginY),
    marginBottom: units(style.marginBottom ?? style.marginY),
    marginLeft: units(style.marginLeft ?? style.marginX),
    marginRight: units(style.marginRight ?? style.marginX),
    padding: units(style.padding),
    paddingTop: units(style.paddingTop ?? style.paddingY),
    paddingBottom: units(style.paddingBottom ?? style.paddingY),
    paddingLeft: units(style.paddingLeft ?? style.paddingX),
    paddingRight: units(style.paddingRight ?? style.paddingX),
    overflowX: style.overflowX ?? style.overflow,
    overflowY: style.overflowY ?? style.overflow,
    backgroundColor: color(style.backgroundColor),
    borderStyle,
    borderWidth,
    borderColor,
    borderTop: style.borderTop === false ? 0 : undefined,
    borderBottom: style.borderBottom === false ? 0 : undefined,
    borderLeft: style.borderLeft === false ? 0 : undefined,
    borderRight: style.borderRight === false ? 0 : undefined,
    borderTopColor: color(style.borderTopColor),
    borderBottomColor: color(style.borderBottomColor),
    borderLeftColor: color(style.borderLeftColor),
    borderRightColor: color(style.borderRightColor),
    borderRadius: style.borderStyle ? '0.85rem' : undefined,
    boxSizing: 'border-box',
    minInlineSize: 0,
  }
}

export function inkTextStylesToCss({
  color: foreground,
  backgroundColor,
  bold,
  dim,
  italic,
  underline,
  strikethrough,
  inverse,
  wrap,
}: {
  color?: Color
  backgroundColor?: Color
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  inverse?: boolean
  wrap?: Styles['textWrap']
}): CSSProperties {
  const resolvedColor = color(foreground)
  const resolvedBackground = color(backgroundColor)
  const decorations = [
    underline ? 'underline' : null,
    strikethrough ? 'line-through' : null,
  ].filter(Boolean).join(' ')
  const truncate = wrap?.startsWith('truncate')

  return {
    color: inverse ? resolvedBackground : resolvedColor,
    backgroundColor: inverse ? resolvedColor : resolvedBackground,
    opacity: dim ? 0.62 : undefined,
    fontWeight: bold ? 750 : undefined,
    fontStyle: italic ? 'italic' : undefined,
    textDecoration: decorations || undefined,
    whiteSpace: truncate ? 'nowrap' : 'pre-wrap',
    overflow: truncate ? 'hidden' : undefined,
    textOverflow: truncate ? 'ellipsis' : undefined,
    overflowWrap: truncate ? undefined : 'anywhere',
    minInlineSize: 0,
  }
}
