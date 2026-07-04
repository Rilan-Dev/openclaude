import { relative } from 'path';
import React, { useMemo } from 'react';
import { useDiffInIDE } from '../../../hooks/useDiffInIDE.js';
import { Box, Text } from '../../../ink.js';
import type { ToolUseContext } from '../../../Tool.js';
import { getLanguageName } from '../../../utils/cliHighlight.js';
import { getCwd } from '../../../utils/cwd.js';
import { getFsImplementation, safeResolvePath } from '../../../utils/fsOperations.js';
import { expandPath } from '../../../utils/path.js';
import { isBrowserRuntime } from '../../../utils/runtime.js';
import type { CompletionType } from '../../../utils/unaryLogging.js';
import { Select } from '../../CustomSelect/index.js';
import { ShowInIDEPrompt } from '../../ShowInIDEPrompt.js';
import { usePermissionRequestLogging } from '../hooks.js';
import { PermissionScaffold } from '../PermissionScaffold.js';
import type { ToolUseConfirm } from '../PermissionRequest.js';
import type { WorkerBadgeProps } from '../WorkerBadge.js';
import { useDangerousModeConfirmation } from '../useDangerousModeConfirmation.js';
import type { IDEDiffSupport } from './ideDiffConfig.js';
import type { FileOperationType, PermissionOption } from './permissionOptions.js';
import { type ToolInput, useFilePermissionDialog } from './useFilePermissionDialog.js';
export type FilePermissionDialogProps<T extends ToolInput = ToolInput> = {
  // Required props from PermissionRequestProps
  toolUseConfirm: ToolUseConfirm;
  toolUseContext: ToolUseContext;
  onDone: () => void;
  onReject: () => void;

  // Dialog customization
  title: string;
  subtitle?: React.ReactNode;
  question?: string | React.ReactNode;
  content?: React.ReactNode; // Can be general content or diff component

  // Logging
  completionType?: CompletionType;
  languageName?: string; // override — derived from path when omitted

  // File/directory operations
  path: string | null;
  parseInput: (input: unknown) => T;
  operationType?: FileOperationType;

  // IDE diff support
  ideDiffSupport?: IDEDiffSupport<T>;

  // Worker badge for teammate permission requests
  workerBadge: WorkerBadgeProps | undefined;
};
export function FilePermissionDialog<T extends ToolInput = ToolInput>({
  toolUseConfirm,
  toolUseContext,
  onDone,
  onReject,
  title,
  subtitle,
  question = 'Do you want to proceed?',
  content,
  completionType = 'tool_use_single',
  path,
  parseInput,
  operationType = 'write',
  ideDiffSupport,
  workerBadge,
  languageName: languageNameOverride
}: FilePermissionDialogProps<T>): React.ReactNode {
  // Derive from path unless caller provided an explicit override (NotebookEdit
  // passes 'python'/'markdown' from cell_type). getLanguageName is async;
  // downstream UnaryEvent.language_name and logPermissionEvent already accept
  // Promise<string>. useMemo keeps the promise stable across renders.
  const languageName = useMemo(() => languageNameOverride ?? (path ? getLanguageName(path) : 'none'), [languageNameOverride, path]);
  const unaryEvent = useMemo(() => ({
    completion_type: completionType,
    language_name: languageName
  }), [completionType, languageName]);
  usePermissionRequestLogging(toolUseConfirm, unaryEvent);
  const symlinkTarget = useMemo(() => {
    if (!path || operationType === 'read') {
      return null;
    }
    const expandedPath = expandPath(path);
    const fs = getFsImplementation();
    const {
      resolvedPath,
      isSymlink
    } = safeResolvePath(fs, expandedPath);
    if (isSymlink) {
      return resolvedPath;
    }
    return null;
  }, [path, operationType]);
  const fileDialogResult = useFilePermissionDialog({
    filePath: path || '',
    completionType,
    languageName,
    toolUseConfirm,
    onDone,
    onReject,
    parseInput,
    operationType
  });

  // Use file dialog results for options
  const {
    options,
    acceptFeedback,
    rejectFeedback,
    setFocusedOption,
    handleInputModeToggle,
    focusedOption,
    yesInputMode,
    noInputMode
  } = fileDialogResult;

  // Parse input using the provided parser
  const parsedInput = parseInput(toolUseConfirm.input);

  // Set up IDE diff support if enabled. Memoized: getConfig may do disk I/O
  // (FileWrite's getConfig calls readFileSync for the old-content diff).
  // Keyed on the raw input — parseInput is a pure Zod parse whose result
  // depends only on toolUseConfirm.input.
  const ideDiffConfig = useMemo(() => ideDiffSupport ? ideDiffSupport.getConfig(parseInput(toolUseConfirm.input)) : null, [ideDiffSupport, toolUseConfirm.input]);

  // Create diff params based on whether IDE diff is available
  const diffParams = ideDiffConfig ? {
    onChange: (option: PermissionOption, input: {
      file_path: string;
      edits: Array<{
        old_string: string;
        new_string: string;
        replace_all?: boolean;
      }>;
    }) => {
      const transformedInput = ideDiffSupport!.applyChanges(parsedInput, input.edits);
      fileDialogResult.onChange(option, transformedInput);
    },
    toolUseContext,
    filePath: ideDiffConfig.filePath,
    edits: (ideDiffConfig.edits || []).map(e => ({
      old_string: e.old_string,
      new_string: e.new_string,
      replace_all: e.replace_all || false
    })),
    editMode: ideDiffConfig.editMode || 'single'
  } : {
    onChange: () => {},
    toolUseContext,
    filePath: '',
    edits: [],
    editMode: 'single' as const
  };
  const {
    closeTabInIDE,
    showingDiffInIDE,
    ideName
  } = useDiffInIDE(diffParams);
  const {
    confirmDangerousMode,
    dangerousModeDialog
  } = useDangerousModeConfirmation();
  const onChange = (option_0: PermissionOption, feedback?: string) => {
    closeTabInIDE?.();
    if (option_0.type === 'accept-full-access') {
      confirmDangerousMode('fullAccess', () => {
        fileDialogResult.onChange(option_0, parsedInput, feedback?.trim());
      });
      return;
    }
    fileDialogResult.onChange(option_0, parsedInput, feedback?.trim());
  };
  if (dangerousModeDialog) {
    return dangerousModeDialog;
  }
  if (showingDiffInIDE && ideDiffConfig && path) {
    return <ShowInIDEPrompt onChange={(option_1: PermissionOption, _input, feedback_0?: string) => onChange(option_1, feedback_0)} options={options} filePath={path} input={parsedInput} ideName={ideName} symlinkTarget={symlinkTarget} rejectFeedback={rejectFeedback} acceptFeedback={acceptFeedback} setFocusedOption={setFocusedOption} onInputModeToggle={handleInputModeToggle} focusedOption={focusedOption} yesInputMode={yesInputMode} noInputMode={noInputMode} />;
  }
  const isSymlinkOutsideCwd = symlinkTarget != null && relative(getCwd(), symlinkTarget).startsWith('..');
  const symlinkWarningText = symlinkTarget
    ? isSymlinkOutsideCwd
      ? `This will modify ${symlinkTarget} outside the working directory through a symlink.`
      : `Symlink target: ${symlinkTarget}`
    : null;
  const symlinkWarning = symlinkWarningText ? <Box paddingX={1} marginBottom={1}>
      <Text color="warning">
        {symlinkWarningText}
      </Text>
    </Box> : null;
  const handleOptionValue = (value: string) => {
    const selected = options.find(opt => opt.value === value);
    if (!selected) {
      return;
    }
    if (selected.option.type === 'reject') {
      const trimmedFeedback = selected.option.withReason || noInputMode ? rejectFeedback.trim() : '';
      if (selected.option.withReason && !trimmedFeedback) {
        return;
      }
      onChange(selected.option, trimmedFeedback || undefined);
      return;
    }
    if (selected.option.type === 'accept-once') {
      const trimmedFeedback = acceptFeedback.trim();
      onChange(selected.option, trimmedFeedback || undefined);
      return;
    }
    onChange(selected.option);
  };
  if (isBrowserRuntime()) {
    return (
      <div className="repl-webPermissionCard repl-webPermissionCard--file" role="dialog" aria-modal="true" aria-label={`${title} permission request`}>
        <div className="repl-webPermissionHalo" />
        <div className="repl-webPermissionHeader">
          <div>
            <div className="repl-webPermissionKicker">{operationType === 'read' ? 'file access' : 'file change'}</div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <span className="repl-webPermissionBadge">Review</span>
        </div>
        <div className="repl-webPermissionBody">
          {path ? (
            <div className="repl-webPermissionTarget">
              <span className="repl-webPermissionTargetLabel">{operationType === 'read' ? 'Read' : 'Path'}</span>
              <strong>{path}</strong>
              {symlinkWarningText ? <small>{symlinkWarningText}</small> : null}
            </div>
          ) : null}
          {content ? <div className="repl-webPermissionContent">{content}</div> : null}
          <p className="repl-webPermissionQuestion">{typeof question === 'string' ? question : 'Do you want to proceed?'}</p>
          <div className="repl-webPermissionActions">
            {options.map((option, index) => {
              const inputValue = option.value === 'yes' ? acceptFeedback : rejectFeedback
              return (
                <div key={option.value} className="repl-webPermissionActionWrap">
                  <button
                    type="button"
                    className="repl-webPermissionAction"
                    data-primary={index === 0 ? 'true' : undefined}
                    onClick={() => handleOptionValue(option.value)}
                    onMouseEnter={() => setFocusedOption(option.value)}
                    onFocus={() => setFocusedOption(option.value)}
                  >
                    <span>{option.label}</span>
                    {option.description ? <small>{option.description}</small> : null}
                  </button>
                  {option.type === 'input' ? (
                    <textarea
                      className="repl-webPermissionTextarea"
                      value={inputValue}
                      placeholder={option.placeholder}
                      rows={2}
                      onChange={event => option.onChange(event.currentTarget.value)}
                      onFocus={() => setFocusedOption(option.value)}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
        <div className="repl-webPermissionFooter">
          <button type="button" onClick={() => onChange({ type: 'reject' })}>Cancel request</button>
          <span>Approve once, approve with context, or reject before the tool runs.</span>
        </div>
      </div>
    );
  }
  return <>
      <PermissionScaffold title={title} subtitle={subtitle} innerPaddingX={0} workerBadge={workerBadge} permissionResult={toolUseConfirm.permissionResult} toolType={operationType === 'read' ? 'read' : 'edit'}>
        {symlinkWarning}
        {content}
        <Box flexDirection="column" paddingX={1}>
          {typeof question === 'string' ? <Text>{question}</Text> : question}
          <Select options={options} inlineDescriptions onChange={handleOptionValue} onCancel={() => onChange({
          type: 'reject'
        })} onFocus={value_0 => setFocusedOption(value_0)} onInputModeToggle={handleInputModeToggle} onEmptyInputSubmit={value_1 => {
          if (value_1 !== 'no-with-reason') {
            onChange({
              type: 'reject'
            });
          }
        }} />
        </Box>
      </PermissionScaffold>
      <Box paddingX={1} marginTop={1}>
        <Text dimColor>
          Esc to cancel
          {(focusedOption === 'yes' && !yesInputMode || focusedOption === 'no' && !noInputMode) && ' · Tab to amend'}
        </Text>
      </Box>
    </>;
}
