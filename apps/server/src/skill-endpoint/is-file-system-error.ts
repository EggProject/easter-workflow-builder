import { isString } from '@easter-workflow-builder/typeguards';

/**
 * A Node fájlrendszer hívás hibája (`SystemError`): `Error` példány a `code`
 * (például `ENAMETOOLONG`) és a `syscall` (például `open`, `mkdir`) szöveg
 * mezővel (<https://nodejs.org/api/errors.html#class-systemerror>). A `yauzl`
 * és a `zlib` hibája nem ilyen: az elsőnek nincs `code` mezője, a másodiknak
 * nincs `syscall` mezője.
 */
export interface FileSystemError extends Error {
  readonly code: string;
  readonly syscall: string;
}

export function isFileSystemError(value: unknown): value is FileSystemError {
  return (
    value instanceof Error && 'code' in value && isString(value.code) && 'syscall' in value && isString(value.syscall)
  );
}
