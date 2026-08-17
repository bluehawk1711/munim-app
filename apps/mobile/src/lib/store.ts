/**
 * Mobile client-state store — one shared-store instance (Zustand) for the
 * active tab + cross-screen UI state. Server data lives in @munim/query.
 */
import {createAppStore} from '@munim/store';

export const useAppStore = createAppStore('home');
