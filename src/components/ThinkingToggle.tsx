import * as React from 'react'
import { useState } from 'react'
import { PRODUCT_DISPLAY_NAME } from '../constants/product.js'
import { useExitOnCtrlCDWithKeybindings } from 'src/hooks/useExitOnCtrlCDWithKeybindings.js'
import { Box, Text } from '../ink.js'
import { useKeybinding } from '../keybindings/useKeybinding.js'
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint.js'
import { Select } from './CustomSelect/index.js'
import { Byline } from './design-system/Byline.js'
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js'
import { Pane } from './design-system/Pane.js'
import { isBrowserRuntime } from '../utils/runtime.js'

export type Props = {
  currentValue: boolean
  onSelect: (enabled: boolean) => void
  onCancel?: () => void
  isMidConversation?: boolean
}

const thinkingOptions = [
  {
    value: 'true',
    label: 'Enabled',
    description: `${PRODUCT_DISPLAY_NAME} will think before responding`,
  },
  {
    value: 'false',
    label: 'Disabled',
    description: `${PRODUCT_DISPLAY_NAME} will respond without extended thinking`,
  },
]

export function ThinkingToggle({
  currentValue,
  onSelect,
  onCancel,
  isMidConversation,
}: Props): React.ReactNode {
  const exitState = useExitOnCtrlCDWithKeybindings()
  const [confirmationPending, setConfirmationPending] = useState<boolean | null>(null)

  const cancel = React.useCallback(() => {
    if (confirmationPending !== null) {
      setConfirmationPending(null)
      return
    }

    onCancel?.()
  }, [confirmationPending, onCancel])

  useKeybinding('confirm:no', cancel, {
    context: 'Confirmation',
  })

  const confirm = React.useCallback(() => {
    if (confirmationPending !== null) {
      onSelect(confirmationPending)
    }
  }, [confirmationPending, onSelect])

  useKeybinding('confirm:yes', confirm, {
    context: 'Confirmation',
    isActive: confirmationPending !== null,
  })

  const selectValue = React.useCallback(
    (enabled: boolean) => {
      if (isMidConversation && enabled !== currentValue) {
        setConfirmationPending(enabled)
        return
      }

      onSelect(enabled)
    },
    [currentValue, isMidConversation, onSelect],
  )

  const handleSelectChange = React.useCallback(
    (value: string) => {
      selectValue(value === 'true')
    },
    [selectValue],
  )

  if (isBrowserRuntime()) {
    if (confirmationPending !== null) {
      return (
        <div className="oc-thinkingToggleCard" data-confirming="true">
          <div className="oc-thinkingToggleHeader">
            <span className="oc-thinkingToggleKicker">Session controls</span>
            <h2>Confirm thinking change</h2>
            <p>
              Changing thinking during an active conversation can affect latency and
              response consistency.
            </p>
          </div>
          <div className="oc-thinkingToggleActions">
            <button
              type="button"
              className="oc-thinkingTogglePrimary"
              onClick={() => onSelect(confirmationPending)}
            >
              Apply change
            </button>
            <button
              type="button"
              className="oc-thinkingToggleGhost"
              onClick={() => setConfirmationPending(null)}
            >
              Keep current
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="oc-thinkingToggleCard">
        <div className="oc-thinkingToggleHeader">
          <span className="oc-thinkingToggleKicker">Session controls</span>
          <h2>Thinking mode</h2>
          <p>
            Choose whether {PRODUCT_DISPLAY_NAME} should spend extra reasoning before
            responding.
          </p>
        </div>
        <div className="oc-thinkingToggleOptions" role="group" aria-label="Thinking mode">
          <button
            type="button"
            className="oc-thinkingToggleOption"
            data-selected={currentValue ? 'true' : undefined}
            onClick={() => selectValue(true)}
          >
            <span>Enabled</span>
            <small>{PRODUCT_DISPLAY_NAME} thinks before responding</small>
          </button>
          <button
            type="button"
            className="oc-thinkingToggleOption"
            data-selected={!currentValue ? 'true' : undefined}
            onClick={() => selectValue(false)}
          >
            <span>Disabled</span>
            <small>Respond without extended thinking</small>
          </button>
        </div>
        <div className="oc-thinkingToggleActions">
          <button type="button" className="oc-thinkingToggleGhost" onClick={onCancel}>
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <Pane color="permission">
      <Box flexDirection="column">
        <Box marginBottom={1} flexDirection="column">
          <Text color="remember" bold>
            Toggle thinking mode
          </Text>
          <Text dimColor>Enable or disable thinking for this session.</Text>
        </Box>
        {confirmationPending !== null ? (
          <Box flexDirection="column" marginBottom={1} gap={1}>
            <Text color="warning">
              Changing thinking mode mid-conversation will increase latency and may
              reduce quality. For best results, set this at the start of a session.
            </Text>
            <Text color="warning">Do you want to proceed?</Text>
          </Box>
        ) : (
          <Box flexDirection="column" marginBottom={1}>
            <Select
              defaultValue={currentValue ? 'true' : 'false'}
              defaultFocusValue={currentValue ? 'true' : 'false'}
              options={thinkingOptions}
              onChange={handleSelectChange}
              onCancel={onCancel ?? noop}
              visibleOptionCount={2}
            />
          </Box>
        )}
        <Text dimColor italic>
          {exitState.pending ? (
            <>Press {exitState.keyName} again to exit</>
          ) : confirmationPending !== null ? (
            <Byline>
              <KeyboardShortcutHint shortcut="Enter" action="confirm" />
              <ConfigurableShortcutHint
                action="confirm:no"
                context="Confirmation"
                fallback="Esc"
                description="cancel"
              />
            </Byline>
          ) : (
            <Byline>
              <KeyboardShortcutHint shortcut="Enter" action="confirm" />
              <ConfigurableShortcutHint
                action="confirm:no"
                context="Confirmation"
                fallback="Esc"
                description="exit"
              />
            </Byline>
          )}
        </Text>
      </Box>
    </Pane>
  )
}

function noop(): void {}
