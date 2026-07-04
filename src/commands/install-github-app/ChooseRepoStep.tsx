import React, { useState } from 'react';
import TextInput from '../../components/TextInput.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { Box, Text } from '../../ink.js';
import { useKeybindings } from '../../keybindings/useKeybinding.js';
import { isBrowserRuntime } from '../../utils/runtime.js';

interface ChooseRepoStepProps {
  currentRepo: string | null;
  useCurrentRepo: boolean;
  repoUrl: string;
  onRepoUrlChange: (value: string) => void;
  onToggleUseCurrentRepo: (useCurrentRepo: boolean) => void;
  onSubmit: () => void;
}

export function ChooseRepoStep({
  currentRepo,
  useCurrentRepo,
  repoUrl,
  onRepoUrlChange,
  onSubmit,
  onToggleUseCurrentRepo,
}: ChooseRepoStepProps): React.ReactNode {
  const [cursorOffset, setCursorOffset] = useState(0);
  const [showEmptyError, setShowEmptyError] = useState(false);
  const terminalSize = useTerminalSize();
  const isTextInputVisible = !useCurrentRepo || !currentRepo;

  const handleSubmit = () => {
    const repoName = useCurrentRepo ? currentRepo : repoUrl;
    if (!repoName?.trim()) {
      setShowEmptyError(true);
      return;
    }
    onSubmit();
  };

  const handlePrevious = () => {
    onToggleUseCurrentRepo(true);
    setShowEmptyError(false);
  };

  const handleNext = () => {
    onToggleUseCurrentRepo(false);
    setShowEmptyError(false);
  };

  useKeybindings(
    {
      'confirm:previous': handlePrevious,
      'confirm:next': handleNext,
      'confirm:yes': handleSubmit,
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

  if (isBrowserRuntime()) {
    return (
      <section className="repl-webPicker repl-githubAppSurface">
        <div className="repl-webPickerHeader">
          <span className="repl-webPickerKicker">GitHub App</span>
          <h2>Select repository</h2>
          <p>Choose the repository where OpenClaude should install the workflow.</p>
        </div>
        <div className="repl-webPickerList">
          {currentRepo ? (
            <button type="button" className="repl-webPickerOption" data-focused={useCurrentRepo ? 'true' : undefined} data-selected={useCurrentRepo ? 'true' : undefined} onClick={handlePrevious}>
              <span className="repl-webPickerOptionMark">CUR</span>
              <span className="repl-webPickerOptionCopy">
                <span className="repl-webPickerOptionTitle">Use current repository</span>
                <span className="repl-webPickerOptionDescription">{currentRepo}</span>
              </span>
            </button>
          ) : null}
          <button type="button" className="repl-webPickerOption" data-focused={!useCurrentRepo || !currentRepo ? 'true' : undefined} data-selected={!useCurrentRepo || !currentRepo ? 'true' : undefined} onClick={handleNext}>
            <span className="repl-webPickerOptionMark">URL</span>
            <span className="repl-webPickerOptionCopy">
              <span className="repl-webPickerOptionTitle">{currentRepo ? 'Enter a different repository' : 'Enter repository'}</span>
              <span className="repl-webPickerOptionDescription">Use owner/repo or a GitHub repository URL.</span>
            </span>
          </button>
        </div>
        {isTextInputVisible ? (
          <label className="repl-githubAppField">
            <span>Repository</span>
            <input value={repoUrl} onChange={event => {
              onRepoUrlChange(event.currentTarget.value);
              setShowEmptyError(false);
            }} placeholder="owner/repo or https://github.com/owner/repo" autoFocus />
          </label>
        ) : null}
        {showEmptyError ? <div className="repl-webPickerNotice repl-pluginError">Please enter a repository name to continue.</div> : null}
        <div className="repl-webPickerFooter">
          <button type="button" className="repl-webPickerGhostButton" onClick={handleSubmit}>Continue</button>
        </div>
      </section>
    );
  }

  return (
    <>
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Install GitHub App</Text>
          <Text dimColor>Select GitHub repository</Text>
        </Box>
        {currentRepo ? (
          <Box marginBottom={1}>
            <Text bold={useCurrentRepo} color={useCurrentRepo ? 'permission' : undefined}>
              {useCurrentRepo ? '> ' : '  '}Use current repository: {currentRepo}
            </Text>
          </Box>
        ) : null}
        <Box marginBottom={1}>
          <Text bold={isTextInputVisible} color={isTextInputVisible ? 'permission' : undefined}>
            {isTextInputVisible ? '> ' : '  '}{currentRepo ? 'Enter a different repository' : 'Enter repository'}
          </Text>
        </Box>
        {isTextInputVisible ? (
          <Box marginLeft={2} marginBottom={1}>
            <TextInput
              value={repoUrl}
              onChange={value => {
                onRepoUrlChange(value);
                setShowEmptyError(false);
              }}
              onSubmit={handleSubmit}
              focus
              placeholder="Enter a repo as owner/repo or https://github.com/owner/repo…"
              columns={terminalSize.columns}
              cursorOffset={cursorOffset}
              onChangeCursorOffset={setCursorOffset}
              showCursor
            />
          </Box>
        ) : null}
      </Box>
      {showEmptyError ? (
        <Box marginLeft={3} marginBottom={1}>
          <Text color="error">Please enter a repository name to continue</Text>
        </Box>
      ) : null}
      <Box marginLeft={3}>
        <Text dimColor>{currentRepo ? '↑/↓ to select · ' : ''}Enter to continue</Text>
      </Box>
    </>
  );
}
