import React, { useState } from 'react';
import TextInput from '../../components/TextInput.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { Box, color, Text, useTheme } from '../../ink.js';
import { useKeybindings } from '../../keybindings/useKeybinding.js';
import { isBrowserRuntime } from '../../utils/runtime.js';

interface ApiKeyStepProps {
  existingApiKey: string | null;
  useExistingKey: boolean;
  apiKeyOrOAuthToken: string;
  onApiKeyChange: (value: string) => void;
  onToggleUseExistingKey: (useExisting: boolean) => void;
  onSubmit: () => void;
  onCreateOAuthToken?: () => void;
  selectedOption?: 'existing' | 'new' | 'oauth';
  onSelectOption?: (option: 'existing' | 'new' | 'oauth') => void;
}

export function ApiKeyStep({
  existingApiKey,
  apiKeyOrOAuthToken,
  onApiKeyChange,
  onSubmit,
  onToggleUseExistingKey,
  onCreateOAuthToken,
  selectedOption = existingApiKey ? 'existing' : onCreateOAuthToken ? 'oauth' : 'new',
  onSelectOption,
}: ApiKeyStepProps): React.ReactNode {
  const [cursorOffset, setCursorOffset] = useState(0);
  const terminalSize = useTerminalSize();
  const [theme] = useTheme();

  const handlePrevious = () => {
    if (selectedOption === 'new' && onCreateOAuthToken) {
      onSelectOption?.('oauth');
    } else if (selectedOption === 'oauth' && existingApiKey) {
      onSelectOption?.('existing');
      onToggleUseExistingKey(true);
    }
  };

  const handleNext = () => {
    if (selectedOption === 'existing') {
      onSelectOption?.(onCreateOAuthToken ? 'oauth' : 'new');
      onToggleUseExistingKey(false);
    } else if (selectedOption === 'oauth') {
      onSelectOption?.('new');
    }
  };

  const handleConfirm = () => {
    if (selectedOption === 'oauth' && onCreateOAuthToken) {
      onCreateOAuthToken();
    } else {
      onSubmit();
    }
  };

  const isTextInputVisible = selectedOption === 'new';

  useKeybindings(
    {
      'confirm:previous': handlePrevious,
      'confirm:next': handleNext,
      'confirm:yes': handleConfirm,
    },
    {
      context: 'Confirmation',
      isActive: !isTextInputVisible,
    },
  );

  useKeybindings(
    {
      'confirm:previous': handlePrevious,
      'confirm:next': handleNext,
    },
    {
      context: 'Confirmation',
      isActive: isTextInputVisible,
    },
  );

  const selectOption = (option: 'existing' | 'new' | 'oauth') => {
    onSelectOption?.(option);
    onToggleUseExistingKey(option === 'existing');
  };

  if (isBrowserRuntime()) {
    return (
      <section className="repl-webPicker repl-githubAppSurface">
        <div className="repl-webPickerHeader">
          <span className="repl-webPickerKicker">GitHub App</span>
          <h2>Choose API credentials</h2>
          <p>Connect the GitHub App with an existing key, a Claude subscription token, or a new API key.</p>
        </div>
        <div className="repl-webPickerList">
          {existingApiKey ? (
            <button type="button" className="repl-webPickerOption" data-focused={selectedOption === 'existing' ? 'true' : undefined} data-selected={selectedOption === 'existing' ? 'true' : undefined} onClick={() => selectOption('existing')}>
              <span className="repl-webPickerOptionMark">KEY</span>
              <span className="repl-webPickerOptionCopy">
                <span className="repl-webPickerOptionTitle">Use existing Claude Code API key</span>
                <span className="repl-webPickerOptionDescription">Reuse the key already configured in this environment.</span>
              </span>
            </button>
          ) : null}
          {onCreateOAuthToken ? (
            <button type="button" className="repl-webPickerOption" data-focused={selectedOption === 'oauth' ? 'true' : undefined} data-selected={selectedOption === 'oauth' ? 'true' : undefined} onClick={() => selectOption('oauth')}>
              <span className="repl-webPickerOptionMark">AUTH</span>
              <span className="repl-webPickerOptionCopy">
                <span className="repl-webPickerOptionTitle">Create long-lived token</span>
                <span className="repl-webPickerOptionDescription">Use your Claude subscription to create a token.</span>
              </span>
            </button>
          ) : null}
          <button type="button" className="repl-webPickerOption" data-focused={selectedOption === 'new' ? 'true' : undefined} data-selected={selectedOption === 'new' ? 'true' : undefined} onClick={() => selectOption('new')}>
            <span className="repl-webPickerOptionMark">NEW</span>
            <span className="repl-webPickerOptionCopy">
              <span className="repl-webPickerOptionTitle">Enter a new API key</span>
              <span className="repl-webPickerOptionDescription">Paste a key from the Claude API key settings page.</span>
            </span>
          </button>
        </div>
        {selectedOption === 'new' ? (
          <label className="repl-githubAppField">
            <span>API key</span>
            <input type="password" value={apiKeyOrOAuthToken} onChange={event => onApiKeyChange(event.currentTarget.value)} placeholder="sk-ant…" autoFocus />
          </label>
        ) : null}
        <div className="repl-webPickerFooter">
          <button type="button" className="repl-webPickerGhostButton" onClick={handleConfirm}>Continue</button>
        </div>
      </section>
    );
  }

  const selectedPrefix = (option: 'existing' | 'new' | 'oauth') => selectedOption === option ? color('success', theme)('> ') : '  ';

  return (
    <>
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Install GitHub App</Text>
          <Text dimColor>Choose API key</Text>
        </Box>
        {existingApiKey ? (
          <Box marginBottom={1}>
            <Text>{selectedPrefix('existing')}Use your existing Claude Code API key</Text>
          </Box>
        ) : null}
        {onCreateOAuthToken ? (
          <Box marginBottom={1}>
            <Text>{selectedPrefix('oauth')}Create a long-lived token with your Claude subscription</Text>
          </Box>
        ) : null}
        <Box marginBottom={1}>
          <Text>{selectedPrefix('new')}Enter a new API key</Text>
        </Box>
        {selectedOption === 'new' ? (
          <TextInput
            value={apiKeyOrOAuthToken}
            onChange={onApiKeyChange}
            onSubmit={onSubmit}
            onPaste={onApiKeyChange}
            focus
            placeholder="sk-ant… (Create a new key at https://platform.claude.com/settings/keys)"
            mask="*"
            columns={terminalSize.columns}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            showCursor
          />
        ) : null}
      </Box>
      <Box marginLeft={3}>
        <Text dimColor>↑/↓ to select · Enter to continue</Text>
      </Box>
    </>
  );
}
