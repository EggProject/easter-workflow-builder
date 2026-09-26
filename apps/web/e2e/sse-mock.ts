// SSE `page.route()` mockolás (T-008-28). A `docs/research/
// 2026-08-30-sse-mockolas-meres.md` 3. szekció 1. pontja szerint ez a
// HASZNÁLANDÓ út minden olyan teszthez, ami egyetlen, lezárt SSE válaszon
// belüli viselkedést ellenőriz - a `Last-Event-ID` alapú újracsatlakozás
// EGYETLEN, mérten indokolt kivétel, ld. `sse-reconnect.spec.ts`.
import type { Page } from '@playwright/test';
import { encodeStreamFrame, type StreamFrame } from '@easter-workflow-builder/protocol';
import { STREAM_ORIGIN } from './api-origin.ts';

/**
 * Egyetlen, lezárt SSE válasz mockolása a megadott keretsorozattal. A
 * `route.fulfill()` egyszeri, lezárt aktus (2.7 mérés), tehát ez a minta
 * csak azt szimulálja, hogy a kapcsolat megnyílása UTÁN, EGYETLEN válaszon
 * belül milyen kereteket kap a kliens - nem menet közbeni, élő beszúrást.
 */
export async function mockSseFrames(page: Page, frames: readonly StreamFrame[]): Promise<void> {
  await page.route(`${STREAM_ORIGIN}/events**`, async (route) => {
    const body = frames.map((frame) => encodeStreamFrame(frame)).join('');
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body });
  });
}

/**
 * Mint a `mockSseFrames`, de csak az ELSŐ kapcsolatot szolgálja ki
 * (2026-09-26). A lezárt válasz után a böngésző újracsatlakozik (HTML
 * Standard 9.2.2: a törzs végén "reestablish the connection",
 * <https://html.spec.whatwg.org/multipage/server-sent-events.html>), és a
 * `mockSseFrames` ugyanazt a pótlást adná újra, aminek a `replay_complete`
 * kerete a lépés futások és a jóváhagyások újratöltését, tehát a képernyő
 * újrarenderelését váltja ki. Ez az újrarenderelés elfedi azt a hibát, amikor
 * egy számítás a renderelésen kívüli jelre nem futna le (a külső elválasztó
 * húzása és a `userResizeCount`, `docs/research/2026-09-24-jovahagyas-panel-helye.md`
 * 15. szekció). A második és minden további kérés függőben marad: a kezelő
 * egyiket sem hívja a `fulfill`, `continue`, `abort` közül, és a Playwright
 * dokumentációja szerint "every request matching the url pattern will stall
 * unless it's continued, fulfilled or aborted"
 * (<https://playwright.dev/docs/api/class-page#page-route>). Időzítő nincs.
 */
export async function mockSseFramesWithoutReconnect(page: Page, frames: readonly StreamFrame[]): Promise<void> {
  let isServed = false;
  await page.route(`${STREAM_ORIGIN}/events**`, async (route) => {
    if (isServed) {
      return;
    }
    isServed = true;
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
