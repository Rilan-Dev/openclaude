import * as React from 'react'

type WebSelectOption = {
  value: string
  label: React.ReactNode
  description?: string
  disabled?: boolean
}

type Props = {
  title: string
  subtitle?: React.ReactNode
  options: WebSelectOption[]
  selectedValue?: string
  focusedValue?: string
  hiddenCount?: number
  className?: string
  onSelect: (value: string) => void
  onFocus?: (value: string) => void
  onCancel?: () => void
  footer?: React.ReactNode
}

export function WebSelectList({
  title,
  subtitle,
  options,
  selectedValue,
  focusedValue,
  hiddenCount = 0,
  className,
  onSelect,
  onFocus,
  onCancel,
  footer,
}: Props): React.ReactNode {
  return (
    <section className={['repl-webPicker', className].filter(Boolean).join(' ')}>
      <div className="repl-webPickerHeader">
        <span className="repl-webPickerKicker">OpenClaude</span>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>

      <div className="repl-webPickerList" role="listbox" aria-label={title}>
        {options.map(option => {
          const isSelected = selectedValue === option.value
          const isFocused = focusedValue === option.value
          return (
            <button
              key={option.value}
              type="button"
              className="repl-webPickerOption"
              data-selected={isSelected ? 'true' : undefined}
              data-focused={isFocused ? 'true' : undefined}
              disabled={option.disabled}
              role="option"
              aria-selected={isSelected}
              onMouseEnter={() => onFocus?.(option.value)}
              onFocus={() => onFocus?.(option.value)}
              onClick={() => {
                if (!option.disabled) {
                  onSelect(option.value)
                }
              }}
            >
              <span className="repl-webPickerOptionMark" aria-hidden="true">
                {isSelected ? 'On' : option.disabled ? '--' : 'Go'}
              </span>
              <span className="repl-webPickerOptionCopy">
                <span className="repl-webPickerOptionTitle">
                  {plainText(option.label)}
                </span>
                {option.description ? (
                  <span className="repl-webPickerOptionDescription">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>

      {hiddenCount > 0 ? (
        <div className="repl-webPickerMore">and {hiddenCount} more options</div>
      ) : null}

      <div className="repl-webPickerFooter">
        {footer}
        {onCancel ? (
          <button
            type="button"
            className="repl-webPickerGhostButton"
            onClick={onCancel}
          >
            Back
          </button>
        ) : null}
      </div>
    </section>
  )
}

function plainText(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(plainText).join('')
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return plainText(node.props.children)
  }
  return ''
}
