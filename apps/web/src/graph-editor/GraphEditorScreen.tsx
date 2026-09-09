import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  SettingsRecordSchema,
  WorkflowDetailSchema,
  WorkflowGraphDocumentSchema,
  type WorkflowEdgeInput,
  type WorkflowGraphDocument,
  type WorkflowNodeInput,
} from '@easter-workflow-builder/protocol';
import {
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  PageFooter,
  Resizable,
  ResizableHandle,
  ResizablePanel,
  Skeleton,
  ToastViewport,
  joinClassNames,
  useToasts,
} from '@easter-workflow-builder/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { layoutGraph } from '../graph-auto-layout/layout-graph.ts';
import { NodeInspector } from '../node-inspector/NodeInspector.tsx';
import { describeInheritedProvider } from '../node-inspector/describe-inherited-provider.ts';
import { requestRoute } from '../rest-client/request-route.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import { GraphEditorCanvas } from './GraphEditorCanvas.tsx';
import { workflowEdgeToEdgeInput, workflowNodeToNodeInput } from './graph-editor-document-projection.ts';
import { readStoredLayoutSizes, storeLayoutSizes } from './graph-editor-layout.ts';
import './graph-editor-screen.css';
import { isGraphDirty } from './is-graph-dirty.ts';
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
export function GraphEditorScreen(properties: Readonly<GraphEditorScreenProperties>): ReactElement {
  const { apiOrigin, fetchFunction, search } = properties;
  const workflowId = readWorkflowId(search);

  const graphState = useRequestState<WorkflowGraphDocument>();
  const saveState = useRequestState<WorkflowGraphDocument>();
  // A workflow rekord (a lépés szintű `providerId` felülírás örökölt
  // értékéhez, AC17) és a globális beállítás (`defaultProviderId`) - mindkét
  // végpont a SPEC-005 4.2 táblázatában él, a node-inspector panel enélkül
  // nem tudná megnevezni, MELYIK providert örökli a lépés.
  const workflowState = useRequestState<{ readonly providerId: string | null }>();
  const settingsState = useRequestState<{ readonly defaultProviderId: string | null }>();
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  const [baseline, setBaseline] = useState<WorkflowGraphDocument | undefined>(undefined);
  const [currentNodes, setCurrentNodes] = useState<readonly WorkflowNodeInput[]>([]);
  const [currentEdges, setCurrentEdges] = useState<readonly WorkflowEdgeInput[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [validationMessage, setValidationMessage] = useState<string | undefined>(undefined);
  // Megkíséreltek-e már menteni úgy, hogy a mentés a séma ellenőrzésén
  // elbukott (`isSaveAttempted`, T-009-18 harmadik maradéka): ilyenkor a
  // node-inspectornak minden érvénytelen mezőn ki kell írnia a hibáját,
  // akkor is, ha a felhasználó az adott mezőhöz még hozzá sem nyúlt. Csak a
  // KLIENS oldali séma ellenőrzés hibája állítja igazra, mert csak az a
  // hiba forrása ugyanannak a `NodeConfigSchema`-nak, amit a node-inspector
  // is fut a mezőnkénti hibákhoz - a szerver oldali (hálózati/500) hiba nem
  // mezőszintű, ahhoz nincs mit kiírni a panelen.
  const [isSaveAttempted, setIsSaveAttempted] = useState(false);
  // Az automatikus elrendezések számlálója: a vászon ennek megváltozására
  // illeszti újra a nézetet (`GraphEditorCanvas.autoLayoutRevision`). Azért
  // külön számláló, és nem a `currentNodes` figyelése, mert a nézet
  // újraillesztése KIZÁRÓLAG az elrendezés gomb hatása - egy kézi node
  // húzáskor a nézet ugrálása hibás viselkedés lenne.
  const [autoLayoutRevision, setAutoLayoutRevision] = useState(0);
  // Külön jelző, nem a `graphState.state.status === 'success'` közvetlenül:
  // a `graphState.state` sikeresre váltása és a `currentNodes`/`currentEdges`
  // TÉNYLEGES feltöltése két külön render (az állapotfrissítés csak a
  // következő rendernél fut le hatásként). Enélkül a vászon egy köztes
  // renderen üres kezdő node/él listával mondana le, és mivel a
  // `GraphEditorCanvas` belső állapota `useState` lusta kezdőértékkel épül
  // (csak csatoláskor fut le), a később érkező valódi adat már nem jutna be.
  const [isHydrated, setIsHydrated] = useState(false);
  // A perzisztált osztott elrendezés arány EGYSZER, csatoláskor olvasódik
  // be (lusta `useState` kezdőérték): a `Resizable` a `defaultSizes` propot
  // szintén csak a saját kezdő állapotához használja, tehát a későbbi
  // olvasások amúgy sem hatnának. Az írás a `storeLayoutSizes` modul
  // szintű függvényén megy, aminek a hivatkozása stabil, tehát a
  // `Resizable` értesítő hatása nem futhat körbe.
  const [initialLayoutSizes] = useState<readonly number[]>(readStoredLayoutSizes);

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
    // A `graphState.run`/`workflowState.run`/`settingsState.run` szándékosan
    // nincs a dependency listán: a `useRequestState` saját `useCallback`-je
    // stabil, de a hívó oldali objektum maga nem az; a betöltésnek a
    // `workflowId`, az `apiOrigin` és a `fetchFunction` tényleges
    // változására kell újrafutnia, nem minden renderen. A projekt ESLint
    // konfigurációja nem tartalmazza a `react-hooks/exhaustive-deps`
    // szabályt.
  }, [workflowId, apiOrigin, fetchFunction]);

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
    setBaseline(graphState.state.value);
    setCurrentNodes(graphState.state.value.nodes.map((node) => workflowNodeToNodeInput(node)));
    setCurrentEdges(graphState.state.value.edges.map((edge) => workflowEdgeToEdgeInput(edge)));
    setIsHydrated(true);
    // Lásd a fenti megjegyzést: a `react-hooks/exhaustive-deps` szabály nincs
    // bekötve, a `graphState.state` a valódi, szándékos kiváltó.
  }, [graphState.state]);

  const handleGraphChange = useCallback(
    (nodes: readonly WorkflowNodeInput[], edges: readonly WorkflowEdgeInput[]): void => {
      setCurrentNodes(nodes);
      setCurrentEdges(edges);
    },
    [],
  );

  const handleUpdateNode = useCallback((updatedNode: WorkflowNodeInput): void => {
    setCurrentNodes((current) => current.map((node) => (node.id === updatedNode.id ? updatedNode : node)));
  }, []);

  // Az automatikus elrendezés (`graph-auto-layout`, T-009-19, SPEC-008 5.7)
  // szinkron fut, jelzés nélkül, és NEM ment: csak a `currentNodes` állapotot
  // írja át, amitől a mentetlen jelző (`isDirty`) a meglévő
  // `isGraphDirty`-n át magától igazra vált - nincs hozzá külön jelző.
  const handleAutoLayout = useCallback((): void => {
    setCurrentNodes((current) => layoutGraph(current, currentEdges));
    setAutoLayoutRevision((revision) => revision + 1);
  }, [currentEdges]);

  // A korai visszatérés minden hook UTÁN, de a lenti `handleSave` ELŐTT áll:
  // a `workflowId` innentől `string` (nem `string | undefined`), mert a
  // TypeScript a `const` kötés szűkítését a szövegben utána következő
  // zárványokba is átviszi. Enélkül a `handleSave`-ben egy sosem futó,
  // csak típusbiztonsági `if (workflowId === undefined)` ág kéne, ami a 100
  // százalékos elágazás lefedettséget sértené (`.claude/CLAUDE.md` 5.).
  if (workflowId === undefined) {
    return <p role="alert">Nincs megadva szerkesztendő workflow (hiányzó "workflowId" query paraméter).</p>;
  }
  // Új `const` kötés a FÜGGVÉNYTÖRZS szintjén, nem egy zárványon belül: a
  // TypeScript a szűkítést nem viszi át zárványba (sem a `handleSave`, sem a
  // benne futó `async` callback nem örökli a fenti korai visszatérésből
  // származó `string` szűkítést), tehát a zárványon belül újra kiszámolt
  // kötés is `string | undefined` maradna. Ez a kötés viszont a szűkített
  // ponton, zárvány NÉLKÜL jön létre, ezért a típusa itt már véglegesen
  // `string` - ezt viszik tovább a lenti zárványok (saját méréssel igazolt
  // `tsc` viselkedés).
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
        pushToast({ variant: 'success', title: 'Gráf mentve', message: resolvedWorkflowId });
      } else {
        pushToast({ variant: 'danger', title: 'A mentés sikertelen', message: outcome.message });
      }
      return outcome;
    });
  }

  const isLoading = !isHydrated;
  const isSaving = saveState.state.status === 'pending';
  const isDirty = isGraphDirty(baseline, currentNodes, currentEdges);
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
          <Skeleton shape="text" lines={4} />
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
                />
              </div>
            </ResizablePanel>
            {selectedNode !== undefined && (
              <>
                <ResizableHandle beforeIndex={0} aria-label="A beállítás panel szélessége" />
                <ResizablePanel index={1}>
                  <NodeInspector
                    node={selectedNode}
                    onChange={handleUpdateNode}
                    onClose={() => {
                      setSelectedNodeId(undefined);
                    }}
                    inheritedProviderDescription={inheritedProviderDescription}
                    isSaveAttempted={isSaveAttempted}
                  />
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
          (ma egyetlen: "Elrendezés") lenyíló menüjét. A gombok `sm`
          méretűek, mert ez nem modális és nem popup felület. */}
      <PageFooter
        status={
          <>
            {isDirty && <span role="status">Mentetlen változtatások</span>}
            {validationMessage !== undefined && <p role="alert">{validationMessage}</p>}
            {graphState.state.status === 'failure' && <p role="alert">{graphState.state.message}</p>}
          </>
        }
      >
        <ButtonGroup aria-label="Gráf műveletek">
          <Button type="button" size="sm" onClick={handleSave} disabled={isSaving || isLoading}>
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
          </Menu>
        </ButtonGroup>
      </PageFooter>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
