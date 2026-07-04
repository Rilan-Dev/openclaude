import React from 'react';
import { Box, Text } from '../../ink.js';
import { isBrowserRuntime } from '../../utils/runtime.js';

type SuccessStepProps = {
  secretExists: boolean;
  useExistingSecret: boolean;
  secretName: string;
  skipWorkflow?: boolean;
};

export function SuccessStep({
  secretExists,
  useExistingSecret,
  secretName,
  skipWorkflow = false,
}: SuccessStepProps): React.ReactNode {
  const steps = skipWorkflow
    ? [
        "Install the Claude GitHub App if you haven't already",
        'Your workflow file was kept unchanged',
        'API key is configured and ready to use',
      ]
    : [
        'A pre-filled PR page has been created',
        "Install the Claude GitHub App if you haven't already",
        'Merge the PR to enable Claude PR assistance',
      ];

  if (isBrowserRuntime()) {
    return (
      <section className="repl-webPicker repl-githubAppSurface">
        <div className="repl-webPickerHeader">
          <span className="repl-webPickerKicker">GitHub App</span>
          <h2>Setup complete</h2>
          <p>Claude GitHub assistance is ready for the selected repository.</p>
        </div>
        <div className="repl-pluginMetaGrid">
          {!skipWorkflow ? <span>Workflow <strong>Created</strong></span> : <span>Workflow <strong>Unchanged</strong></span>}
          <span>Secret <strong>{secretExists && useExistingSecret ? 'Existing key' : secretName}</strong></span>
        </div>
        <div className="repl-pluginCompactList">
          {steps.map((step, index) => <span key={index}>{index + 1}. {step}</span>)}
        </div>
      </section>
    );
  }

  return (
    <>
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Install GitHub App</Text>
          <Text dimColor>Success</Text>
        </Box>
        {!skipWorkflow ? <Text color="success">✓ GitHub Actions workflow created!</Text> : null}
        {secretExists && useExistingSecret ? (
          <Box marginTop={1}>
            <Text color="success">✓ Using existing ANTHROPIC_API_KEY secret</Text>
          </Box>
        ) : null}
        {(!secretExists || !useExistingSecret) ? (
          <Box marginTop={1}>
            <Text color="success">✓ API key saved as {secretName} secret</Text>
          </Box>
        ) : null}
        <Box marginTop={1}>
          <Text>Next steps:</Text>
        </Box>
        {steps.map((step, index) => <Text key={step}>{index + 1}. {step}</Text>)}
      </Box>
      <Box marginLeft={3}>
        <Text dimColor>Press any key to exit</Text>
      </Box>
    </>
  );
}
