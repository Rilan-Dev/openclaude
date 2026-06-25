import type { CSSProperties } from 'react'
import { isBrowserRuntime } from '../utils/imports.js'
import { ClickEvent } from './events/click-event.js'
import { FocusEvent } from './events/focus-event.js'
import { KeyboardEvent as InkKeyboardEvent } from './events/keyboard-event.js'
import type { ParsedKey } from './parse-keypress.js'
import type { BorderStyle } from './render-border.js'
import type { Color, Styles, TextStyles } from './styles.js'

export const INK_BROWSER_CELL_WIDTH = 8
export const INK_BROWSER_LINE_HEIGHT = 18

const DEFAULT_BROWSER_FG = '#e6edf3'
const DEFAULT_BROWSER_BG = '#0d1117'

const ANSI_COLOR_MAP: Record<string, string> = {
  black: '#0d1117',
  red: '#f85149',
  green: '#2ea043',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#d2a8ff',
  cyan: '#39c5cf',
  white: '#c9d1d9',
  blackBright: '#484f58',
  redBright: '#ff7b72',
  greenBright: '#56d364',
  yellowBright: '#e3b341',
  blueBright: '#79c0ff',
  magentaBright: '#d2a8ff',
  cyanBright: '#56d4dd',
  whiteBright: '#f0f6fc',
}

type TerminalEventLike = {
  preventDefault(): void
  stopPropagation(): void
}

function isCssColor(value: string): boolean {
  return (
    value.startsWith('#') ||
    value.startsWith('rgb(') ||
    value.startsWith('hsl(') ||
    /^[a-zA-Z]+$/.test(value)
  )
}

export function browserColor(color: Color | undefined): string | undefined {
  if (!color) return undefined

  if (color.startsWith('ansi:')) {
    return ANSI_COLOR_MAP[color.slice('ansi:'.length)] ?? DEFAULT_BROWSER_FG
  }

  if (color.startsWith('ansi256(')) {
    const value = Number(color.slice('ansi256('.length, -1))
    if (!Number.isFinite(value)) {
      return undefined
    }
    if (value < 16) {
      const ansi16 = [
        '#0d1117',
        '#f85149',
        '#2ea043',
        '#d29922',
        '#58a6ff',
        '#d2a8ff',
        '#39c5cf',
        '#c9d1d9',
        '#484f58',
        '#ff7b72',
        '#56d364',
        '#e3b341',
        '#79c0ff',
        '#d2a8ff',
        '#56d4dd',
        '#f0f6fc',
      ]
      return ansi16[value]
    }
    if (value >= 232) {
      const level = 8 + (value - 232) * 10
      return `rgb(${level},${level},${level})`
    }
    const n = value - 16
    const levels = [0, 95, 135, 175, 215, 255]
    const r = Math.floor(n / 36)
    const g = Math.floor((n % 36) / 6)
    const b = n % 6
    return `rgb(${levels[r]},${levels[g]},${levels[b]})`
  }

  if (isCssColor(color)) {
    return color
  }

  return undefined
}

export function browserLength(
  value: number | string | undefined,
  axis: 'width' | 'height' = 'width',
): string | number | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'number') {
    const unit =
      axis === 'height' ? INK_BROWSER_LINE_HEIGHT : INK_BROWSER_CELL_WIDTH
    return `${value * unit}px`
  }
  return value
}

export function browserBorderStyle(borderStyle: BorderStyle | undefined): {
  borderStyle?: CSSProperties['borderStyle']
  borderRadius?: CSSProperties['borderRadius']
} {
  if (!borderStyle) return {}

  if (borderStyle === 'round') {
    return {
      borderStyle: 'solid',
      borderRadius: '10px',
    }
  }

  if (borderStyle === 'double') {
    return {
      borderStyle: 'double',
    }
  }

  if (borderStyle === 'dashed') {
    return {
      borderStyle: 'dashed',
    }
  }

  return {
    borderStyle: 'solid',
  }
}

export function browserBoxStyle(style: Styles): CSSProperties {
  const borderStyle = browserBorderStyle(style.borderStyle)
  const borderColor = browserColor(style.borderColor)
  const borderTopColor = browserColor(style.borderTopColor ?? style.borderColor)
  const borderBottomColor = browserColor(
    style.borderBottomColor ?? style.borderColor,
  )
  const borderLeftColor = browserColor(
    style.borderLeftColor ?? style.borderColor,
  )
  const borderRightColor = browserColor(
    style.borderRightColor ?? style.borderColor,
  )
  const backgroundColor = browserColor(style.backgroundColor)

  const boxStyle: CSSProperties = {
    boxSizing: 'border-box',
    display: style.display === 'none' ? 'none' : 'flex',
    flexDirection: style.flexDirection ?? 'row',
    flexGrow: style.flexGrow,
    flexShrink: style.flexShrink,
    flexWrap:
      style.flexWrap === 'wrap-reverse'
        ? 'wrap-reverse'
        : style.flexWrap === 'wrap'
          ? 'wrap'
          : 'nowrap',
    alignItems: style.alignItems,
    alignSelf: style.alignSelf,
    justifyContent: style.justifyContent,
    position: style.position,
    top: browserLength(style.top, 'height'),
    bottom: browserLength(style.bottom, 'height'),
    left: browserLength(style.left, 'width'),
    right: browserLength(style.right, 'width'),
    width: browserLength(style.width, 'width'),
    height: browserLength(style.height, 'height'),
    minWidth: browserLength(style.minWidth, 'width'),
    minHeight: browserLength(style.minHeight, 'height'),
    maxWidth: browserLength(style.maxWidth, 'width'),
    maxHeight: browserLength(style.maxHeight, 'height'),
    overflow:
      style.overflow === 'scroll'
        ? 'auto'
        : style.overflow === 'hidden'
          ? 'hidden'
          : undefined,
    overflowX:
      style.overflowX === 'scroll'
        ? 'auto'
        : style.overflowX === 'hidden'
          ? 'hidden'
          : style.overflowX === 'visible'
            ? 'visible'
            : undefined,
    overflowY:
      style.overflowY === 'scroll'
        ? 'auto'
        : style.overflowY === 'hidden'
          ? 'hidden'
          : style.overflowY === 'visible'
            ? 'visible'
            : undefined,
    backgroundColor:
      backgroundColor ?? (style.opaque ? DEFAULT_BROWSER_BG : undefined),
    marginTop: browserLength(style.marginTop ?? style.marginY ?? style.margin, 'height'),
    marginBottom: browserLength(
      style.marginBottom ?? style.marginY ?? style.margin,
      'height',
    ),
    marginLeft: browserLength(style.marginLeft ?? style.marginX ?? style.margin, 'width'),
    marginRight: browserLength(
      style.marginRight ?? style.marginX ?? style.margin,
      'width',
    ),
    paddingTop: browserLength(
      style.paddingTop ?? style.paddingY ?? style.padding,
      'height',
    ),
    paddingBottom: browserLength(
      style.paddingBottom ?? style.paddingY ?? style.padding,
      'height',
    ),
    paddingLeft: browserLength(
      style.paddingLeft ?? style.paddingX ?? style.padding,
      'width',
    ),
    paddingRight: browserLength(
      style.paddingRight ?? style.paddingX ?? style.padding,
      'width',
    ),
    gap: browserLength(style.gap, 'width'),
    columnGap: browserLength(style.columnGap, 'width'),
    rowGap: browserLength(style.rowGap, 'height'),
    userSelect: style.noSelect ? 'none' : undefined,
    WebkitUserSelect: style.noSelect ? 'none' : undefined,
    cursor: undefined,
    ...borderStyle,
  }

  if (style.borderStyle) {
    const visibleTop = style.borderTop !== false
    const visibleBottom = style.borderBottom !== false
    const visibleLeft = style.borderLeft !== false
    const visibleRight = style.borderRight !== false

    boxStyle.borderTopWidth = visibleTop ? 1 : 0
    boxStyle.borderBottomWidth = visibleBottom ? 1 : 0
    boxStyle.borderLeftWidth = visibleLeft ? 1 : 0
    boxStyle.borderRightWidth = visibleRight ? 1 : 0
    boxStyle.borderTopStyle = visibleTop ? borderStyle.borderStyle : undefined
    boxStyle.borderBottomStyle = visibleBottom ? borderStyle.borderStyle : undefined
    boxStyle.borderLeftStyle = visibleLeft ? borderStyle.borderStyle : undefined
    boxStyle.borderRightStyle = visibleRight ? borderStyle.borderStyle : undefined
    boxStyle.borderTopColor = borderTopColor ?? borderColor
    boxStyle.borderBottomColor = borderBottomColor ?? borderColor
    boxStyle.borderLeftColor = borderLeftColor ?? borderColor
    boxStyle.borderRightColor = borderRightColor ?? borderColor
  }

  return boxStyle
}

export function browserTextStyle(t0: {
  color?: Color
  backgroundColor?: Color
  dim?: boolean
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  inverse?: boolean
  wrap?: Styles['textWrap']
}): CSSProperties {
  let color = browserColor(t0.color)
  let backgroundColor = browserColor(t0.backgroundColor)

  if (t0.inverse) {
    const nextColor = backgroundColor ?? DEFAULT_BROWSER_FG
    backgroundColor = color ?? DEFAULT_BROWSER_BG
    color = nextColor
  }

  const nowrap =
    t0.wrap === 'end' ||
    t0.wrap === 'middle' ||
    t0.wrap === 'truncate' ||
    t0.wrap === 'truncate-end' ||
    t0.wrap === 'truncate-middle' ||
    t0.wrap === 'truncate-start'

  return {
    display: 'inline-block',
    boxSizing: 'border-box',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    color,
    backgroundColor,
    fontWeight: t0.bold ? 700 : 400,
    fontStyle: t0.italic ? 'italic' : 'normal',
    textDecorationLine:
      t0.underline && t0.strikethrough
        ? 'underline line-through'
        : t0.underline
          ? 'underline'
          : t0.strikethrough
            ? 'line-through'
            : 'none',
    opacity: t0.dim ? 0.72 : 1,
    whiteSpace: nowrap ? 'nowrap' : 'pre-wrap',
    overflow: nowrap ? 'hidden' : undefined,
    textOverflow: nowrap ? 'ellipsis' : undefined,
    overflowWrap: nowrap ? 'normal' : 'anywhere',
    verticalAlign: 'baseline',
  }
}

function parsedKeyFromBrowserEvent(
  event: globalThis.KeyboardEvent,
): ParsedKey {
  const key = browserKeyName(event.key)
  const printable = event.key.length === 1 ? event.key : undefined
  const sequence = printable ?? browserKeySequence(event.key)

  return {
    kind: 'key',
    fn: false,
    name: key,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey,
    option: event.altKey,
    super: false,
    sequence,
    raw: sequence,
    isPasted: false,
    code: event.code || undefined,
  }
}

function browserKeyName(key: string): string | undefined {
  switch (key) {
    case 'Enter':
      return 'return'
    case 'Escape':
      return 'escape'
    case 'Tab':
      return 'tab'
    case 'Backspace':
      return 'backspace'
    case 'Delete':
      return 'delete'
    case 'ArrowUp':
      return 'up'
    case 'ArrowDown':
      return 'down'
    case 'ArrowLeft':
      return 'left'
    case 'ArrowRight':
      return 'right'
    case 'PageUp':
      return 'pageup'
    case 'PageDown':
      return 'pagedown'
    case 'Home':
      return 'home'
    case 'End':
      return 'end'
    case ' ':
      return 'space'
    default:
      return key.length === 1 ? key : key.toLowerCase()
  }
}

function browserKeySequence(key: string): string {
  switch (key) {
    case 'Enter':
      return '\r'
    case 'Escape':
      return '\x1b'
    case 'Tab':
      return '\t'
    case 'Backspace':
      return '\x7f'
    case ' ':
      return ' '
    default:
      return key.length === 1 ? key : ''
  }
}

function patchInkEvent<T extends object>(
  event: T,
  nativeEvent: TerminalEventLike,
): T {
  const mutableEvent = event as T & {
    preventDefault?: () => void
    stopPropagation?: () => void
    stopImmediatePropagation?: () => void
  }
  const originalPreventDefault = mutableEvent.preventDefault?.bind(mutableEvent)
  const originalStopPropagation = mutableEvent.stopPropagation?.bind(mutableEvent)
  const originalStopImmediatePropagation =
    mutableEvent.stopImmediatePropagation?.bind(mutableEvent)

  mutableEvent.preventDefault = () => {
    nativeEvent.preventDefault()
    originalPreventDefault?.()
  }
  mutableEvent.stopPropagation = () => {
    nativeEvent.stopPropagation()
    originalStopPropagation?.()
  }
  mutableEvent.stopImmediatePropagation = () => {
    nativeEvent.stopPropagation()
    originalStopImmediatePropagation?.()
  }

  return mutableEvent
}

export function browserClickEvent(
  nativeEvent: globalThis.MouseEvent,
): ClickEvent {
  return patchInkEvent(new ClickEvent(0, 0, false), nativeEvent)
}

export function browserFocusEvent(
  nativeEvent: globalThis.FocusEvent,
  type: 'focus' | 'blur',
): FocusEvent {
  return patchInkEvent(
    new FocusEvent(type, nativeEvent.relatedTarget as EventTarget | null),
    nativeEvent,
  )
}

export function browserKeyboardEvent(
  nativeEvent: globalThis.KeyboardEvent,
): InkKeyboardEvent {
  return patchInkEvent(
    new InkKeyboardEvent(parsedKeyFromBrowserEvent(nativeEvent)),
    nativeEvent,
  )
}

export function isBrowserInkRuntime(): boolean {
  return isBrowserRuntime()
}
