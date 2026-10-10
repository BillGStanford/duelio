import os from 'os';
import path from 'path';
import { FileStore } from './file';
import { SupabaseStore } from './supabase';
import type { Store } from './types';

declare global {
  // eslint-disable-next-line no-var
  var __duelioStore: Store | undefined;
}

export function storeKind(): 'supabase' | 'file' {
  return process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'file';
}

export function getStore(): Store {
  if (globalThis.__duelioStore) return globalThis.__duelioStore;
  let store: Store;
  if (storeKind() === 'supabase') {
    store = new SupabaseStore(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    );
  } else {
    const dir =
      process.env.DUELIO_DATA_DIR ||
      (process.env.VERCEL ? path.join(os.tmpdir(), 'duelio') : path.join(process.cwd(), '.data'));
    store = new FileStore(path.join(dir, 'duelio.json'));
  }
  globalThis.__duelioStore = store;
  return store;
}
