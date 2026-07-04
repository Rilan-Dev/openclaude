import * as React from 'react'

type WebSelectOption = {
  value: string
  label: React.ReactNode
  description?: string
  disabled?: boolean
}

type Props = {
  kicker?: string
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
  kicker = 'OpenClaude',
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
  const activeValue = focusedValue ?? selectedValue
  const activeOptionRef = React.useRef<HTMLButtonElement | null>(null)
  const [query, setQuery] = React.useState('')
  const showSearch = options.length > 7
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleOptions = normalizedQuery
    ? options.filter(option => {
        const label = plainText(option.label).toLocaleLowerCase()
        const description = option.description?.toLocaleLowerCase() ?? ''
        return label.includes(normalizedQuery) || description.includes(normalizedQuery)
      })
    : options

  React.useEffect(() => {
    activeOptionRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    })
  }, [activeValue, options.length])

  return (
    <section className={['repl-webPicker', className].filter(Boolean).join(' ')}>
      <div className="repl-webPickerHeader">
        <span className="repl-webPickerKicker">{kicker}</span>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>

      {showSearch ? (
        <label className="repl-webPickerSearch">
          <span>Search</span>
          <input
            value={query}
            type="search"
            spellCheck={false}
            placeholder="Filter options..."
            onChange={event => setQuery(event.currentTarget.value)}
          />
        </label>
      ) : null}

      <div className="repl-webPickerList" role="listbox" aria-label={title}>
        {visibleOptions.map(option => {
          const isSelected = selectedValue === option.value
          const isFocused = focusedValue === option.value
          const isActive = activeValue === option.value
          return (
            <button
              key={option.value}
              ref={isActive ? activeOptionRef : undefined}
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
              <span className="repl-webPickerOptionMark" aria-hidden="true" />
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
        {visibleOptions.length === 0 ? (
          <div className="repl-webPickerEmpty" role="status">
            No matching options.
          </div>
        ) : null}
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
