import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ProtocolErrorBody } from './protocol-error-body.ts';
import type { ConcurrencyLimitView } from '../settings/concurrency-limit-view.ts';
import type { SettingsRecord } from '../settings/settings-record.ts';
import type { ConnectionTestResponse } from '../provider/connection-test-response.ts';
import type { ProviderSummary } from '../provider/provider-summary.ts';
import type { PendingApproval } from '../approval/pending-approval.ts';
import type { RunEventRecord } from '../transcript/run-event-record.ts';
import type { TranscriptPage } from '../transcript/transcript-page.ts';
import type { InterruptSummaryResponse } from '../run/interrupt-summary.ts';
import type { RunDetail, RunSummary } from '../run/run-record.ts';
import type { RunSnapshotResponse, SnapshotEdge, SnapshotNode } from '../run/run-snapshot.ts';
import type { StartedRunResponse } from '../run/start-run-request.ts';
import type { StepRunRecord } from '../run/step-run-record.ts';
import type { DeletionSummary } from '../workflow/delete-workflow-request.ts';
import type {
  ReplaceGraphRequest,
  WorkflowEdge,
  WorkflowGraphDocument,
  WorkflowNode,
} from '../workflow/workflow-graph-document.ts';
import type { WorkflowDetail, WorkflowSummary } from '../workflow/workflow-record.ts';
import type {
  ProtocolErrorFrame,
  ReplayCompleteFrame,
  RunEventFrame,
  RunEventTransientFrame,
  StreamReadyFrame,
} from '../event-stream/stream-frame.ts';
import type { SubscriptionState } from '../event-stream/stream-subscription.ts';

const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function listSourceFiles(directory: string): readonly string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }
    if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('a packages/protocol egyetlen drótszintű alakja sem kap kézzel írt interface-t (SPEC-005 7.1, 13. szekció 31. kritérium)', () => {
  const files = listSourceFiles(SRC_DIR);

  // Az egyetlen kivétel a `RouteDefinition` (`http-route/route-table.ts`):
  // ez nem drótszintű alak, hanem az útvonal tábla belső, csak a szerver
  // oldali útvonal regisztrációhoz kellő metaadata típusa, ami maga sosem
  // megy JSON törzsként a dróton (SPEC-005 4. szekció 26 végpontja egyike
  // sem `RouteDefinition` alakot ad vissza vagy fogad).
  const allowedManualInterfaceFile = path.join(SRC_DIR, 'http-route', 'route-table.ts');

  for (const file of files) {
    if (file === allowedManualInterfaceFile) {
      continue;
    }
    const relativePath = path.relative(SRC_DIR, file);
    it(`${relativePath}: nincs kézzel írt interface vagy objektum type alias`, () => {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/^export interface/m);
      expect(content).not.toMatch(/^export type \w+ = \{/m);
    });
  }
});

describe('a packages/protocol minden kimenő REST válasz és SSE keret alakja Readonly<> (SPEC-005 7.3 3. szabály, 13. szekció 33. kritérium)', () => {
  it('WorkflowSummary', () => {
    expectTypeOf<WorkflowSummary>().toEqualTypeOf<Readonly<WorkflowSummary>>();
  });
  it('WorkflowDetail', () => {
    expectTypeOf<WorkflowDetail>().toEqualTypeOf<Readonly<WorkflowDetail>>();
  });
  it('WorkflowGraphDocument', () => {
    expectTypeOf<WorkflowGraphDocument>().toEqualTypeOf<Readonly<WorkflowGraphDocument>>();
  });
  it('WorkflowNode', () => {
    expectTypeOf<WorkflowNode>().toEqualTypeOf<Readonly<WorkflowNode>>();
  });
  it('WorkflowEdge', () => {
    expectTypeOf<WorkflowEdge>().toEqualTypeOf<Readonly<WorkflowEdge>>();
  });
  it('DeletionSummary', () => {
    expectTypeOf<DeletionSummary>().toEqualTypeOf<Readonly<DeletionSummary>>();
  });
  it('RunSummary', () => {
    expectTypeOf<RunSummary>().toEqualTypeOf<Readonly<RunSummary>>();
  });
  it('RunDetail', () => {
    expectTypeOf<RunDetail>().toEqualTypeOf<Readonly<RunDetail>>();
  });
  it('RunSnapshotResponse', () => {
    expectTypeOf<RunSnapshotResponse>().toEqualTypeOf<Readonly<RunSnapshotResponse>>();
  });
  it('SnapshotNode', () => {
    expectTypeOf<SnapshotNode>().toEqualTypeOf<Readonly<SnapshotNode>>();
  });
  it('SnapshotEdge', () => {
    expectTypeOf<SnapshotEdge>().toEqualTypeOf<Readonly<SnapshotEdge>>();
  });
  it('StepRunRecord', () => {
    expectTypeOf<StepRunRecord>().toEqualTypeOf<Readonly<StepRunRecord>>();
  });
  it('TranscriptPage', () => {
    expectTypeOf<TranscriptPage>().toEqualTypeOf<Readonly<TranscriptPage>>();
  });
  it('RunEventRecord', () => {
    expectTypeOf<RunEventRecord>().toEqualTypeOf<Readonly<RunEventRecord>>();
  });
  it('InterruptSummaryResponse', () => {
    expectTypeOf<InterruptSummaryResponse>().toEqualTypeOf<Readonly<InterruptSummaryResponse>>();
  });
  it('StartedRunResponse', () => {
    expectTypeOf<StartedRunResponse>().toEqualTypeOf<Readonly<StartedRunResponse>>();
  });
  it('PendingApproval', () => {
    expectTypeOf<PendingApproval>().toEqualTypeOf<Readonly<PendingApproval>>();
  });
  it('ProviderSummary', () => {
    expectTypeOf<ProviderSummary>().toEqualTypeOf<Readonly<ProviderSummary>>();
  });
  it('ConnectionTestResponse', () => {
    expectTypeOf<ConnectionTestResponse>().toEqualTypeOf<Readonly<ConnectionTestResponse>>();
  });
  it('SettingsRecord', () => {
    expectTypeOf<SettingsRecord>().toEqualTypeOf<Readonly<SettingsRecord>>();
  });
  it('ConcurrencyLimitView', () => {
    expectTypeOf<ConcurrencyLimitView>().toEqualTypeOf<Readonly<ConcurrencyLimitView>>();
  });
  it('SubscriptionState', () => {
    expectTypeOf<SubscriptionState>().toEqualTypeOf<Readonly<SubscriptionState>>();
  });
  it('StreamReadyFrame', () => {
    expectTypeOf<StreamReadyFrame>().toEqualTypeOf<Readonly<StreamReadyFrame>>();
  });
  it('RunEventFrame', () => {
    expectTypeOf<RunEventFrame>().toEqualTypeOf<Readonly<RunEventFrame>>();
  });
  it('RunEventTransientFrame', () => {
    expectTypeOf<RunEventTransientFrame>().toEqualTypeOf<Readonly<RunEventTransientFrame>>();
  });
  it('ReplayCompleteFrame', () => {
    expectTypeOf<ReplayCompleteFrame>().toEqualTypeOf<Readonly<ReplayCompleteFrame>>();
  });
  it('ProtocolErrorFrame', () => {
    expectTypeOf<ProtocolErrorFrame>().toEqualTypeOf<Readonly<ProtocolErrorFrame>>();
  });
  it('ProtocolErrorBody', () => {
    expectTypeOf<ProtocolErrorBody>().toEqualTypeOf<Readonly<ProtocolErrorBody>>();
  });

  // Bemeneti alak kontrollpéldaként: a `ReplaceGraphRequest` (`PUT` kérés
  // törzs) NEM readonly a mezői szintjén (a nested tömb `.readonly()`, de
  // maga az objektum nem) - a spec 7.3 3. szabálya csak a KIMENŐ alakra
  // kötelező, a bemenetire nem. Ha ez a sor readonly objektumot várna, és a
  // tényleges típus mégsem az, a `toEqualTypeOf` fordítási hibával bukna.
  it('ReplaceGraphRequest (bemeneti kontroll) nem readonly objektum', () => {
    expectTypeOf<ReplaceGraphRequest>().not.toEqualTypeOf<Readonly<ReplaceGraphRequest>>();
  });
});
