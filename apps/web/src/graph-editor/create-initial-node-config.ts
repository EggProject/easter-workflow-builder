/* eslint-disable unicorn/no-null -- a séma nullázható mezői a dróton ténylegesen `null` értéket hordoznak, nem `undefined`-et (SPEC-005 protokoll alak) */
import type { NodeConfig } from '@easter-workflow-builder/protocol';
import { DEFAULT_AGENT_STEP_SETTINGS } from '../node-inspector/default-agent-step-settings.ts';
import type { AddableNodeType } from './addable-node-type.ts';

/**
 * A felvett csomópont kezdő `config` értéke a típus szerinti "üres" alak
 * (SPEC-008 5.8 táblázata). Az `onUnhandledError` mindenhol `null`, a
 * kötelező szöveg mezők üresek, és a mentés ezeket a mező alatt jelzi (O-21,
 * O-29, O-33). A két kötelező, alapérték nélküli szám mező üres jelölése a
 * `NaN` (`nullable-number-field-value.ts` szabálya). A `join` módja üresen
 * indul (`mode: null`, `settings` mező nélkül, O-33).
 *
 * Kimerítő `switch` a kilenc felvehető típusra, alapértelmezett ág nélkül: egy
 * új `NodeType` fordítási hibát ad itt.
 */
export function createInitialNodeConfig(type: AddableNodeType): NodeConfig {
  switch (type) {
    case 'agent_step': {
      return { ...DEFAULT_AGENT_STEP_SETTINGS, type: 'agent_step', onUnhandledError: null };
    }
    case 'branch': {
      return { type: 'branch', expression: '', branches: [], defaultBranchKey: null, onUnhandledError: null };
    }
    case 'fan_out': {
      return { type: 'fan_out', itemsExpression: '', branchLabelTemplate: '', onUnhandledError: null };
    }
    case 'join': {
      return { type: 'join', mode: null, onUnhandledError: null };
    }
    case 'loop': {
      return { type: 'loop', maxIterations: NaN, continueExpression: '', onUnhandledError: null };
    }
    case 'human_approval': {
      return { type: 'human_approval', title: '', bodyTemplate: '', timeoutMs: null, onUnhandledError: null };
    }
    case 'error_handler': {
      return {
        type: 'error_handler',
        maxAttempts: NaN,
        backoffMs: [],
        handledErrorKinds: [],
        onUnhandledError: null,
      };
    }
    case 'sub_workflow': {
      return { type: 'sub_workflow', targetWorkflowId: '', inputMapping: {}, onUnhandledError: null };
    }
    case 'script': {
      return { type: 'script', source: '', runtime: 'expression', onUnhandledError: null };
    }
  }
}
