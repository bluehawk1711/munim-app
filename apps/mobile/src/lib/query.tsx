/**
 * Mobile data-layer glue — the app root wraps with QueryProvider and passes
 * its configured ApiClient via `getClient: () => getApi()`. The API key/URL
 * resolution stays in lib/api.ts (AsyncStorage); the shared @munim/query hooks
 * never touch it directly.
 */
import React from 'react';
import {QueryProvider} from '@munim/query';
import {getApi} from './api';

export function MobileQueryProvider({children}: {children: React.ReactNode}) {
  return <QueryProvider getClient={() => getApi()}>{children}</QueryProvider>;
}
