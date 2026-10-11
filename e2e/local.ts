import { execFileSync } from 'node:child_process';

export const API_URL = 'http://127.0.0.1:54321';
export const MAIL_URL = 'http://127.0.0.1:54324';
export function localStack() {
  if (process.env.E2E_API_URL && process.env.E2E_API_URL !== API_URL) {
    throw new Error('REFUSED: E2E_API_URL must be exactly ' + API_URL);
  }
  const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8' }));
  if (status.API_URL !== API_URL || status.DB_URL !== 'postgresql://postgres:postgres@127.0.0.1:54322/postgres') {
    throw new Error('REFUSED: e2e requires the local Supabase stack only');
  }
  return status as { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
}
