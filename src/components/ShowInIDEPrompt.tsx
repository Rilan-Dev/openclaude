import { basename, relative } from 'path';
import React from 'react';
import { Box, Text } from '../ink.js';
import { getCwd } from '../utils/cwd.js';
import { isSupportedVSCodeTerminal } from '../utils/ide.js';
import { isBrowserRuntime } from '../utils/runtime.js';
import { Select } from './CustomSelect/index.js';
import { Pane } from './design-system/Pane.js';
import type { PermissionOption, PermissionOptionWithLabel } from './permissions/FilePermissionDialog/permissionOptions.js';
type Props<A> = {
  filePath: string;
  input: A;
  onChange: (option: PermissionOption, args: A, feedback?: string) => void;
  options: PermissionOptionWithLabel[];
  ideName: string;
  symlinkTarget?: string | null;
  rejectFeedback: string;
  acceptFeedback: string;
  setFocusedOption: (value: string) => void;
  onInputModeToggle: (value: string) => void;
  focusedOption: string;
  yesInputMode: boolean;
  noInputMode: boolean;
};
export function ShowInIDEPrompt<A>({
  onChange,
  options,
  input,
  filePath,
  ideName,
  symlinkTarget,
  rejectFeedback,
  acceptFeedback,
  setFocusedOption,
  onInputModeToggle,
  focusedOption,
  yesInputMode,
  noInputMode,
}: Props<A>): React.ReactNode {
  const fileName = basename(filePath);
  const symlinkWarning = symlinkTarget
    ? relative(getCwd(), symlinkTarget).startsWith('..')
      ? `This will modify ${symlinkTarget} outside the working directory through a symlink.`
      : `Symlink target: ${symlinkTarget}`
    : null;
  const saveHint = isSupportedVSCodeTerminal() ? 'Save file to continue.' : null;

  const selectOption = (value: string) => {
    const selected = options.find(opt => opt.value === value);
    if (!selected) {
      return;
    }
    if (selected.option.type === 'reject') {
      const trimmedFeedback = selected.option.withReason || noInputMode ? rejectFeedback.trim() : '';
      if (selected.option.withReason && !trimmedFeedback) {
        return;
      }
      onChange(selected.option, input, trimmedFeedback || undefined);
      return;
    }
    if (selected.option.type === 'accept-once') {
      const trimmedFeedback = acceptFeedback.trim();
      onChange(selected.option, input, trimmedFeedback || undefined);
      return;
    }
    onChange(selected.option, input);
  };

  const reject = () => onChange({ type: 'reject' }, input);

  if (isBrowserRuntime()) {
    return (
      <div className="repl-webPermissionCard repl-webPermissionCard--ide" role="dialog" aria-modal="true" aria-label="IDE edit review">
        <div className="repl-webPermissionHalo" />
        <div className="repl-webPermissionHeader">
          <div>
            <div className="repl-webPermissionKicker">IDE review</div>
            <h2>Opened changes in {ideName}</h2>
            <p>Review the diff for {fileName}, then choose how to continue.</p>
          </div>
          <span className="repl-webPermissionBadge">Review</span>
        </div>
        <div className="repl-webPermissionBody">
          <div className="repl-webPermissionTarget">
            <span className="repl-webPermissionTargetLabel">File</span>
            <strong>{filePath}</strong>
            {symlinkWarning ? <small>{symlinkWarning}</small> : null}
            {saveHint ? <small>{saveHint}</small> : null}
          </div>
          <p className="repl-webPermissionQuestion">Do you want to make this edit?</p>
          <div className="repl-webPermissionActions">
            {options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                className="repl-webPermissionAction"
                data-primary={index === 0 ? 'true' : undefined}
                onClick={() => selectOption(option.value)}
                onMouseEnter={() => setFocusedOption(option.value)}
                onFocus={() => setFocusedOption(option.value)}
                onDoubleClick={() => onInputModeToggle(option.value)}
              >
                <span>{option.label}</span>
                {option.description ? <small>{option.description}</small> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="repl-webPermissionFooter">
          <button type="button" onClick={reject}>Cancel request</button>
          <span>Approve the IDE diff only after reviewing the changes.</span>
        </div>
      </div>
    );
  }

  const showTabHint = (focusedOption === 'yes' && !yesInputMode) || (focusedOption === 'no' && !noInputMode);

  return (
    <Pane color="permission">
      <Box flexDirection="column" gap={1}>
        <Text bold={true} color="permission">Opened changes in {ideName} ⧉</Text>
        {symlinkWarning ? <Text color="warning">{symlinkWarning}</Text> : null}
        {saveHint ? <Text dimColor={true}>{saveHint}</Text> : null}
        <Box flexDirection="column">
          <Text>Do you want to make this edit to <Text bold={true}>{fileName}</Text>?</Text>
          <Select
            options={options}
            inlineDescriptions={true}
            onChange={selectOption}
            onCancel={reject}
            onFocus={value => setFocusedOption(value)}
            onInputModeToggle={onInputModeToggle}
            onEmptyInputSubmit={value => {
              if (value !== 'no-with-reason') {
                reject();
              }
            }}
          />
        </Box>
        <Box marginTop={1}>
          <Text dimColor={true}>Esc to cancel{showTabHint ? ' · Tab to amend' : ''}</Text>
        </Box>
      </Box>
    </Pane>
  );
}
