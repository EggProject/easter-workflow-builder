import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import { setImmediate } from 'node:timers/promises';
import { maskSecrets } from './mask-secrets.ts';
import { PROBE_PORT_REPORT_PREFIX } from './probe-port-report.ts';

/**
 * A gyermek szerver indítása és a portjának forrása.
 *
 * - `reports-port`: a gyermek `EASTER_SERVER_PORT=0` értéket kap, maga köt az
 *   operációs rendszer által kiosztott portra, és a stdout első sorában
 *   jelenti (`probe-port-report.ts`). A hamis ágenses szerver ezt teszi.
 * - `assigned-port`: a hívó adja a portot. A valódi `src/main.ts` csak pozitív
 *   portot fogad (`readServerConfig`), ezért a valódi próba ezt használja; itt a
 *   szabad port választása és a gyermek kötése között ablak marad, amiben egy
 *   másik folyamat elveheti a portot.
 */
export type ProbeServerCommand =
  | { readonly kind: 'reports-port'; readonly executable: string; readonly args: readonly string[] }
  | {
      readonly kind: 'assigned-port';
      readonly executable: string;
      readonly args: readonly string[];
      readonly port: number;
    };

export interface ProbeServer {
  readonly baseUrl: string;
  stop(): Promise<void>;
}

interface ExitState {
  exited: boolean;
  description: string;
}

type ProbeChild = ChildProcessByStdio<null, Readable, Readable>;

/**
 * A próba saját szerver folyamata (SPEC-012 5.1, O-13): gyermek folyamat a
 * kapott környezettel, a stderr memóriában gyűlik (maszkolva kerül hibaüzenetbe,
 * lemezre nem kerül). A port a `command.kind` szerint a gyermek jelentéséből
 * vagy a hívótól jön. A függvény ezután a `GET /api/providers` `200` válaszára
 * vár; a lekérdezések között nincs kitalált várakozási idő, a kapcsolat
 * elutasítása gyors, a ciklus az eseményhurkot minden körben átengedi. Ha a
 * folyamat előbb kilép, hiba jön.
 */
export async function startProbeServer(
  command: ProbeServerCommand,
  environment: NodeJS.ProcessEnv,
  secretValues: readonly string[],
  signal: AbortSignal,
): Promise<ProbeServer> {
  signal.throwIfAborted();
  const requestedPort = command.kind === 'assigned-port' ? command.port : 0;
  const child = spawn(command.executable, [...command.args], {
    env: { ...environment, EASTER_SERVER_PORT: String(requestedPort) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exitState: ExitState = { exited: false, description: '' };
  let standardError = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    standardError += chunk;
  });
  const exited = new Promise<void>((resolve) => {
    child.once('close', (code, exitSignal) => {
      exitState.exited = true;
      exitState.description = `kilépési kód: ${String(code)}, jel: ${String(exitSignal)}`;
      resolve();
    });
  });
  const stop = async (): Promise<void> => {
    if (!exitState.exited) {
      child.kill('SIGTERM');
    }
    await exited;
  };
  const exitedEarlyError = (): Error =>
    new Error(
      `A szerver a kapcsolat fogadása előtt leállt (${exitState.description}). stderr: ${maskSecrets(standardError, secretValues)}`,
    );

  try {
    const port = command.kind === 'assigned-port' ? command.port : await readReportedPort(child, exited, signal);
    signal.throwIfAborted();
    if (port === undefined) {
      throw exitedEarlyError();
    }
    const baseUrl = `http://127.0.0.1:${String(port)}`;
    for (;;) {
      signal.throwIfAborted();
      if (exitState.exited) {
        throw exitedEarlyError();
      }
      const status = await fetchProvidersStatus(baseUrl, signal);
      if (status === 200) {
        return { baseUrl, stop };
      }
      if (status !== undefined) {
        throw new Error(`A GET /api/providers nem 200 választ adott (${String(status)}).`);
      }
      await setImmediate();
    }
  } catch (error) {
    await stop();
    throw error;
  }
}

/**
A gyermek első stdout sorából a jelentett port; `undefined`, ha a gyermek a sor előtt kilépett (a megszakítás a
gyermeket leállítja, tehát ide fut ki).
*/
function readReportedPort(child: ProbeChild, exited: Promise<void>, signal: AbortSignal): Promise<number | undefined> {
  signal.addEventListener(
    'abort',
    () => {
      child.kill('SIGTERM');
    },
    { once: true },
  );
  return new Promise((resolve, reject) => {
    let standardOutput = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      standardOutput += chunk;
      const lineEnd = standardOutput.indexOf('\n');
      if (lineEnd === -1) {
        return;
      }
      const line = standardOutput.slice(0, lineEnd);
      const port = Number(line.slice(PROBE_PORT_REPORT_PREFIX.length));
      if (line.startsWith(PROBE_PORT_REPORT_PREFIX) && Number.isSafeInteger(port) && port > 0) {
        resolve(port);
      } else {
        reject(new Error(`A szerver első stdout sora nem portjelentés: ${line}`));
      }
    });
    void exited.then(() => {
      resolve(undefined);
    });
  });
}

/**
`undefined`, ha a szerver még nem fogad kapcsolatot.
*/
async function fetchProvidersStatus(baseUrl: string, signal: AbortSignal): Promise<number | undefined> {
  try {
    const response = await fetch(`${baseUrl}/api/providers`, { signal });
    await response.arrayBuffer();
    return response.status;
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof TypeError) {
      return undefined;
    }
    throw error;
  }
}
