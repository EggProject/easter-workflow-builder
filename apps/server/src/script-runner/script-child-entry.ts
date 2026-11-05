import process from 'node:process';
import { serveScriptChild } from './serve-script-child.ts';

// A szkript folyamat belépési pontja (SPEC-017 4.1): a szülő ezt a fájlt indítja
// `child_process.fork`-kal (`spawn-script-child.ts`), a Node natív TypeScript
// type strippingjével, mint a szerver `main.ts`-ét.
serveScriptChild(process);
