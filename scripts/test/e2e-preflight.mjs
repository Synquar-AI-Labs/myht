import { requireFunctionRuntime } from './function-preflight.mjs';
if (process.env.E2E_API_URL && process.env.E2E_API_URL !== 'http://127.0.0.1:54321') {
  throw new Error('REFUSED: API must be http://127.0.0.1:54321');
}
await requireFunctionRuntime('http://127.0.0.1:54321');
