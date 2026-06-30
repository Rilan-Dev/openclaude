import * as React from 'react'
import { renderPlaceholder } from '../hooks/renderPlaceholder.js'
import { usePasteHandler } from '../hooks/usePasteHandler.js'
import { useDeclaredCursor } from '../ink/hooks/use-declared-cursor.js'
import { Ansi, Box, Text, useInput } from '../ink.js'
import type { BaseInputState, BaseTextInputProps } from '../types/textInputTypes.js'
import { PASTE_THRESHOLD } from '../utils/imagePaste.js'
import { isBrowserRuntime } from '../utils/imports.js'
import type { TextHighlight } from '../utils/textHighlighting.js'
import { HighlightedInput } from './PromptInput/ShimmeredInput.js'

type BaseTextInputComponentProps = BaseTextInputProps & {
  inputState: BaseInputState
  children?: React.ReactNode
  terminalFocus: boolean
  highlights?: TextHighlight[]
  invert?: (text: string) => string
  hidePlaceholderText?: boolean
}

function readBrowserImageFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to read pasted image'))
        return
      }

      const result = reader.result
      const commaIndex = result.indexOf(',')
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
    }

    reader.onerror = () => {
      reject(reader.error ?? new Error('Unable to read pasted image'))
    }

    reader.readAsDataURL(file)
  })
}

function isCursorOnFirstLine(value: string, cursorOffset: number): boolean {
  if (cursorOffset <= 0) {
    return true
  }

  return value.lastIndexOf('\n', cursorOffset - 1) === -1
}

function isCursorOnLastLine(value: string, cursorOffset: number): boolean {
  return value.indexOf('\n', cursorOffset) === -1
}

function BrowserBaseTextInput({
  inputState,
  children,
  hidePlaceholderText,
  ...props
}: BaseTextInputComponentProps): React.ReactNode {
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(
    null,
  )
  const [isFocused, setIsFocused] = React.useState(Boolean(props.focus))

  const { value } = inputState
  const commandWithoutArgs =
    (value && value.trim().indexOf(' ') === -1) ||
    (value && value.endsWith(' '))
  const showArgumentHint = Boolean(
    props.argumentHint && value && commandWithoutArgs && value.startsWith('/'),
  )
  const placeholder =
    hidePlaceholderText && value.length === 0 ? '' : props.placeholder
  React.useEffect(() => {
    setIsFocused(Boolean(props.focus))
  }, [props.focus])

  const shellBorderColor = isFocused
    ? 'rgba(96, 165, 250, 0.62)'
    : 'rgba(148, 163, 184, 0.18)'
  const shellGlowColor = isFocused
    ? 'rgba(37, 99, 235, 0.28)'
    : 'rgba(2, 6, 23, 0.24)'
  const shellStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 0,
    borderRadius: 24,
    border: `1px solid ${shellBorderColor}`,
    background:
      'linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.72))',
    boxShadow:
      `0 20px 58px ${shellGlowColor}, inset 0 1px 0 rgba(255, 255, 255, 0.04)`,
    backdropFilter: 'blur(18px) saturate(1.15)',
    overflow: 'hidden',
    transition:
      'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
    transform: isFocused ? 'translateY(-1px)' : 'translateY(0)',
    opacity: props.dimColor ? 0.78 : 1,
  }
  const fieldStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: '#f8fafc',
    fontFamily:
      '"Aptos", "Segoe UI Variable", "SF Pro Text", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
    fontSize: 15,
    lineHeight: 1.55,
    letterSpacing: '-0.01em',
    caretColor: '#7dd3fc',
    resize: props.multiline ? 'vertical' : 'none',
    minHeight: props.multiline ? 72 : 52,
    maxHeight: props.multiline ? 360 : undefined,
    padding: props.multiline ? '1rem 1.05rem' : '0.9rem 1.05rem',
    transition: 'color 160ms ease, opacity 160ms ease',
  }

  React.useEffect(() => {
    const element = inputRef.current

    if (!element) {
      return
    }

    if (props.focus) {
      element.focus()
      return
    }

    if (document.activeElement === element) {
      element.blur()
    }
  }, [props.focus])

  React.useLayoutEffect(() => {
    const element = inputRef.current

    if (!element) {
      return
    }

    if (document.activeElement !== element) {
      return
    }

    const nextOffset = Math.max(0, Math.min(props.cursorOffset, value.length))
    if (
      element.selectionStart !== nextOffset ||
      element.selectionEnd !== nextOffset
    ) {
      element.selectionStart = nextOffset
      element.selectionEnd = nextOffset
    }
  }, [props.cursorOffset, value])

  React.useLayoutEffect(() => {
    if (!props.multiline || !(inputRef.current instanceof HTMLTextAreaElement)) {
      return
    }

    const textarea = inputRef.current
    textarea.style.height = '0px'
    textarea.style.height = `${Math.max(textarea.scrollHeight, 44)}px`
  }, [props.multiline, value])

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const target = event.currentTarget
      props.onChange(target.value)
      props.onChangeCursorOffset(target.selectionStart ?? target.value.length)
    },
    [props],
  )

  const handleSelect = React.useCallback(
    (event: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const target = event.currentTarget
      props.onChangeCursorOffset(target.selectionStart ?? target.value.length)
    },
    [props],
  )

  const handleFocus = React.useCallback(() => {
    setIsFocused(true)
  }, [])

  const handleBlur = React.useCallback(() => {
    setIsFocused(false)
  }, [])

  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const imageFile = Array.from(event.clipboardData.files ?? []).find(file =>
        file.type.startsWith('image/'),
      )

      if (imageFile && props.onImagePaste) {
        event.preventDefault()
        void readBrowserImageFileAsBase64(imageFile).then(base64Image => {
          props.onImagePaste?.(base64Image, imageFile.type, imageFile.name)
        })
        return
      }

      const pastedText = event.clipboardData.getData('text/plain')
      if (props.onPaste && pastedText.length > PASTE_THRESHOLD) {
        event.preventDefault()
        props.onPaste(pastedText)
      }
    },
    [props],
  )

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const target = event.currentTarget
      const currentValue = target.value
      const cursorOffset = target.selectionStart ?? currentValue.length

      if (
        event.key === 'ArrowUp' &&
        props.onHistoryUp &&
        (props.disableCursorMovementForUpDownKeys ||
          isCursorOnFirstLine(currentValue, cursorOffset))
      ) {
        event.preventDefault()
        props.onHistoryUp()
        return
      }

      if (
        event.key === 'ArrowDown' &&
        props.onHistoryDown &&
        (props.disableCursorMovementForUpDownKeys ||
          isCursorOnLastLine(currentValue, cursorOffset))
      ) {
        event.preventDefault()
        props.onHistoryDown()
        return
      }

      if (
        event.key === 'Enter' &&
        props.onSubmit &&
        (!props.multiline || (!event.shiftKey && !event.metaKey))
      ) {
        event.preventDefault()
        props.onSubmit(currentValue)
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        if (props.onUndo) {
          event.preventDefault()
          props.onUndo()
        }
        return
      }

      if (event.key === 'Escape' && currentValue.length === 0) {
        props.onExit?.()
      }
    },
    [props],
  )

  if (props.multiline) {
    return (
      <div
        data-openclaude-web-base-text-input="surface"
        data-openclaude-web-base-text-input-kind="textarea"
        data-openclaude-web-base-text-input-focused={isFocused ? 'true' : 'false'}
        className="repl-textInputSurface"
        style={shellStyle}
      >
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          className="repl-textInputField repl-textInputFieldMultiline"
          value={value}
          onChange={handleChange}
          onSelect={handleSelect}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          readOnly={!props.focus}
          style={fieldStyle}
        />
        {showArgumentHint ? (
          <div
            className="repl-textInputHint"
          >
            {value.endsWith(' ') ? '' : ' '}
            {props.argumentHint}
          </div>
        ) : null}
        {children}
      </div>
    )
  }

  return (
    <div
      data-openclaude-web-base-text-input="surface"
      data-openclaude-web-base-text-input-kind="input"
      data-openclaude-web-base-text-input-focused={isFocused ? 'true' : 'false'}
      className="repl-textInputSurface"
      style={shellStyle}
    >
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        className="repl-textInputField repl-textInputFieldSingle"
        type={props.mask ? 'password' : 'text'}
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        readOnly={!props.focus}
        style={fieldStyle}
      />
      {showArgumentHint ? (
        <div
          className="repl-textInputHint"
        >
          {value.endsWith(' ') ? '' : ' '}
          {props.argumentHint}
        </div>
      ) : null}
      {children}
    </div>
  )
}

function TerminalBaseTextInput({
  inputState,
  children,
  terminalFocus,
  highlights,
  invert,
  hidePlaceholderText,
  ...props
}: BaseTextInputComponentProps): React.ReactNode {
  const {
    onInput,
    value,
    renderedValue,
    cursorLine,
    cursorColumn,
    offset,
    viewportCharOffset,
    viewportCharEnd,
  } = inputState

  const cursorRef = useDeclaredCursor({
    line: cursorLine,
    column: cursorColumn,
    active: Boolean(props.focus && props.showCursor && terminalFocus),
  })
  const isPastingRef = React.useRef(false)

  const { wrappedOnInput, isPasting } = usePasteHandler({
    onPaste: props.onPaste,
    onInput: (input, key) => {
      if (isPastingRef.current && key.return) {
        return
      }
      onInput(input, key)
    },
    onImagePaste: props.onImagePaste,
  })

  React.useEffect(() => {
    isPastingRef.current = isPasting
  }, [isPasting])

  React.useEffect(() => {
    props.onIsPastingChange?.(isPasting)
  }, [isPasting, props.onIsPastingChange])

  const { showPlaceholder, renderedPlaceholder } = renderPlaceholder({
    placeholder: props.placeholder,
    value,
    showCursor: props.showCursor,
    focus: props.focus,
    terminalFocus,
    invert,
    hidePlaceholderText,
  })

  useInput(wrappedOnInput, {
    isActive: props.focus,
  })

  const commandWithoutArgs =
    (value && value.trim().indexOf(' ') === -1) ||
    (value && value.endsWith(' '))
  const showArgumentHint = Boolean(
    props.argumentHint && value && commandWithoutArgs && value.startsWith('/'),
  )
  const cursorFiltered =
    props.showCursor && highlights
      ? highlights.filter(
          highlight =>
            highlight.dimColor ||
            offset < highlight.start ||
            offset >= highlight.end,
        )
      : highlights

  const filteredHighlights =
    cursorFiltered && viewportCharOffset > 0
      ? cursorFiltered
          .filter(
            highlight =>
              highlight.end > viewportCharOffset &&
              highlight.start < viewportCharEnd,
          )
          .map(highlight => ({
            ...highlight,
            start: Math.max(0, highlight.start - viewportCharOffset),
            end: highlight.end - viewportCharOffset,
          }))
      : cursorFiltered

  const hasHighlights = Boolean(filteredHighlights?.length)

  if (hasHighlights && filteredHighlights) {
    return (
      <Box ref={cursorRef}>
        <HighlightedInput text={renderedValue} highlights={filteredHighlights} />
        {showArgumentHint ? (
          <Text dimColor>{value.endsWith(' ') ? '' : ' '}{props.argumentHint}</Text>
        ) : null}
        {children}
      </Box>
    )
  }

  return (
    <Box ref={cursorRef}>
      <Text wrap="truncate-end" dimColor={props.dimColor}>
        {showPlaceholder && props.placeholderElement
          ? props.placeholderElement
          : showPlaceholder && renderedPlaceholder
            ? <Ansi>{renderedPlaceholder}</Ansi>
            : <Ansi>{renderedValue}</Ansi>}
        {showArgumentHint ? (
          <Text dimColor>{value.endsWith(' ') ? '' : ' '}{props.argumentHint}</Text>
        ) : null}
        {children}
      </Text>
    </Box>
  )
}

/**
 * A base component for text inputs that handles rendering and basic input.
 */
export function BaseTextInput(
  props: BaseTextInputComponentProps,
): React.ReactNode {
  if (isBrowserRuntime()) {
    return <BrowserBaseTextInput {...props} />
  }

  return <TerminalBaseTextInput {...props} />
}
