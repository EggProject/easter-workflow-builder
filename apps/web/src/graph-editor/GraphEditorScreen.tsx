import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  WorkflowGraphDocumentSchema,
  type WorkflowEdgeInput,
  type WorkflowGraphDocument,
  type WorkflowNodeInput,
} from '@easter-workflow-builder/protocol';
import { Button, Skeleton, ToastViewport, useToasts } from '@easter-workflow-builder/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { requestRoute } from '../rest-client/request-route.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import { GraphEditorCanvas } from './GraphEditorCanvas.tsx';
import { workflowEdgeToEdgeInput, workflowNodeToNodeInput } from './graph-editor-document-projection.ts';
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
 * A gráf szerkesztő képernyő: betöltés, mentés, mentetlen jelző és a mentés
 * előtti séma ellenőrzés (SPEC-008 5.5, T-009-17, AC12, AC13, AC15). A vászon
 * (`GraphEditorCanvas`) minden változást visszaad, ebből épül a jelenlegi
 * állapot; a mentetlen jelző ezt hasonlítja a betöltött alaphoz
 * (`isGraphDirty`). A mentés csak akkor indul, ha a `validateGraphForSave`
 * `ok` értéket ad - hibás alak esetén a felület a hibás mező útvonalát
 * mutatja, kérés nélkül.
 */
export function GraphEditorScreen(properties: Readonly<GraphEditorScreenProperties>): ReactElement {
  const { apiOrigin, fetchFunction, search } = properties;
  const workflowId = readWorkflowId(search);

  const graphState = useRequestState<WorkflowGraphDocument>();
  const saveState = useRequestState<WorkflowGraphDocument>();
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  const [baseline, setBaseline] = useState<WorkflowGraphDocument | undefined>(undefined);
  const [currentNodes, setCurrentNodes] = useState<readonly WorkflowNodeInput[]>([]);
  const [currentEdges, setCurrentEdges] = useState<readonly WorkflowEdgeInput[]>([]);
  const [validationMessage, setValidationMessage] = useState<string | undefined>(undefined);
  // Külön jelző, nem a `graphState.state.status === 'success'` közvetlenül:
  // a `graphState.state` sikeresre váltása és a `currentNodes`/`currentEdges`
  // TÉNYLEGES feltöltése két külön render (az állapotfrissítés csak a
  // következő rendernél fut le hatásként). Enélkül a vászon egy köztes
  // renderen üres kezdő node/él listával mondana le, és mivel a
  // `GraphEditorCanvas` belső állapota `useState` lusta kezdőértékkel épül
  // (csak csatoláskor fut le), a később érkező valódi adat már nem jutna be.
  const [isHydrated, setIsHydrated] = useState(false);

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
    // A `graphState.run` szándékosan nincs a dependency listán: a
    // `useRequestState` saját `useCallback`-je stabil, de a hívó oldali
    // `graphState` objektum maga nem az; a betöltésnek a `workflowId`, az
    // `apiOrigin` és a `fetchFunction` tényleges változására kell
    // újrafutnia, nem minden renderen. A projekt ESLint konfigurációja nem
    // tartalmazza a `react-hooks/exhaustive-deps` szabályt.
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

  return (
    <div className="graph-editor-screen">
      <div className="graph-editor-screen__toolbar">
        <Button type="button" onClick={handleSave} disabled={isSaving || isLoading}>
          {isSaving ? 'Mentés...' : 'Mentés'}
        </Button>
        {isDirty && <span role="status">Mentetlen változtatások</span>}
        {validationMessage !== undefined && <p role="alert">{validationMessage}</p>}
        {graphState.state.status === 'failure' && <p role="alert">{graphState.state.message}</p>}
      </div>
      {isLoading ? (
        <Skeleton shape="text" lines={4} />
      ) : (
        <div className="graph-editor-screen__canvas">
          <GraphEditorCanvas
            initialNodes={currentNodes}
            initialEdges={currentEdges}
            onGraphChange={handleGraphChange}
            selectedNodeId={undefined}
            onSelectNode={() => {
              // A csomópont beállítás panel (`node-inspector`, T-009-18) a
              // fogyasztója; addig a kiválasztás nyugtázása nélkül is
              // helyesen működik a vászon (a `GraphEditorCanvas` a
              // `selectedNodeId` prop hiányában is renderel, csak a
              // vizuális kiemelés marad el).
            }}
          />
        </div>
      )}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
