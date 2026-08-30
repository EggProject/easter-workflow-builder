import process from 'node:process';
import { runStartupSequence } from './startup-sequence/run-startup-sequence.ts';

await runStartupSequence(process.env, process.cwd());
