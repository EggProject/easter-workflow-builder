import { NodeConfigSchema, type NodeConfig, type WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { FieldErrorVisibilityContext } from '@easter-workflow-builder/ui';
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
import { FieldErrorsContext } from './field-errors-context.ts';
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
  /**
   * Megkísérelték-e már beküldeni (menteni) a gráfot úgy, hogy a beküldés
   * hiba miatt nem sikerült. Ilyenkor minden érvénytelen mező kiírja a
   * hibáját, akkor is, ha a felhasználó hozzá sem nyúlt - enélkül csak az
   * ÉRINTETT, érvénytelen mezők jeleznek. A tényt a beküldést ismerő
   * fogyasztó (`GraphEditorScreen`) adja meg. KÖTELEZŐ mező, nincs
   * alapértéke: az EGYETLEN production fogyasztó (`GraphEditorScreen`)
   * mindig explicit értéket ad át, tehát egy opcionális + `false`
   * alapértékű mező garantáltan sosem futna a default ágon e2e-vel - ez a
   * `.claude/CLAUDE.md` 5. szekciójának "nincs garantáltan sosem futó ág"
   * szabályát sértette volna (2026-09-09-i e2e lefedettségi mérés találta).
   */
  readonly isSaveAttempted: boolean;
}

/**
 * Érvényes `config` esetén ez a térkép megy le a kontextuson. Modul szintű
 * konstans, hogy a hivatkozás két render között azonos maradjon, tehát a
 * `FieldErrorsContext` fogyasztói ne renderelődjenek újra feleslegesen.
 */
const NO_FIELD_ERRORS: ReadonlyMap<string, string> = new Map<string, string>();

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
          fieldPathPrefix=""
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
 * ELRENDEZÉS: a panel dokkolt sáv, nem lebegő doboz - a fogyasztó
 * (`GraphEditorScreen`) egy `Resizable` osztott elrendezés jobb paneljébe
 * teszi, tehát a vászon mellette szűkül, és a sáv szélessége húzható
 * (SPEC-008 5.5). A panel `<aside>` elem, saját hozzáférhető névvel, tehát
 * a képernyőolvasó kiegészítő területként (`complementary`) találja meg. A
 * fejléc bezáró gombja a design system panel bezáró vezérlője
 * (`.node-inspector__close`, a Drawer `.drawer__close` szabályaival), aminek
 * a hozzáférhető nevét `aria-label` adja, mert nincs látható szövege.
 *
 * A HIBAJELZÉS EGY SZINTŰ: a hibaüzenet KIZÁRÓLAG a hibás mező ALATT áll,
 * `aria-invalid` és `aria-describedby` kötéssel, és csak akkor, ha a mező
 * ÉRINTETT és érvénytelen, VAGY ha a mentést már megkísérelték és a mező
 * érvénytelen (`packages/ui` `field-error-visibility` téma). A panel
 * tetején álló összesítő MEGSZŰNT (felhasználói kérés, 2026-09-09). A
 * mezőkhöz a `FieldErrorsContext` viszi le a térképet, hogy a tíz típus
 * szerinti komponens szignatúrája ne hízzon egy csak áttovábbított proppal.
 */
export function NodeInspector(properties: Readonly<NodeInspectorProperties>): ReactElement {
  const { node, onChange, onClose, inheritedProviderDescription, isSaveAttempted } = properties;
  const catalogEntry = GRAPH_NODE_CATALOG[node.type];
  const parsedConfig = NodeConfigSchema.safeParse(node.config);
  const fieldErrors = parsedConfig.success ? NO_FIELD_ERRORS : fieldErrorsFromZodError(parsedConfig.error);

  function handleConfigChange(nextConfig: NodeConfig): void {
    onChange({ ...node, config: nextConfig });
  }

  return (
    <aside className="node-inspector" aria-label={`${catalogEntry.label} beállításai`}>
      <div className="node-inspector__header">
        <div className="node-inspector__identity">
          <h2 className="node-inspector__title">{catalogEntry.label}</h2>
          <p className="node-inspector__node-id">{node.id}</p>
        </div>
        {/* A design system a panel bezáró X-ét NEM a `.btn` gomb valamelyik
            variánsával oldja meg: a Drawer és a Modal komponensnek is saját,
            nevesített bezáró vezérlője van (`.drawer__close`,
            `.modal__close`), mert a `.btn--ghost` szövegszíne az arany
            `--ep-accent-fg`, tehát a bezárás elsődleges akciónak látszana. A
            szabályok a `node-inspector.css` `.node-inspector__close`
            blokkjában állnak, a forrás indoklásával együtt. */}
        <button type="button" className="node-inspector__close" aria-label="Bezárás" onClick={onClose}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      <div className="node-inspector__body">
        <FieldErrorVisibilityContext.Provider value={isSaveAttempted}>
          <FieldErrorsContext.Provider value={fieldErrors}>
            {renderConfigFields(node.config, handleConfigChange, inheritedProviderDescription)}
          </FieldErrorsContext.Provider>
        </FieldErrorVisibilityContext.Provider>
      </div>
    </aside>
  );
}
