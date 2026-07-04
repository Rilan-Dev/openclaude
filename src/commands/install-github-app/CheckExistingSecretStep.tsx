import React, { useState } from 'react';
import TextInput from '../../components/TextInput.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { Box, color, Text, useTheme } from '../../ink.js';
import { useKeybindings } from '../../keybindings/useKeybinding.js';
import { isBrowserRuntime } from '../../utils/runtime.js';

interface CheckExistingSecretStepProps {
  useExistingSecret: boolean;
  secretName: string;
  onToggleUseExistingSecret: (useExisting: boolean) => void;
  onSecretNameChange: (value: string) => void;
  onSubmit: () => void;
}

export function CheckExistingSecretStep({
  useExistingSecret,
  secretName,
  onToggleUseExistingSecret,
  onSecretNameChange,
  onSubmit,
}: CheckExistingSecretStepProps): React.ReactNode {
  const [cursorOffset, setCursorOffset] = useState(0);
  const terminalSize = useTerminalSize();
  const [theme] = useTheme();

  const handlePrevious = () => onToggleUseExistingSecret(true);
  const handleNext = () => onToggleUseExistingSecret(false);

  useKeybindings(
    {
      'confirm:previous': handlePrevious,
      'confirm:next': handleNext,
      'confirm:yes': onSubmit,
    },
    {
      context: 'Confirmation',
      isActive: useExistingSecret,
    },
  );

  useKeybindings(
    {
      'confirm:previous': handlePrevious,
      'confirm:next': handleNext,
    },
    {
      context: 'Confirmation',
      isActive: !useExistingSecret,
    },
  );

  if (isBrowserRuntime()) {
    return (
      <section className="repl-webPicker repl-githubAppSurface">
        <div className="repl-webPickerHeader">
          <span className="repl-webPickerKicker">GitHub App</span>
          <h2>Repository secret already exists</h2>
          <p>Choose whether to reuse `ANTHROPIC_API_KEY` or create a separate secret for this workflow.</p>
        </div>
        <div className="repl-webPickerNotice">ANTHROPIC_API_KEY already exists in repository secrets.</div>
        <div className="repl-webPickerList">
          <button type="button" className="repl-webPickerOption" data-focused={useExistingSecret ? 'true' : undefined} data-selected={useExistingSecret ? 'true' : undefined} onClick={() => onToggleUseExistingSecret(true)}>
            <span className="repl-webPickerOptionMark">USE</span>
            <span className="repl-webPickerOptionCopy">
              <span className="repl-webPickerOptionTitle">Use the existing API key</span>
              <span className="repl-webPickerOptionDescription">Keep the current repository secret.</span>
            </span>
          </button>
          <button type="button" className="repl-webPickerOption" data-focused={!useExistingSecret ? 'true' : undefined} data-selected={!useExistingSecret ? 'true' : undefined} onClick={() => onToggleUseExistingSecret(false)}>
            <span className="repl-webPickerOptionMark">NEW</span>
            <span className="repl-webPickerOptionCopy">
              <span className="repl-webPickerOptionTitle">Create a differently named secret</span>
              <span className="repl-webPickerOptionDescription">Avoid overwriting the existing API key.</span>
            </span>
          </button>
        </div>
        {!useExistingSecret ? (
          <label className="repl-githubAppField">
            <span>New secret name</span>
            <input value={secretName} onChange={event => onSecretNameChange(event.currentTarget.value)} placeholder="CLAUDE_API_KEY" autoFocus />
          </label>
        ) : null}
        <div className="repl-webPickerFooter">
          <button type="button" className="repl-webPickerGhostButton" onClick={onSubmit}>Continue</button>
        </div>
      </section>
    );
  }

  const selectedPrefix = (selected: boolean) => selected ? color('success', theme)('> ') : '  ';

  return (
    <>
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Install GitHub App</Text>
          <Text dimColor>Setup API key secret</Text>
        </Box>
        <Box marginBottom={1}>
          <Text color="warning">ANTHROPIC_API_KEY already exists in repository secrets!</Text>
        </Box>
        <Box marginBottom={1}>
          <Text>Would you like to:</Text>
        </Box>
        <Box marginBottom={1}>
          <Text>{selectedPrefix(useExistingSecret)}Use the existing API key</Text>
        </Box>
        <Box marginBottom={1}>
          <Text>{selectedPrefix(!useExistingSecret)}Create a new secret with a different name</Text>
        </Box>
        {!useExistingSecret ? (
          <>
            <Box marginBottom={1}>
              <Text>Enter new secret name (alphanumeric with underscores):</Text>
            </Box>
            <TextInput
              value={secretName}
              onChange={onSecretNameChange}
              onSubmit={onSubmit}
              focus
              placeholder="e.g., CLAUDE_API_KEY"
              columns={terminalSize.columns}
              cursorOffset={cursorOffset}
              onChangeCursorOffset={setCursorOffset}
              showCursor
            />
          </>
        ) : null}
      </Box>
      <Box marginLeft={3}>
        <Text dimColor>↑/↓ to select · Enter to continue</Text>
      </Box>
    </>
  );
}
