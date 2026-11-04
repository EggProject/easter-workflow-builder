import { isRecordWithKnownKeys, isString, isStringRecord } from '@easter-workflow-builder/typeguards';
import type { SandboxFetchInit } from './sandbox-fetch-init.ts';

const SANDBOX_FETCH_INIT_KEYS: Readonly<Record<keyof SandboxFetchInit, true>> = {
  method: true,
  headers: true,
  body: true,
};

/**
 * A `fetch` második argumentuma a dokumentált alakú-e: objektum, kizárólag a
 * `SandboxFetchInit` kulcsaival, és minden jelen lévő mező a típusának
 * megfelelő. Az ismeretlen kulcs elutasítva, a projekt zárt kulcslistás
 * guardjainak mintájára (`isRecordWithKnownKeys`).
 */
export function isSandboxFetchInit(value: unknown): value is SandboxFetchInit {
  return (
    isRecordWithKnownKeys(value, SANDBOX_FETCH_INIT_KEYS) &&
    (value.method === undefined || isString(value.method)) &&
    (value.headers === undefined || isStringRecord(value.headers)) &&
    (value.body === undefined || isString(value.body))
  );
}
