import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  ProviderIdSchema,
  ProviderSummarySchema,
  SettingsRecordSchema,
  StartedRunResponseSchema,
  WorkflowDetailSchema,
  WorkflowGraphDocumentSchema,
  type ProviderSummary,
  type StartedRunResponse,
  type WorkflowEdgeInput,
  type WorkflowGraphDocument,
  type WorkflowNodeInput,
} from '@easter-workflow-builder/protocol';
import {
  Alert,
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  PageFooter,
  Resizable,
  ResizableHandle,
  ResizablePanel,
  ToastViewport,
  Tooltip,
  joinClassNames,
  useToasts,
} from '@easter-workflow-builder/ui';
import { ReactFlowProvider, useStore, type ReactFlowState } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import type { ClientRouteId } from '../client-route/client-route-table.ts';
import { layoutGraph } from '../graph-auto-layout/layout-graph.ts';
import { SCRIPT_UNIMPLEMENTED_ERROR_CLASS } from '../graph-node-card/script-unimplemented-error-class.ts';
import type { UseClientRouteResult } from '../history-navigation/use-client-route.ts';
import { NodeInspector } from '../node-inspector/NodeInspector.tsx';
import { describeInheritedProvider } from '../node-inspector/describe-inherited-provider.ts';
import type { ProviderOptions } from '../node-inspector/provider-options.ts';
import { ProviderOptionsContext } from '../node-inspector/provider-options-context.ts';
import { SkillLibraryContext } from '../node-inspector/skill-library-context.ts';
import { createProviderConnectionTester } from '../provider-select/create-provider-connection-tester.ts';
import { arraySchema } from '../rest-client/array-schema.ts';
import { requestRoute } from '../rest-client/request-route.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import { StartRunModal } from '../run-control/StartRunModal.tsx';
import { readStartInputFields } from '../run-control/read-start-input-fields.ts';
import { useSkillLibrary } from '../skill-upload/use-skill-library.ts';
import { ThemedSkeleton } from '../themed-skeleton/ThemedSkeleton.tsx';
import type { AddNodeContextMenuProperties } from './AddNodeContextMenu.tsx';
import { GraphEditorCanvas } from './GraphEditorCanvas.tsx';
import type { EditorWorkflowName } from './editor-workflow-name.ts';
import { NavigationConfirmationModal } from './NavigationConfirmationModal.tsx';
import { ADDABLE_NODE_MENU_ITEMS } from './addable-node-menu-items.ts';
import { computeViewportCenterNodePosition } from './compute-viewport-center-node-position.ts';
import { createGraphNode } from './create-graph-node.ts';
import { deleteNodeWithEdges } from './delete-node-with-edges.ts';
import { formatUndoShortcutLabels } from './format-undo-shortcut-labels.ts';
import {
  canDiscardGraphEdits,
  closeGraphEditSession,
  discardGraphEdits,
  recordGraphEdit,
  redoGraphEdit,
  startGraphEditHistory,
  undoGraphEdit,
  type GraphEditHistory,
  type GraphEditSession,
} from './graph-edit-history.ts';
import { workflowEdgeToEdgeInput, workflowNodeToNodeInput } from './graph-editor-document-projection.ts';
import { readStoredLayoutSizes, storeLayoutSizes } from './graph-editor-layout.ts';
import type { GraphElementIdGenerator } from './graph-element-id-generator.ts';
import './graph-editor-screen.css';
import { hasScriptNode } from './has-script-node.ts';
import { isGraphDirty } from './is-graph-dirty.ts';
import { normalizeLoadedGraphDocument } from './normalize-loaded-graph-document.ts';
import { resolveUndoModifier, type UndoModifier } from './resolve-undo-modifier.ts';
import type { UndoShortcutAction } from './resolve-undo-shortcut.ts';
import { toEditorWorkflowName } from './to-editor-workflow-name.ts';
import { getBrowserLocalStorage, readUndoModifierPreference } from './undo-modifier-storage.ts';
import { useBeforeUnloadPrompt } from './use-before-unload-prompt.ts';
import { useIsFooterCompact } from './use-is-footer-compact.ts';
import { useUndoRedoShortcut } from './use-undo-redo-shortcut.ts';
import { validateGraphForSave } from './validate-graph-for-save.ts';

export interface GraphEditorScreenProperties {
  readonly apiOrigin: string;
  readonly fetchFunction: FetchFunction;
  /**
   * A jelenlegi query string, a kérdőjellel együtt vagy üres sztring
   * (`useClientRoute` `search` mezője) - a szerkesztett workflow azonosítója
   * ebből jön, `?workflowId=` alakban (SPEC-008 5.3, a SPEC-007 10.2
   * `?workflowId=` mintájára, paraméteres útvonal szegmens nélkül).
   */
  readonly search: string;
  /**
   * A futás indítása a szerkesztőből az ÚJ futás nézetére navigál (SPEC-008
   * 6.5, 9. szekció 5. async pont).
   */
  readonly navigate: (routeId: ClientRouteId, searchParameters?: string) => void;
  /**
   * A csomópont és az él azonosítóját adó port (SPEC-008 5.8, user döntés 8.):
   * az `app-shell` fecskendezi be a böngésző megvalósítást, a teszt
   * determinisztikus generátort ad, a `browserStreamIdGenerator` mintájára.
   */
  readonly graphElementIdGenerator: GraphElementIdGenerator;
  /**
   * A kliens útválasztó navigációs őrének regisztrálása (SPEC-008 5.10, 1.
   * pont): az `app-shell` adja tovább a `useClientRoute` eredményéből. A
   * képernyő mentetlen változásnál regisztrál, és az őr a megerősítő
   * modálist nyitja.
   */
  readonly registerNavigationGuard: UseClientRouteResult['registerNavigationGuard'];
  /**
   * A szerkesztett workflow nevének jelentése az `app-shell` morzsasorának
   * (SPEC-008 9. szekció 2. async pontja, user döntés 2026-10-21): a név a
   * morzsasor utolsó eleme, betöltés alatt `Skeleton`. A képernyő a
   * csatolásakor és minden változáskor jelent, a leszerelésekor pedig újra
   * `loading` értéket, hogy a következő megnyitás ne a régi nevet mutassa.
   */
  readonly onWorkflowNameChange: (name: EditorWorkflowName) => void;
}

/**
 * A megerősítésre váró navigáció: a `proceed` az őr megkerülésével hajtja
 * végre (SPEC-008 5.10, 1. pont).
 */
interface PendingNavigation {
  readonly proceed: () => void;
}

function readWorkflowId(search: string): string | undefined {
  return new URLSearchParams(search).get('workflowId') ?? undefined;
}

/**
 * A split button lenyíló nyíl ikonja - a design system `button-group.html`
 * "Mixed (split button)" mintájának SAJÁT SVG-je, kézzel beágyazva, a
 * repóban már meglévő ikon-konvenció szerint (ugyanaz a módszer, mint a
 * `workflow-list-screen.tsx` hárompontos ikonja, nem külön ikon csomag).
 */
function DropdownChevronIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m3 5 4 4 4-4" />
    </svg>
  );
}

/**
 * A vendorolt lucide 0.525.0 készlet `Plus` ikonja (24x24 viewBox), kézzel
 * beágyazva, a repó meglévő ikon konvenciója szerint (1.75 vonalvastagság,
 * kerekített vonalvég és csatlakozás). A szűk nézeti "Hozzáadás" gomb
 * egyetlen tartalma; a nevét az `aria-label` adja.
 */
function PlusIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

/**
 * A vendorolt lucide 0.525.0 készlet `Play` ikonja (M-118), a `PlusIcon`
 * konvenciója szerint. A szűk nézeti "Futás indítása" gomb egyetlen tartalma;
 * a nevét az `aria-label` adja.
 */
function PlayIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

/**
 * A vendorolt lucide 0.525.0 készlet `Undo2` ikonjának útvonal adata (M-118),
 * a `PlusIcon` konvenciója szerint. A Visszavonás gomb egyetlen tartalma; a
 * nevét az `aria-label` adja.
 */
function UndoIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
    </svg>
  );
}

/**
 * A vendorolt lucide 0.525.0 készlet `Redo2` ikonjának útvonal adata (M-118),
 * az `UndoIcon` párja.
 */
function RedoIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" />
    </svg>
  );
}

/**
 * A "Futás indítása" gomb tiltásának okát hordozó lábléc szöveg azonosítója
 * (`aria-describedby`, SPEC-008 14. kritérium).
 */
const SCRIPT_RUN_BLOCK_REASON_DOM_ID = 'graph-editor-script-run-block-reason';

/**
 * A betöltés előtti, üres szerkesztett dokumentum története. Modul szintű
 * konstans, hogy a kezdő állapot minden renderen ugyanaz az objektum legyen.
 */
const EMPTY_GRAPH_EDIT_HISTORY: GraphEditHistory = startGraphEditHistory({ nodes: [], edges: [] });

/**
 * A billentyű művelete a történet lépésére fordítva. Modul szintű függvény,
 * tehát a figyelőnek átadott hivatkozás stabil.
 */
function stepGraphEditHistory(action: UndoShortcutAction): (history: GraphEditHistory) => GraphEditHistory {
  return action === 'undo' ? undoGraphEdit : redoGraphEdit;
}

const selectViewportWidth = (state: ReactFlowState): number => state.width;
const selectViewportHeight = (state: ReactFlowState): number => state.height;
const selectViewportTransform = (state: ReactFlowState): ReactFlowState['transform'] => state.transform;

interface AddNodeMenuButtonProperties {
  readonly disabled: boolean;
  /**
   * Igaz a `--ep-screen-sm` tokenen és alatta: a gomb csak ikon.
   */
  readonly isCompact: boolean;
  readonly onAddNode: AddNodeContextMenuProperties['onAddNode'];
}

/**
 * A lábléc "Hozzáadás" menü gombja (SPEC-008 5.8, O-19): a `Menu`/`MenuItem`
 * pár a kilenc felvehető típussal, a split button nyíl ikonjával. Kompakt
 * alakban a gomb csak ikon (`.btn--icon`, `Plus`), a neve az `aria-label`
 * (user döntés 2026-10-14); a menü mindkét alakban ugyanaz. Az új kártya
 * közepe a választáskor látható vászon középpontja, a React Flow store
 * `width`, `height` és `transform` mezőjéből (`useStore`, M-99). Külön
 * komponens, hogy a store feliratkozás a nézet minden mozdulatára csak ezt a
 * gombot renderelje újra, ne a képernyőt.
 */
function AddNodeMenuButton(properties: Readonly<AddNodeMenuButtonProperties>): ReactElement {
  const { disabled, isCompact, onAddNode } = properties;
  const width = useStore(selectViewportWidth);
  const height = useStore(selectViewportHeight);
  const transform = useStore(selectViewportTransform);
  return (
    <Menu
      trigger={(triggerProperties) =>
        isCompact ? (
          <Button
            {...triggerProperties}
            type="button"
            size="sm"
            variant="secondary"
            icon
            aria-label="Hozzáadás"
            disabled={disabled}
          >
            <PlusIcon />
          </Button>
        ) : (
          <Button {...triggerProperties} type="button" size="sm" variant="secondary" disabled={disabled}>
            Hozzáadás
            <DropdownChevronIcon />
          </Button>
        )
      }
    >
      {ADDABLE_NODE_MENU_ITEMS.map((item) => (
        <MenuItem
          key={item.value}
          onSelect={() => {
            onAddNode(item.value, computeViewportCenterNodePosition({ width, height, transform }));
          }}
        >
          {item.label}
        </MenuItem>
      ))}
    </Menu>
  );
}

/**
 * A gráf szerkesztő képernyő: betöltés, mentés, mentetlen jelző és a mentés
 * előtti séma ellenőrzés (SPEC-008 5.5, T-009-17, AC12, AC13, AC15), plusz a
 * csomópont beállítás panel (`node-inspector`, T-009-18, AC16, AC17). A
 * vászon (`GraphEditorCanvas`) teljesen vezérelt: a `currentNodes`/
 * `currentEdges` innen jön, és a node-inspector szerkesztése (`config`
 * mezőn át) UGYANEZT az állapotot módosítja, ami a vászonra is azonnal
 * visszahat (M-55).
 *
 * Az elrendezés 2026-09-09 óta három ponton más (felhasználói kérés):
 * a felső eszköztár megszűnt, helyette a képernyő aljához tapadó
 * `PageFooter` áll (balra a státusz, jobbra egy valódi `ButtonGroup` split
 * button: "Mentés" elsődleges gomb plusz egy `Menu`-vel nyíló nyíl trigger,
 * ami az "Elrendezés" műveletet adja - a design system "Mixed (split
 * button)" mintája, nem két egyenrangú, összeragasztott gomb); a vászon
 * köré vont kártya keret törlődött, tehát a munkafelület faltól falig ér;
 * és az osztott elrendezés aránya a `localStorage`-be mentődik, majd a
 * következő megnyitáskor visszatölt (`graph-editor-layout.ts`).
 */
function GraphEditorScreenContent(properties: Readonly<GraphEditorScreenProperties>): ReactElement {
  const {
    apiOrigin,
    fetchFunction,
    search,
    navigate,
    graphElementIdGenerator,
    registerNavigationGuard,
    onWorkflowNameChange,
  } = properties;
  const workflowId = readWorkflowId(search);

  const graphState = useRequestState<WorkflowGraphDocument>();
  const saveState = useRequestState<WorkflowGraphDocument>();
  const startRunState = useRequestState<StartedRunResponse>();
  // A workflow rekord (a lépés szintű `providerId` felülírás örökölt
  // értékéhez, AC17) és a globális beállítás (`defaultProviderId`) - mindkét
  // végpont a SPEC-005 4.2 táblázatában él, a node-inspector panel enélkül
  // nem tudná megnevezni, MELYIK providert örökli a lépés.
  const workflowState = useRequestState<{ readonly providerId: string | null; readonly name: string }>();
  const settingsState = useRequestState<{ readonly defaultProviderId: string | null }>();
  // A provider lista a "Provider felülírás" mezőhöz (SPEC-008 9. szekció 4.
  // async pontja): a mező a betöltés alatt letiltva áll.
  const providersState = useRequestState<readonly ProviderSummary[]>();
  // A skill könyvtár a `skills` mező listás módjának jelölőnégyzeteihez
  // (SPEC-009 5.2); a feltöltés és a törlés a Beállítások dolga.
  const { state: skillLibraryState } = useSkillLibrary(apiOrigin, fetchFunction);
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();
  const isCompactFooter = useIsFooterCompact();
  const isSaving = saveState.state.status === 'pending';

  const [baseline, setBaseline] = useState<WorkflowGraphDocument | undefined>(undefined);
  // A szerkesztett dokumentum a visszavonás történetével együtt egy állapot
  // (SPEC-008 5.10): minden gráf változás függvény alakú frissítéssel, a
  // korábbi dokumentumból rögzül, tehát egy renderbe vont két változás sem
  // veszíti el egyik lépést sem.
  const [history, setHistory] = useState<GraphEditHistory>(EMPTY_GRAPH_EDIT_HISTORY);
  const currentNodes = history.document.nodes;
  const currentEdges = history.document.edges;
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [validationMessage, setValidationMessage] = useState<string | undefined>(undefined);
  // Megkíséreltek-e már menteni úgy, hogy a mentés a séma ellenőrzésén
  // elbukott (`isSaveAttempted`, T-009-18 harmadik maradéka): ilyenkor a
  // node-inspectornak minden érvénytelen mezőn ki kell írnia a hibáját,
  // akkor is, ha a felhasználó az adott mezőhöz még hozzá sem nyúlt. Csak a
  // KLIENS oldali séma ellenőrzés hibája állítja igazra, mert csak az a
  // hiba forrása ugyanannak a mentési sémának (`NodeConfigSaveSchema`), amit a node-inspector
  // is fut a mezőnkénti hibákhoz - a szerver oldali (hálózati/500) hiba nem
  // mezőszintű, ahhoz nincs mit kiírni a panelen.
  const [isSaveAttempted, setIsSaveAttempted] = useState(false);
  // Az automatikus elrendezések számlálója: a vászon ennek megváltozására
  // illeszti újra a nézetet (`GraphEditorCanvas.autoLayoutRevision`). Azért
  // külön számláló, és nem a `currentNodes` figyelése, mert a nézet
  // újraillesztése KIZÁRÓLAG az elrendezés gomb hatása - egy kézi node
  // húzáskor a nézet ugrálása hibás viselkedés lenne.
  const [autoLayoutRevision, setAutoLayoutRevision] = useState(0);
  // Nyitva van-e a futás indítás modálisa. ÜRES `inputFields` lista esetén
  // sosem vált igazra: a futás közvetlenül indul (SPEC-008 6.5, AC28).
  const [isStartRunModalOpen, setIsStartRunModalOpen] = useState(false);
  // Külön jelző, nem a `graphState.state.status === 'success'` közvetlenül:
  // a `graphState.state` sikeresre váltása és a `currentNodes`/`currentEdges`
  // TÉNYLEGES feltöltése két külön render (az állapotfrissítés csak a
  // következő rendernél fut le hatásként). Enélkül a vászon egy köztes
  // renderen üres node/él listával csatolódna fel (a vászon vezérelt, saját
  // `nodes`/`edges` állapota nincs), és a `<ReactFlow fitView>` prop csak a
  // KEZDETI csomópontokra illeszti a nézetet (lásd `GraphEditorCanvas`), tehát
  // a később érkező valódi gráfra a nézet már nem illeszkedne.
  const [isHydrated, setIsHydrated] = useState(false);
  // A perzisztált osztott elrendezés arány EGYSZER, csatoláskor olvasódik
  // be (lusta `useState` kezdőérték): a `Resizable` a `defaultSizes` propot
  // szintén csak a saját kezdő állapotához használja, tehát a későbbi
  // olvasások amúgy sem hatnának. Az írás a `storeLayoutSizes` modul
  // szintű függvényén megy, aminek a hivatkozása stabil, tehát a
  // `Resizable` értesítő hatása nem futhat körbe.
  const [initialLayoutSizes] = useState<readonly number[]>(readStoredLayoutSizes);
  // Az elnavigálás megerősítő modálisának tárgya (SPEC-008 5.10, 1. pont):
  // nyitva van, amíg nem `undefined`.
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | undefined>(undefined);
  const isDirty = isGraphDirty(baseline, currentNodes, currentEdges);

  useEffect(() => {
    if (workflowId === undefined) {
      return;
    }
    setIsHydrated(false);
    void graphState.run(() =>
      requestRouteWithoutBody({
        routeId: 'readWorkflowGraph',
        parameters: { workflowId },
        responseSchema: WorkflowGraphDocumentSchema,
        fetchFunction,
        apiOrigin,
      }),
    );
    void workflowState.run(() =>
      requestRouteWithoutBody({
        routeId: 'getWorkflow',
        parameters: { workflowId },
        responseSchema: WorkflowDetailSchema,
        fetchFunction,
        apiOrigin,
      }),
    );
    void settingsState.run(() =>
      requestRouteWithoutBody({
        routeId: 'readSettings',
        responseSchema: SettingsRecordSchema,
        fetchFunction,
        apiOrigin,
      }),
    );
    void providersState.run(() =>
      requestRouteWithoutBody({
        routeId: 'listProviders',
        responseSchema: arraySchema(ProviderSummarySchema),
        fetchFunction,
        apiOrigin,
      }),
    );
    // A `graphState.run`/`workflowState.run`/`settingsState.run`/
    // `providersState.run` szándékosan nincs a dependency listán: a `useRequestState` saját `useCallback`-je
    // stabil, de a hívó oldali objektum maga nem az; a betöltésnek a
    // `workflowId`, az `apiOrigin` és a `fetchFunction` tényleges
    // változására kell újrafutnia, nem minden renderen. A projekt ESLint
    // konfigurációja nem tartalmazza a `react-hooks/exhaustive-deps`
    // szabályt.
  }, [workflowId, apiOrigin, fetchFunction]);

  // A morzsasor neve: a jelentés a kérés állapotváltozásaira fut (a `useMemo`
  // azonos állapotra azonos objektumot ad, tehát az `app-shell` állapotírása
  // nem körözhet), a leszereléskor pedig visszaáll a betöltő állapotra.
  const workflowName = useMemo(
    () => toEditorWorkflowName(workflowId, workflowState.state),
    [workflowId, workflowState.state],
  );
  useEffect(() => {
    onWorkflowNameChange(workflowName);
  }, [workflowName, onWorkflowNameChange]);
  useEffect(
    () => () => {
      onWorkflowNameChange({ kind: 'loading' });
    },
    [onWorkflowNameChange],
  );

  useEffect(() => {
    if (graphState.state.status !== 'success') {
      return;
    }
    // A `WorkflowGraphDocument` node/él alakja (`WorkflowNode`/`WorkflowEdge`)
    // a szerver `createdAtMs`/`updatedAtMs` mezőivel bővült; ezeket a
    // `workflowNodeToNodeInput`/`workflowEdgeToEdgeInput` vágja le, hogy a
    // `currentNodes`/`currentEdges` PONTOSAN ugyanazt az alakot hordozza,
    // mint amit az `isGraphDirty` a `baseline`-ből is előállít - enélkül a
    // dupla mező miatt a gráf a betöltés UTÁN azonnal piszkosnak látszana.
    // A mentetlen jelző alapja a szerver nyers válasza; a történet viszont a
    // normalizált alakról indul (SPEC-008 5.5, O-27, O-28): az elhagyott
    // kulcs nélküli elágazás él és a felvett Start így mentetlen változás, de
    // nem visszavonható lépés, és az elvetés is megtartja.
    const loadedDocument = {
      nodes: graphState.state.value.nodes.map((node) => workflowNodeToNodeInput(node)),
      edges: graphState.state.value.edges.map((edge) => workflowEdgeToEdgeInput(edge)),
    };
    setBaseline(graphState.state.value);
    setHistory(startGraphEditHistory(normalizeLoadedGraphDocument(loadedDocument, graphElementIdGenerator)));
    setIsHydrated(true);
    // Lásd a fenti megjegyzést: a `react-hooks/exhaustive-deps` szabály nincs
    // bekötve, a `graphState.state` a valódi, szándékos kiváltó; a generátor
    // szándékosan nincs a listán, mert a változása a történetet nem
    // indíthatja újra.
  }, [graphState.state]);

  // A provider választó opciói: a betöltés alatt a mező letiltva, sikeres
  // betöltés után a szerver listája, hibás betöltés után a protokoll
  // konstansa (a kettő ugyanazt az azonosító készletet írja le). A `useMemo`
  // azonos állapotra azonos objektumot ad, tehát a kontextus fogyasztói nem
  // renderelődnek újra feleslegesen.
  const providerOptions = useMemo<ProviderOptions>(
    () => ({
      isLoading: providersState.state.status === 'pending',
      providerIds:
        providersState.state.status === 'success'
          ? providersState.state.value.map((provider) => provider.id)
          : ProviderIdSchema.options,
      testConnection: createProviderConnectionTester(apiOrigin, fetchFunction),
    }),
    [providersState.state, apiOrigin, fetchFunction],
  );

  const handleGraphChange = useCallback(
    (nodes: readonly WorkflowNodeInput[], edges: readonly WorkflowEdgeInput[], session?: GraphEditSession): void => {
      setHistory((current) => recordGraphEdit(current, { nodes, edges }, session));
    },
    [],
  );

  // A csomópont felvétel (SPEC-008 5.8): a "Hozzáadás" gomb és a jobb klikk
  // menü csak a helyet adja, a csomópontot mindkét úton ez veszi fel. Helyi,
  // szinkron művelet, hálózati kérés nélkül; a felvett csomópont kiválasztott,
  // tehát a beállítás panel megnyílik, és a mentetlen jelző az `isGraphDirty`
  // összehasonlításból jelenik meg.
  const handleAddNode = useCallback<AddNodeContextMenuProperties['onAddNode']>(
    (type, position) => {
      const node = createGraphNode(type, position, graphElementIdGenerator);
      setHistory((current) =>
        recordGraphEdit(current, { nodes: [...current.document.nodes, node], edges: current.document.edges }),
      );
      setSelectedNodeId(node.id);
    },
    [graphElementIdGenerator],
  );

  // A beállítás panel mezőjének változásai a mező elhagyásáig (`blur`) egy
  // lépés (SPEC-008 5.10): a menet kulcsa a csomópont, és a panel `onBlur`
  // eseménye zárja (`handleFieldBlur`).
  const handleUpdateNode = useCallback((updatedNode: WorkflowNodeInput): void => {
    setHistory((current) =>
      recordGraphEdit(
        current,
        {
          nodes: current.document.nodes.map((node) => (node.id === updatedNode.id ? updatedNode : node)),
          edges: current.document.edges,
        },
        { key: `field:${updatedNode.id}`, isFinal: false },
      ),
    );
  }, []);

  const handleFieldBlur = useCallback((): void => {
    setHistory(closeGraphEditSession);
  }, []);

  // A visszavonás és az újra elvégzés a gombból és a billentyűből (SPEC-008
  // 5.10). Helyi, szinkron művelet, hálózati kérés nélkül. A mentés alatt a
  // gombok tiltottak, a billentyű pedig nem lép működésbe (user döntés
  // 2026-10-16).
  const handleHistoryStep = useCallback((action: UndoShortcutAction): void => {
    setHistory(stepGraphEditHistory(action));
  }, []);
  // A módosító (Cmd vagy Ctrl) a képernyő betöltésekor olvasott beállításból
  // és a felhasználói ügynökből áll elő (SPEC-008 5.10, O-31); a tipp is ezt
  // mutatja.
  const [undoModifier] = useState<UndoModifier>(() =>
    resolveUndoModifier(readUndoModifierPreference(getBrowserLocalStorage), globalThis.navigator.userAgent),
  );
  const undoShortcutLabels = formatUndoShortcutLabels(undoModifier);
  useUndoRedoShortcut(handleHistoryStep, isSaving, pendingNavigation !== undefined, undoModifier);

  // Az elnavigálás megerősítése (SPEC-008 5.10, 1. és 2. pont): az őr és a
  // `beforeunload` figyelő csak mentetlen változás idejére áll, mentetlen
  // változás nélkül a navigáció azonnal megtörténik.
  useEffect(() => {
    if (!isDirty) {
      return;
    }
    return registerNavigationGuard((proceed) => {
      setPendingNavigation({ proceed });
    });
  }, [isDirty, registerNavigationGuard]);
  useBeforeUnloadPrompt(isDirty);

  // A változtatások elvetése (SPEC-008 5.10): a kiinduló dokumentumra állít,
  // egy visszavonható lépésként, megerősítés és hálózati kérés nélkül. A
  // mentés alatt a menüpont tiltott, a Visszavonás gombhoz hasonlóan (user
  // döntés 2026-10-16).
  const handleDiscard = useCallback((): void => {
    setHistory(discardGraphEdits);
  }, []);

  // Ha a kiválasztott csomópont nincs a dokumentumban (a visszavonás vagy az
  // újra elvégzés kivette), a kiválasztás megszűnik, és a panel bezárul
  // (SPEC-008 5.10, AC67): egy későbbi újra elvégzés sem nyitja meg újra.
  useEffect(() => {
    if (selectedNodeId !== undefined && currentNodes.every((node) => node.id !== selectedNodeId)) {
      setSelectedNodeId(undefined);
    }
  }, [currentNodes, selectedNodeId]);

  // Az automatikus elrendezés (`graph-auto-layout`, T-009-19, SPEC-008 5.7)
  // szinkron fut, jelzés nélkül, és NEM ment: csak a `currentNodes` állapotot
  // írja át, amitől a mentetlen jelző (`isDirty`) a meglévő
  // `isGraphDirty`-n át magától igazra vált - nincs hozzá külön jelző.
  const handleAutoLayout = useCallback((): void => {
    setHistory((current) =>
      recordGraphEdit(current, {
        nodes: layoutGraph(current.document.nodes, current.document.edges),
        edges: current.document.edges,
      }),
    );
    setAutoLayoutRevision((revision) => revision + 1);
  }, []);

  // A korai visszatérés minden hook UTÁN áll: a `workflowId` innentől
  // `string` (nem `string | undefined`). Enélkül egy sosem futó, csak
  // típusbiztonsági `if (workflowId === undefined)` ág kéne, ami a 100
  // százalékos elágazás lefedettséget sértené (`.claude/CLAUDE.md` 5.).
  if (workflowId === undefined) {
    return <p role="alert">Nincs megadva szerkesztendő workflow (hiányzó "workflowId" query paraméter).</p>;
  }
  // Új `const` kötés a FÜGGVÉNYTÖRZS szintjén: a `handleSave` hoistolt
  // függvény deklaráció, és a TypeScript a szűkítést a függvény deklarációkba
  // nem viszi át, csak a nem hoistolt függvényekbe (nyíl függvény, függvény
  // kifejezés; <https://devblogs.microsoft.com/typescript/announcing-typescript-5-4/>,
  // <https://github.com/microsoft/TypeScript/pull/56908>). A `workflowId`
  // tehát a `handleSave`-ben újra `string | undefined` lenne; ez a kötés a
  // szűkített ponton jön létre, ezért `string`, és ezt viszik a lenti zárványok.
  const resolvedWorkflowId = workflowId;

  function handleSave(): void {
    const validated = validateGraphForSave(currentNodes, currentEdges);
    if (validated.kind === 'error') {
      setValidationMessage(validated.message);
      setIsSaveAttempted(true);
      return;
    }
    setValidationMessage(undefined);
    void saveState.run(async () => {
      const outcome = await requestRoute({
        routeId: 'replaceWorkflowGraph',
        parameters: { workflowId: resolvedWorkflowId },
        body: validated.value,
        responseSchema: WorkflowGraphDocumentSchema,
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind === 'ok') {
        setBaseline(outcome.value);
        // Mentés után mindkét lista kiürül (user döntés, SPEC-008 5.10), és a
        // kiinduló dokumentum a mentett dokumentum: a mentés futása alatti
        // szerkesztés a jelenlegi dokumentumban marad, az elvetés viszont a
        // mentett állapotra állít.
        const savedDocument = {
          nodes: outcome.value.nodes.map((node) => workflowNodeToNodeInput(node)),
          edges: outcome.value.edges.map((edge) => workflowEdgeToEdgeInput(edge)),
        };
        setHistory((current) => startGraphEditHistory(current.document, savedDocument));
        pushToast({ variant: 'success', title: 'Gráf mentve', message: resolvedWorkflowId });
      } else {
        pushToast({ variant: 'danger', title: 'A mentés sikertelen', message: outcome.message });
      }
      return outcome;
    });
  }

  /**
   * A futás indítása (SPEC-008 6.5, 9. szekció 5. async pont): a kérés
   * `input` mezője a modálison összeállított objektum, üres `inputFields`
   * lista esetén üres rekord. Siker után a szerkesztő az ÚJ futás nézetére
   * navigál, tehát ez a képernyő leszerel; a modális bezárása ezért nem ebben
   * az ágban, hanem a hibaágban sem kell (a hibát a modális maga írja ki).
   */
  function startRun(input: Readonly<Record<string, unknown>>): void {
    void startRunState.run(async () => {
      const outcome = await requestRoute({
        routeId: 'startRun',
        parameters: { workflowId: resolvedWorkflowId },
        body: { input },
        responseSchema: StartedRunResponseSchema,
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind === 'ok') {
        navigate('runView', `runId=${outcome.value.runId}`);
      }
      return outcome;
    });
  }

  // A panel "Törlés" gombja (SPEC-008 5.9): megerősítés nélkül, kizárólag a
  // szerkesztett állapotot módosítja, hálózati kérés nincs.
  function handleDeleteNode(nodeId: string): void {
    setHistory((current) =>
      recordGraphEdit(current, deleteNodeWithEdges(current.document.nodes, current.document.edges, nodeId)),
    );
    setSelectedNodeId(undefined);
  }

  const startInputFields = readStartInputFields(currentNodes);

  function handleStartRunClick(): void {
    if (startInputFields.length === 0) {
      startRun({});
      return;
    }
    setIsStartRunModalOpen(true);
  }

  const isLoading = !isHydrated;
  const isStartingRun = startRunState.state.status === 'pending';
  const hasScript = hasScriptNode(currentNodes);
  const selectedNode = currentNodes.find((node) => node.id === selectedNodeId);
  const workflowProviderId =
    // eslint-disable-next-line unicorn/no-null -- a `describeInheritedProvider` a drótszintű `string | null` alakot várja.
    workflowState.state.status === 'success' ? workflowState.state.value.providerId : null;
  const defaultProviderId =
    // eslint-disable-next-line unicorn/no-null -- lásd fent.
    settingsState.state.status === 'success' ? settingsState.state.value.defaultProviderId : null;
  const inheritedProviderDescription = describeInheritedProvider(workflowProviderId, defaultProviderId);

  return (
    <div className="graph-editor-screen">
      {isLoading ? (
        <div className="graph-editor-screen__loading">
          {/* A betöltés csontváza a vászon helyét tölti ki (SPEC-008 9.
              szekció 1. pontja), tehát nincs sorszám, amire forrás kéne. */}
          <ThemedSkeleton shape="block" />
        </div>
      ) : (
        <div
          className={joinClassNames(
            'graph-editor-screen__body',
            selectedNode === undefined && 'graph-editor-screen__body--solo',
          )}
        >
          {/* A vászon és a beállítás panel egyetlen, HÚZHATÓ osztott
              elrendezésben áll (SPEC-008 5.5): a panel dokkolt sáv a jobb
              szélen, nem lebegő doboz, tehát a vászon mellette szűkül. A
              vászon panelje MINDIG felmountolva marad, akkor is, amikor
              nincs kiválasztott csomópont - enélkül a kiválasztás a React
              Flow-t újramountolná, és a felhasználó pásztázása és nagyítása
              elveszne. A "nincs kiválasztás" állapot elrendezését a
              `--solo` módosító adja, CSS-ben. */}
          <Resizable defaultSizes={initialLayoutSizes} onSizesChange={storeLayoutSizes}>
            <ResizablePanel index={0}>
              <div className="graph-editor-screen__canvas">
                <GraphEditorCanvas
                  nodes={currentNodes}
                  edges={currentEdges}
                  onGraphChange={handleGraphChange}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                  autoLayoutRevision={autoLayoutRevision}
                  graphElementIdGenerator={graphElementIdGenerator}
                  onAddNode={handleAddNode}
                />
              </div>
            </ResizablePanel>
            {selectedNode !== undefined && (
              <>
                <ResizableHandle beforeIndex={0} aria-label="A beállítás panel szélessége" />
                <ResizablePanel index={1}>
                  <ProviderOptionsContext.Provider value={providerOptions}>
                    <SkillLibraryContext.Provider value={skillLibraryState}>
                      <NodeInspector
                        node={selectedNode}
                        onChange={handleUpdateNode}
                        onClose={() => {
                          setSelectedNodeId(undefined);
                        }}
                        onDelete={() => {
                          handleDeleteNode(selectedNode.id);
                        }}
                        onFieldBlur={handleFieldBlur}
                        inheritedProviderDescription={inheritedProviderDescription}
                        isSaveAttempted={isSaveAttempted}
                      />
                    </SkillLibraryContext.Provider>
                  </ProviderOptionsContext.Provider>
                </ResizablePanel>
              </>
            )}
          </Resizable>
        </div>
      )}
      {/* A státusz és a művelet gombok a képernyő aljához tapadó
          akciósávban állnak (felhasználói kérés, 2026-09-09): balra a
          státusz, jobbra egy valódi split button (design system "Mixed"
          mintája, `button-group.html`): az elsődleges "Mentés" művelet
          mellett egy szöveg nélküli nyíl gomb nyitja a további műveletek
          ("Elrendezés", "Változtatások elvetése") lenyíló menüjét. A gombok `sm`
          méretűek, mert ez nem modális és nem popup felület. */}
      <PageFooter
        status={
          <>
            {isDirty && <span role="status">Mentetlen változtatások</span>}
            {hasScript && (
              <p id={SCRIPT_RUN_BLOCK_REASON_DOM_ID}>
                {`A futás nem indítható: a gráf Szkript lépést tartalmaz, amit a motor a futtatáskor \`${SCRIPT_UNIMPLEMENTED_ERROR_CLASS}\` hibával elutasít.`}
              </p>
            )}
            {validationMessage !== undefined && <p role="alert">{validationMessage}</p>}
            {graphState.state.status === 'failure' && <Alert variant="danger">{graphState.state.message}</Alert>}
            {/* Az indítás hibája a lábléc státuszában áll, ha NINCS nyitva a
                modális (üres `inputFields` lista, tehát a futás modális nélkül
                indult). Nyitott modálisnál az üzenet a modálisban látszik, a
                lábléc fölé feszülő átlapoló mögött ugyanis olvashatatlan
                lenne; ez a feltétel tehát nem duplikálja az üzenetet. */}
            {startRunState.state.status === 'failure' && !isStartRunModalOpen && (
              <Alert variant="danger">{startRunState.state.message}</Alert>
            )}
          </>
        }
      >
        {/* A futás indítása akkor aktív, ha NINCS mentetlen változás, a gráf
            nem üres és nincs benne `script` lépés (SPEC-008 6.5 táblázat, 14.
            kritérium). Mentetlen gráfból indítani azt jelentené, hogy a futás a
            szerveren tárolt, RÉGI gráfról készít pillanatképet, amit a
            felhasználó a képernyőn nem is lát. A `script` lépést a motor
            futás indításkor elutasítja, ezért a gomb tiltott, és az okot a
            lábléc státusza nevezi meg, a gomb `aria-describedby` hivatkozásával. */}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={isCompactFooter}
          aria-label={isCompactFooter ? 'Futás indítása' : undefined}
          aria-describedby={hasScript ? SCRIPT_RUN_BLOCK_REASON_DOM_ID : undefined}
          isLoading={isStartingRun}
          disabled={isStartingRun || isLoading || isDirty || currentNodes.length === 0 || hasScript}
          onClick={handleStartRunClick}
        >
          {/* A felirat SZÁNDÉKOSAN nem a puszta "Indítás": az a `start`
              csomópont TÍPUSCÍMKÉJE a vásznon (`graph-node-catalog`), tehát
              egy azonos feliratú gomb a felületen is, a
              `getByRole`/`getByText` locatorokon is kétértelmű lenne. A
              `--ep-screen-sm` tokenen és alatta a gomb csak ikon, a neve az
              `aria-label` (user döntés 2026-10-16, mint a "Hozzáadás"
              gombé). */}
          {isCompactFooter ? <PlayIcon /> : 'Futás indítása'}
        </Button>
        {/* A Visszavonás és az Újra a "Hozzáadás" és a "Mentés" split button
            előtt (SPEC-008 5.10): ikon gomb, a neve az `aria-label`, a tipp a
            billentyűt mutatja. Üres listánál és betöltés vagy mentés alatt
            tiltott. */}
        <Tooltip content="Visszavonás" shortcut={undoShortcutLabels.undo}>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon
            aria-label="Visszavonás"
            disabled={isLoading || isSaving || history.undoStack.length === 0}
            onClick={() => {
              handleHistoryStep('undo');
            }}
          >
            <UndoIcon />
          </Button>
        </Tooltip>
        <Tooltip content="Újra" shortcut={undoShortcutLabels.redo}>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon
            aria-label="Újra"
            disabled={isLoading || isSaving || history.redoStack.length === 0}
            onClick={() => {
              handleHistoryStep('redo');
            }}
          >
            <RedoIcon />
          </Button>
        </Tooltip>
        {/* A "Hozzáadás" közvetlenül a "Mentés" split button előtt áll, így az
            elsődleges művelet a sor végén marad (SPEC-008 5.8, O-19). */}
        <AddNodeMenuButton disabled={isLoading} isCompact={isCompactFooter} onAddNode={handleAddNode} />
        <ButtonGroup aria-label="Gráf műveletek">
          <Button type="button" size="sm" onClick={handleSave} isLoading={isSaving} disabled={isSaving || isLoading}>
            {isSaving ? 'Mentés...' : 'Mentés'}
          </Button>
          <Menu
            trigger={(triggerProperties) => (
              <Button {...triggerProperties} type="button" size="sm" icon aria-label="További műveletek">
                <DropdownChevronIcon />
              </Button>
            )}
          >
            <MenuItem onSelect={handleAutoLayout} disabled={isLoading}>
              Elrendezés
            </MenuItem>
            <MenuItem onSelect={handleDiscard} disabled={isSaving || !canDiscardGraphEdits(history)}>
              Változtatások elvetése
            </MenuItem>
          </Menu>
        </ButtonGroup>
      </PageFooter>
      <StartRunModal
        open={isStartRunModalOpen}
        fields={startInputFields}
        isSubmitting={isStartingRun}
        errorMessage={startRunState.state.status === 'failure' ? startRunState.state.message : undefined}
        onClose={() => {
          setIsStartRunModalOpen(false);
        }}
        onSubmit={startRun}
      />
      {pendingNavigation !== undefined && (
        <NavigationConfirmationModal
          onLeave={() => {
            pendingNavigation.proceed();
            setPendingNavigation(undefined);
          }}
          onCancel={() => {
            setPendingNavigation(undefined);
          }}
        />
      )}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

/**
 * A gráf szerkesztő képernyő a `ReactFlowProvider` alatt: a provider a React
 * Flow store-ját a `<ReactFlow>` komponensen kívül is elérhetővé teszi (a
 * lábléc "Hozzáadás" gombjának kell, SPEC-008 5.8), és a vászon `<ReactFlow>`
 * eleme ugyanezt a store-t használja.
 */
export function GraphEditorScreen(properties: Readonly<GraphEditorScreenProperties>): ReactElement {
  return (
    <ReactFlowProvider>
      <GraphEditorScreenContent {...properties} />
    </ReactFlowProvider>
  );
}
