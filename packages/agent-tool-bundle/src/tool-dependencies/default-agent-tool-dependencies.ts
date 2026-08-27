import { readFile } from 'node:fs/promises';
import process from 'node:process';
import type { AgentToolDependencies } from './agent-tool-dependencies.ts';

/**
 * A termékkód alapértelmezett függőségei: a Node beépített `fetch` és
 * fájlolvasó függvénye, valamint a folyamat környezeti változói.
 */
export const defaultAgentToolDependencies: AgentToolDependencies = {
  fetchFunction: globalThis.fetch.bind(globalThis),
  environment: process.env,
  readFileFunction: readFile,
};
