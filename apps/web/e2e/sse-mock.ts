// SSE `page.route()` mockolás (T-008-28). A `docs/research/
// 2026-08-30-sse-mockolas-meres.md` 3. szekció 1. pontja szerint ez a
// HASZNÁLANDÓ út minden olyan teszthez, ami egyetlen, lezárt SSE válaszon
// belüli viselkedést ellenőriz - a `Last-Event-ID` alapú újracsatlakozás
// EGYETLEN, mérten indokolt kivétel, ld. `sse-reconnect.spec.ts`.
import type { Page } from '@playwright/test';
import { encodeStreamFrame, type StreamFrame } from '@easter-workflow-builder/protocol';
import { API_ORIGIN } from './api-origin.ts';

/**
 * Egyetlen, lezárt SSE válasz mockolása a megadott keretsorozattal. A
 * `route.fulfill()` egyszeri, lezárt aktus (2.7 mérés), tehát ez a minta
 * csak azt szimulálja, hogy a kapcsolat megnyílása UTÁN, EGYETLEN válaszon
 * belül milyen kereteket kap a kliens - nem menet közbeni, élő beszúrást.
 */
export async function mockSseFrames(page: Page, frames: readonly StreamFrame[]): Promise<void> {
  await page.route(`${API_ORIGIN}/events**`, async (route) => {
    const body = frames.map((frame) => encodeStreamFrame(frame)).join('');
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body });
  });
}

/**
 * A legtöbb, SSE-t nem célzottan vizsgáló teszthez (workflow-list,
 * run-history alapfolyam): egyetlen `stream_ready` keret, üres feliratkozás
 * listával, hogy az `AppShell` mindig nyitott stream kapcsolata ne fusson
 * neki egy valódi, hiányzó szervernek.
 */
export async function mockIdleStream(page: Page): Promise<void> {
  await mockSseFrames(page, [
    { event: 'stream_ready', streamId: 'e2e-stream', serverInstanceId: 'e2e-server', subscriptions: [] },
  ]);
}
