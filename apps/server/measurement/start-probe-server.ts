import { spawn } from 'node:child_process';
import { setImmediate } from 'node:timers/promises';
import { maskSecrets } from './mask-secrets.ts';

export interface ProbeServerCommand {
  readonly executable: string;
  readonly args: readonly string[];
}

export interface ProbeServer {
  readonly baseUrl: string;
  stop(): Promise<void>;
}

interface ExitState {
  exited: boolean;
  description: string;
}

/**
 * A próba saját szerver folyamata (SPEC-012 5.1, O-13): gyermek folyamat a
 * kapott környezettel, a stderr memóriában gyűlik (maszkolva kerül hibaüzenetbe,
 * lemezre nem kerül). A függvény a `GET /api/providers` `200` válaszára vár;
 * a lekérdezések között nincs kitalált várakozási idő, a kapcsolat elutasítása
 * gyors, a ciklus az eseményhurkot minden körben átengedi. Ha a folyamat
 * előbb kilép, hiba jön.
 */
export async function startProbeServer(
  command: ProbeServerCommand,
  environment: NodeJS.ProcessEnv,
  port: number,
  secretValues: readonly string[],
  signal: AbortSignal,
): Promise<ProbeServer> {
  const child = spawn(command.executable, [...command.args], { env: environment, stdio: ['ignore', 'ignore', 'pipe'] });
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

  const baseUrl = `http://127.0.0.1:${String(port)}`;
  const server: ProbeServer = {
    baseUrl,
    stop: async () => {
      if (!exitState.exited) {
        child.kill('SIGTERM');
      }
      await exited;
    },
  };

  try {
    for (;;) {
      signal.throwIfAborted();
      if (exitState.exited) {
        throw new Error(
          `A szerver a kapcsolat fogadása előtt leállt (${exitState.description}). stderr: ${maskSecrets(standardError, secretValues)}`,
        );
      }
      const status = await fetchProvidersStatus(baseUrl, signal);
      if (status === 200) {
        return server;
      }
      if (status !== undefined) {
        throw new Error(`A GET /api/providers nem 200 választ adott (${String(status)}).`);
      }
      await setImmediate();
    }
  } catch (error) {
    await server.stop();
    throw error;
  }
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
