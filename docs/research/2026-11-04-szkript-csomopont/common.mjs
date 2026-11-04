// Közös betöltő: quickjs-emscripten-core + az alap (bellard, szinkron, release) variáns.
import variant from '@jitl/quickjs-wasmfile-release-sync';
import { newQuickJSWASMModuleFromVariant, shouldInterruptAfterDeadline } from 'quickjs-emscripten-core';

export { shouldInterruptAfterDeadline };
export const loadModule = () => newQuickJSWASMModuleFromVariant(variant);
export const log = (id, data) => console.log(`MEASUREMENT ${JSON.stringify({ id, ...data })}`);
