import { NodeConfigSchema, type NodeConfig, type WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { Button } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import { GRAPH_NODE_CATALOG } from '../graph-node-catalog/graph-node-catalog.ts';
import { AgentStepConfigFields } from './AgentStepConfigFields.tsx';
import { BranchNodeFields } from './BranchNodeFields.tsx';
import { ErrorHandlerNodeFields } from './ErrorHandlerNodeFields.tsx';
import { FanOutNodeFields } from './FanOutNodeFields.tsx';
import { HumanApprovalNodeFields } from './HumanApprovalNodeFields.tsx';
import { JoinNodeFields } from './JoinNodeFields.tsx';
import { LoopNodeFields } from './LoopNodeFields.tsx';
import { ScriptNodeFields } from './ScriptNodeFields.tsx';
import { StartNodeFields } from './StartNodeFields.tsx';
import { SubWorkflowNodeFields } from './SubWorkflowNodeFields.tsx';
import { fieldErrorsFromZodError } from './field-errors-from-zod-error.ts';
import './node-inspector.css';

export interface NodeInspectorProperties {
  readonly node: WorkflowNodeInput;
  readonly onChange: (updatedNode: WorkflowNodeInput) => void;
  readonly onClose: () => void;
  /**
   * Az `agent_step` node és a `join` `ai_synthesis` módja `providerId`
   * mezőjéhez tartozó, örökölt provider leírás (AC17) - a `NodeInspector`
   * fogyasztója (`GraphEditorScreen`, T-009-17) számolja ki a workflow és a
   * globális beállítás alapján, ez a komponens csak továbbadja.
   */
  readonly inheritedProviderDescription: string;
}

function renderConfigFields(
  config: NodeConfig,
  onConfigChange: (nextConfig: NodeConfig) => void,
  inheritedProviderDescription: string,
): ReactElement {
  switch (config.type) {
    case 'start': {
      return <StartNodeFields config={config} onChange={onConfigChange} />;
    }
    case 'agent_step': {
      return (
        <AgentStepConfigFields
          config={config}
          inheritedProviderDescription={inheritedProviderDescription}
          onChange={(nextSettings) => {
            onConfigChange({ ...nextSettings, type: 'agent_step', onUnhandledError: config.onUnhandledError });
          }}
        />
      );
    }
    case 'branch': {
      return <BranchNodeFields config={config} onChange={onConfigChange} />;
    }
    case 'fan_out': {
      return <FanOutNodeFields config={config} onChange={onConfigChange} />;
    }
    case 'join': {
      return (
        <JoinNodeFields
          config={config}
          onChange={onConfigChange}
          inheritedProviderDescription={inheritedProviderDescription}
        />
      );
    }
    case 'loop': {
      return <LoopNodeFields config={config} onChange={onConfigChange} />;
    }
    case 'human_approval': {
      return <HumanApprovalNodeFields config={config} onChange={onConfigChange} />;
    }
    case 'error_handler': {
      return <ErrorHandlerNodeFields config={config} onChange={onConfigChange} />;
    }
    case 'sub_workflow': {
      return <SubWorkflowNodeFields config={config} onChange={onConfigChange} />;
    }
    case 'script': {
      return <ScriptNodeFields config={config} onChange={onConfigChange} />;
    }
  }
}

/**
 * A csomópont beállítás panel: a kiválasztott node `config` mezőjét
 * szerkeszti, a `protocol` `node-config` sémája felett (SPEC-008 5.1, 5.2,
 * AC16). A típusonkénti mezőket a `renderConfigFields` osztja szét - a
 * dispatch a `config.type` mezőn megy, ugyanúgy, mint a `GraphNodeCard`
 * saját, `branch`-ra szűkítő ága (a `node.type` és a `config.type` a
 * `WorkflowNodeInputSchema` szerint NEM kereszt-mező ellenőrzött, tehát a
 * fejléc címkéje a `node.type` katalógus bejegyzéséből jön, a mezők viszont
 * a ténylegesen tárolt `config.type`-ból, típusbiztosan).
 *
 * A mezőnkénti hiba egy összesített, útvonal szerinti listaként jelenik meg
 * a panel tetején (`fieldErrorsFromZodError`): minden bejegyzés megnevezi a
 * hibás mező útvonalát, nem csak egy kombinált mondatot ad.
 */
export function NodeInspector(properties: Readonly<NodeInspectorProperties>): ReactElement {
  const { node, onChange, onClose, inheritedProviderDescription } = properties;
  const catalogEntry = GRAPH_NODE_CATALOG[node.type];
  const parsedConfig = NodeConfigSchema.safeParse(node.config);
  const fieldErrors = parsedConfig.success ? undefined : fieldErrorsFromZodError(parsedConfig.error);

  function handleConfigChange(nextConfig: NodeConfig): void {
    onChange({ ...node, config: nextConfig });
  }

  return (
    <div className="node-inspector">
      <div className="node-inspector__header">
        <div>
          <p className="node-inspector__reason">{catalogEntry.label}</p>
          <p>{node.id}</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          Bezárás
        </Button>
      </div>
      {fieldErrors !== undefined && fieldErrors.size > 0 && (
        <ul role="alert" className="node-inspector__errors">
          {Array.from(fieldErrors, ([path, message]) => (
            <li key={path}>
              <b>{path === '' ? '(gyökér)' : path}</b>: {message}
            </li>
          ))}
        </ul>
      )}
      {renderConfigFields(node.config, handleConfigChange, inheritedProviderDescription)}
    </div>
  );
}
