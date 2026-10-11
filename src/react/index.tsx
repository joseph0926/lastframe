import { createContext, createElement, useContext, useLayoutEffect, type ReactNode } from 'react';
import { createRoot as createReactRoot, type Root, type RootOptions } from 'react-dom/client';
import { ready } from '../ready';

export interface LastframeRootOptions extends RootOptions {
  /** Cross-fade from the frame to the live UI with the View Transitions API. Default: `true`. */
  transition?: boolean;
  /**
   * Keep the frame up after the first render until a component calls
   * `useFrameReady(true)`. Use it when the first render is a loading state.
   * The policy's `timeout` still applies. Default: `false`.
   */
  waitForReady?: boolean;
}

interface FrameContextValue {
  container: Element;
  transition: boolean;
}

const FrameContext = createContext<FrameContextValue | null>(null);

interface BoundaryProps {
  value: FrameContextValue;
  waitForReady: boolean;
  children: ReactNode;
}

function FrameBoundary({ value, waitForReady, children }: BoundaryProps) {
  // Layout effects run after React commits the DOM and before the browser paints,
  // so the frame and the live UI swap within one painted frame.
  useLayoutEffect(() => {
    if (!waitForReady) ready({ transition: value.transition, root: value.container });
  }, [value, waitForReady]);

  return createElement(FrameContext.Provider, { value }, children);
}

/**
 * Marks the live UI as ready when `isReady` becomes true, removing the frame.
 * Only needed with `createRoot(container, { waitForReady: true })`.
 *
 * @example
 * const { data } = useQuery(...);
 * useFrameReady(data !== undefined);
 */
export function useFrameReady(isReady = true): void {
  const context = useContext(FrameContext);
  useLayoutEffect(() => {
    if (!isReady) return;
    ready({ transition: context?.transition ?? true, root: context?.container ?? null });
  }, [isReady, context]);
}

/**
 * Drop-in replacement for `createRoot` from `react-dom/client`. The app renders
 * into an untouched container while the frame stays painted above it, and the
 * frame is removed once React commits (or once `useFrameReady` says so).
 *
 * @example
 * import { createRoot } from 'lastframe/react';
 * createRoot(document.getElementById('root')!).render(<App />);
 */
export function createRoot(container: Element, options: LastframeRootOptions = {}): Root {
  const { transition = true, waitForReady = false, ...rootOptions } = options;
  const root = createReactRoot(container, rootOptions);
  const value: FrameContextValue = { container, transition };

  return {
    render(children: ReactNode) {
      root.render(createElement(FrameBoundary, { value, waitForReady, children }));
    },
    unmount() {
      root.unmount();
    },
  };
}
