import { boot } from '../src/boot';
import { resetCapture } from '../src/capture';
import { resetChannel } from '../src/channel';
import type { Frame } from '../src/frame';
import type { LastframePolicy } from '../src/policy';
import { ready } from '../src/ready';
import { openDB } from '../src/storage';

export function navigate(pathname: string): void {
  window.history.replaceState(null, '', pathname);
}

export function renderApp(html: string): HTMLElement {
  const root = document.getElementById('root')!;
  root.innerHTML = html;
  return root;
}

/** First visit: boot finds nothing, the app renders and calls ready(). */
export async function startLiveApp(policy: LastframePolicy, html: string): Promise<void> {
  await boot(policy);
  renderApp(html);
  ready({ transition: false });
}

/**
 * Simulates a reload: page state is dropped, IndexedDB and localStorage stay,
 * and the DOM returns to the empty HTML shell.
 */
export async function reload(): Promise<void> {
  await resetCapture();
  resetChannel();
  document.getElementById('lastframe-overlay')?.remove();
  document.documentElement.removeAttribute('data-lastframe');
  document.body.innerHTML = '<div id="root"></div>';
}

export async function readAllFrames(): Promise<Frame[]> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('frames', 'readonly').objectStore('frames').getAll();
      request.onsuccess = () => resolve(request.result as Frame[]);
      request.onerror = () => reject(request.error ?? new Error('getAll failed'));
    });
  } finally {
    db.close();
  }
}

export async function putRawFrame(value: unknown): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('frames', 'readwrite');
      tx.objectStore('frames').put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('put failed'));
    });
  } finally {
    db.close();
  }
}

export function overlayShadow(): ShadowRoot | null {
  return document.getElementById('lastframe-overlay')?.shadowRoot ?? null;
}

export function flushIdle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
