import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetChannel } from '../src/channel';
import { resetCapture } from '../src/capture';

beforeEach(() => {
  // A fresh factory per test, so frames never leak between tests.
  vi.stubGlobal('indexedDB', new IDBFactory());
  window.history.replaceState(null, '', '/');
  document.head.innerHTML = '';
  document.body.innerHTML = '<div id="root"></div>';
  document.documentElement.removeAttribute('data-lastframe');
  window.localStorage.clear();
  resetChannel();
});

afterEach(async () => {
  await resetCapture();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (globalThis as { __LASTFRAME_DEV__?: boolean }).__LASTFRAME_DEV__;
});
