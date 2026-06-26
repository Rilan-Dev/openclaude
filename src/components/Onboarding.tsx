import { c as _c } from "react-compiler-runtime";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import { setupTerminal, shouldOfferTerminalSetup } from '../commands/terminalSetup/terminalSetup.js';
import { PRODUCT_DISPLAY_NAME } from '../constants/product.js';
import { useExitOnCtrlCDWithKeybindings } from '../hooks/useExitOnCtrlCDWithKeybindings.js';
import { Box, Newline, Text, useTheme } from '../ink.js';
import { useKeybindings } from '../keybindings/useKeybinding.js';
import { isAnthropicAuthEnabled } from '../utils/auth.js';
import { normalizeApiKeyForConfig } from '../utils/authPortable.js';
import { getCustomApiKeyStatus, getGlobalConfig, saveGlobalConfig } from '../utils/config.js';
import { env } from '../utils/env.js';
import { isRunningOnHomespace } from '../utils/envUtils.js';
import { isBrowserRuntime } from '../utils/imports.js';
import { PreflightStep } from '../utils/preflightChecks.js';
import type { ThemeSetting } from '../utils/theme.js';
import { ApproveApiKey } from './ApproveApiKey.js';
import { ConsoleOAuthFlow } from './ConsoleOAuthFlow.js';
import { Select } from './CustomSelect/select.js';
import { WelcomeV2 } from './LogoV2/WelcomeV2.js';
import { PressEnterToContinue } from './PressEnterToContinue.js';
import { ThemePicker } from './ThemePicker.js';
import { OrderedList } from './ui/OrderedList.js';
type StepId = 'preflight' | 'theme' | 'oauth' | 'api-key' | 'security' | 'terminal-setup';
interface OnboardingStep {
  id: StepId;
  component: React.ReactNode;
}
type Props = {
  onDone(): void;
};
function BrowserOnboarding({
  onDone
}: Props): React.ReactNode {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState<ThemeSetting>(() => getGlobalConfig().theme);
  const [apiKeyNeedingApproval] = useMemo(() => {
    if (!process.env.ANTHROPIC_API_KEY || isRunningOnHomespace() || !isAnthropicAuthEnabled()) {
      return '';
    }
    const customApiKeyTruncated = normalizeApiKeyForConfig(process.env.ANTHROPIC_API_KEY);
    if (getCustomApiKeyStatus(customApiKeyTruncated) === 'new') {
      return customApiKeyTruncated;
    }
    return '';
  }, []);
  useEffect(() => {
    logEvent('tengu_began_setup', {
      oauthEnabled: false,
    });
  }, []);
  const steps = useMemo<ReadonlyArray<'theme' | 'api-key' | 'security'>>(
    () => ['theme', ...(apiKeyNeedingApproval ? ['api-key' as const] : []), 'security'],
    [apiKeyNeedingApproval],
  );
  const currentStep = steps[currentStepIndex] ?? 'theme';

  useEffect(() => {
    logEvent('tengu_onboarding_step', {
      oauthEnabled: false,
      stepId: currentStep as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    });
  }, [currentStep]);

  function goToNextStep() {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      return;
    }
    saveGlobalConfig(current => ({
      ...current,
      hasCompletedOnboarding: true,
      lastOnboardingVersion: MACRO.VERSION,
    }));
    onDone();
  }

  function handleThemeSelection(newTheme: ThemeSetting) {
    saveGlobalConfig(current => ({
      ...current,
      theme: newTheme,
    }));
    setSelectedTheme(newTheme);
    goToNextStep();
  }

  function handleApiKeyDecision(approved: boolean) {
    if (apiKeyNeedingApproval) {
      saveGlobalConfig(current => ({
        ...current,
        customApiKeyResponses: {
          ...current.customApiKeyResponses,
          ...(approved
            ? {
                approved: [...(current.customApiKeyResponses?.approved ?? []), apiKeyNeedingApproval],
              }
            : {
                rejected: [...(current.customApiKeyResponses?.rejected ?? []), apiKeyNeedingApproval],
              }),
        },
      }));
    }
    goToNextStep();
  }

  const themeOptions: Array<{ label: string; value: ThemeSetting }> = [
    { label: 'Dark mode', value: 'dark' },
    { label: 'Light mode', value: 'light' },
    { label: 'Dark mode (colorblind-friendly)', value: 'dark-daltonized' },
    { label: 'Light mode (colorblind-friendly)', value: 'light-daltonized' },
    { label: 'Dark mode (ANSI colors only)', value: 'dark-ansi' },
    { label: 'Light mode (ANSI colors only)', value: 'light-ansi' },
  ]

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '1.5rem',
        color: '#f3eadc',
        background:
          'radial-gradient(circle at top left, rgba(65, 89, 141, 0.22), transparent 34rem), linear-gradient(135deg, #0b1117 0%, #11181f 44%, #16110d 100%)',
        fontFamily: '"IBM Plex Sans", "Aptos", "Segoe UI", sans-serif',
      }}
    >
      <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
        <WelcomeV2 themeOverride={selectedTheme} />
        <div
          style={{
            marginTop: '1rem',
            border: '1px solid rgba(243, 234, 220, 0.12)',
            borderRadius: '1.25rem',
            padding: '1.25rem',
            background: 'rgba(7, 11, 14, 0.72)',
            boxShadow: '0 1.5rem 4rem rgba(0, 0, 0, 0.34)',
            backdropFilter: 'blur(18px)',
          }}
        >
          {currentStep === 'theme' ? (
            <section>
              <div style={{ color: 'rgba(243, 234, 220, 0.62)', fontSize: '0.82rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Theme
              </div>
              <h2 style={{ margin: '0.5rem 0 0.35rem', fontSize: '1.5rem' }}>Choose the text style that looks best with your browser shell</h2>
              <p style={{ margin: 0, color: 'rgba(243, 234, 220, 0.72)', lineHeight: 1.55 }}>
                The browser keeps the same model loop and REPL flow. This step only changes how the UI is painted.
              </p>
              <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', marginTop: '1rem' }}>
                {themeOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleThemeSelection(option.value)}
                    style={{
                      border: option.value === selectedTheme ? '1px solid rgba(239, 184, 90, 0.7)' : '1px solid rgba(243, 234, 220, 0.12)',
                      borderRadius: '1rem',
                      padding: '0.9rem 1rem',
                      textAlign: 'left',
                      color: '#f3eadc',
                      background:
                        option.value === selectedTheme
                          ? 'linear-gradient(135deg, rgba(239, 184, 90, 0.22), rgba(239, 184, 90, 0.08))'
                          : 'rgba(255, 255, 255, 0.04)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{option.label}</div>
                    <div style={{ marginTop: '0.35rem', color: 'rgba(243, 234, 220, 0.64)', fontSize: '0.85rem' }}>
                      {option.value === selectedTheme ? 'Selected' : 'Apply this theme'}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : currentStep === 'api-key' ? (
            <section>
              <div style={{ color: 'rgba(243, 234, 220, 0.62)', fontSize: '0.82rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                API key
              </div>
              <h2 style={{ margin: '0.5rem 0 0.35rem', fontSize: '1.5rem' }}>Detected a custom API key in your environment</h2>
              <p style={{ margin: 0, color: 'rgba(243, 234, 220, 0.72)', lineHeight: 1.55 }}>
                <strong>ANTHROPIC_API_KEY</strong>: sk-ant-...{apiKeyNeedingApproval}
              </p>
              <p style={{ margin: '0.85rem 0 0', color: 'rgba(243, 234, 220, 0.68)' }}>Do you want to use this API key?</p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => handleApiKeyDecision(true)} style={{ border: 0, borderRadius: '0.9rem', padding: '0.7rem 1rem', background: 'linear-gradient(135deg, #ffd37b, #e79a32)', color: '#1b1206', fontWeight: 800, cursor: 'pointer' }}>
                  Yes
                </button>
                <button type="button" onClick={() => handleApiKeyDecision(false)} style={{ border: '1px solid rgba(243, 234, 220, 0.16)', borderRadius: '0.9rem', padding: '0.7rem 1rem', background: 'rgba(255, 255, 255, 0.04)', color: '#f3eadc', fontWeight: 700, cursor: 'pointer' }}>
                  No
                </button>
              </div>
            </section>
          ) : (
            <section>
              <div style={{ color: 'rgba(243, 234, 220, 0.62)', fontSize: '0.82rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Security
              </div>
              <h2 style={{ margin: '0.5rem 0 0.35rem', fontSize: '1.5rem' }}>Security notes</h2>
              <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.2rem', color: 'rgba(243, 234, 220, 0.76)', lineHeight: 1.65 }}>
                <li>{PRODUCT_DISPLAY_NAME} can make mistakes. Review responses before running code.</li>
                <li>Repository files and tool output can contain prompt injection attempts. Only use it with code you trust.</li>
              </ul>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={goToNextStep} style={{ border: 0, borderRadius: '0.9rem', padding: '0.8rem 1.15rem', background: 'linear-gradient(135deg, #ffd37b, #e79a32)', color: '#1b1206', fontWeight: 800, cursor: 'pointer' }}>
                  Start using OpenClaude
                </button>
                <span style={{ color: 'rgba(243, 234, 220, 0.52)', fontSize: '0.85rem' }}>
                  This browser shell keeps the same session state and streaming path as the terminal REPL.
                </span>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
export function Onboarding({
  onDone
}: Props): React.ReactNode {
  if (isBrowserRuntime()) {
    return <BrowserOnboarding onDone={onDone} />
  }
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [skipOAuth, setSkipOAuth] = useState(false);
  const [oauthEnabled] = useState(() => isAnthropicAuthEnabled());
  const [theme, setTheme] = useTheme();
  useEffect(() => {
    logEvent('tengu_began_setup', {
      oauthEnabled
    });
  }, [oauthEnabled]);
  function goToNextStep() {
    if (currentStepIndex < steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      logEvent('tengu_onboarding_step', {
        oauthEnabled,
        stepId: steps[nextIndex]?.id as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
    } else {
      onDone();
    }
  }
  function handleThemeSelection(newTheme: ThemeSetting) {
    setTheme(newTheme);
    goToNextStep();
  }
  const exitState = useExitOnCtrlCDWithKeybindings();

  // Define all onboarding steps
  const themeStep = <Box marginX={1}>
      <ThemePicker onThemeSelect={handleThemeSelection} showIntroText={true} helpText="To change this later, run /theme" hideEscToCancel={true} skipExitHandling={true} // Skip exit handling as Onboarding already handles it
    />
    </Box>;
  const securityStep = <Box flexDirection="column" gap={1} paddingLeft={1}>
      <Text bold>Security notes:</Text>
      <Box flexDirection="column" width={70}>
        {/**
         * OrderedList misnumbers items when rendering conditionally,
         * so put all items in the if/else
         */}
        <OrderedList>
          <OrderedList.Item>
            <Text>{PRODUCT_DISPLAY_NAME} can make mistakes</Text>
            <Text dimColor wrap="wrap">
              You should always review {PRODUCT_DISPLAY_NAME}&apos;s responses,
              especially when
              <Newline />
              running code.
              <Newline />
            </Text>
          </OrderedList.Item>
          <OrderedList.Item>
            <Text>
              Due to prompt injection risks, only use it with code you trust
            </Text>
            <Text dimColor wrap="wrap">
              Repository files and tool output can contain instructions that try
              to steer {PRODUCT_DISPLAY_NAME} toward unsafe tool use.
            </Text>
          </OrderedList.Item>
        </OrderedList>
      </Box>
      <PressEnterToContinue />
    </Box>;
  const preflightStep = <PreflightStep onSuccess={goToNextStep} />;
  // Create the steps array - determine which steps to include based on reAuth and oauthEnabled
  const apiKeyNeedingApproval = useMemo(() => {
    // Add API key step if needed
    // On homespace, ANTHROPIC_API_KEY is preserved in process.env for child
    // processes but ignored by Claude Code itself (see auth.ts).
    if (!process.env.ANTHROPIC_API_KEY || isRunningOnHomespace() || !isAnthropicAuthEnabled()) {
      return '';
    }
    const customApiKeyTruncated = normalizeApiKeyForConfig(process.env.ANTHROPIC_API_KEY);
    if (getCustomApiKeyStatus(customApiKeyTruncated) === 'new') {
      return customApiKeyTruncated;
    }
  }, []);
  function handleApiKeyDone(approved: boolean) {
    if (approved) {
      setSkipOAuth(true);
    }
    goToNextStep();
  }
  const steps: OnboardingStep[] = [];
  if (oauthEnabled) {
    steps.push({
      id: 'preflight',
      component: preflightStep
    });
  }
  steps.push({
    id: 'theme',
    component: themeStep
  });
  if (apiKeyNeedingApproval) {
    steps.push({
      id: 'api-key',
      component: <ApproveApiKey customApiKeyTruncated={apiKeyNeedingApproval} onDone={handleApiKeyDone} />
    });
  }
  if (oauthEnabled) {
    steps.push({
      id: 'oauth',
      component: <SkippableStep skip={skipOAuth} onSkip={goToNextStep}>
          <ConsoleOAuthFlow onDone={goToNextStep} />
        </SkippableStep>
    });
  }
  steps.push({
    id: 'security',
    component: securityStep
  });
  if (shouldOfferTerminalSetup()) {
    steps.push({
      id: 'terminal-setup',
      component: <Box flexDirection="column" gap={1} paddingLeft={1}>
          <Text bold>Use {PRODUCT_DISPLAY_NAME}&apos;s terminal setup?</Text>
          <Box flexDirection="column" width={70} gap={1}>
            <Text>
              For the optimal coding experience, enable the recommended settings
              <Newline />
              for your terminal:{' '}
              {env.terminal === 'Apple_Terminal' ? 'Option+Enter for newlines and visual bell' : 'Shift+Enter for newlines'}
            </Text>
            <Select options={[{
            label: 'Yes, use recommended settings',
            value: 'install'
          }, {
            label: 'No, maybe later with /terminal-setup',
            value: 'no'
          }]} onChange={value => {
            if (value === 'install') {
              // Errors already logged in setupTerminal, just swallow and proceed
              void setupTerminal(theme).catch(() => {}).finally(goToNextStep);
            } else {
              goToNextStep();
            }
          }} onCancel={() => goToNextStep()} />
            <Text dimColor>
              {exitState.pending ? <>Press {exitState.keyName} again to exit</> : <>Enter to confirm · Esc to skip</>}
            </Text>
          </Box>
        </Box>
    });
  }
  const currentStep = steps[currentStepIndex];

  // Handle Enter on security step and Escape on terminal-setup step
  // Dependencies match what goToNextStep uses internally
  const handleSecurityContinue = useCallback(() => {
    if (currentStepIndex === steps.length - 1) {
      onDone();
    } else {
      goToNextStep();
    }
  }, [currentStepIndex, steps.length, oauthEnabled, onDone]);
  const handleTerminalSetupSkip = useCallback(() => {
    goToNextStep();
  }, [currentStepIndex, steps.length, oauthEnabled, onDone]);
  useKeybindings({
    'confirm:yes': handleSecurityContinue
  }, {
    context: 'Confirmation',
    isActive: currentStep?.id === 'security'
  });
  useKeybindings({
    'confirm:no': handleTerminalSetupSkip
  }, {
    context: 'Confirmation',
    isActive: currentStep?.id === 'terminal-setup'
  });
  return <Box flexDirection="column">
      <WelcomeV2 />
      <Box flexDirection="column" marginTop={1}>
        {currentStep?.component}
        {exitState.pending && <Box padding={1}>
            <Text dimColor>Press {exitState.keyName} again to exit</Text>
          </Box>}
      </Box>
    </Box>;
}
export function SkippableStep(t0) {
  const $ = _c(4);
  const {
    skip,
    onSkip,
    children
  } = t0;
  let t1;
  let t2;
  if ($[0] !== onSkip || $[1] !== skip) {
    t1 = () => {
      if (skip) {
        onSkip();
      }
    };
    t2 = [skip, onSkip];
    $[0] = onSkip;
    $[1] = skip;
    $[2] = t1;
    $[3] = t2;
  } else {
    t1 = $[2];
    t2 = $[3];
  }
  useEffect(t1, t2);
  if (skip) {
    return null;
  }
  return children;
}
