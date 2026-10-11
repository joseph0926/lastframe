import { act, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { boot } from '../src/boot';
import { capture } from '../src/capture';
import { getChannel } from '../src/channel';
import { createRoot, useFrameReady } from '../src/react';
import { overlayShadow, reload, startLiveApp } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function revisit(html: string): Promise<void> {
  await startLiveApp({ routes: ['/'] }, html);
  await capture();
  await reload();
  await boot({ routes: ['/'] });
  expect(overlayShadow()).not.toBeNull();
}

describe('createRoot', () => {
  it('renders into the untouched container and removes the frame after the first commit', async () => {
    await revisit('<main>Inbox</main>');
    const container = document.getElementById('root')!;

    const root = createRoot(container, { transition: false });
    act(() => root.render(<main>Live inbox</main>));

    expect(container.innerHTML).toBe('<main>Live inbox</main>');
    expect(overlayShadow()).toBeNull();
    expect(getChannel().status).toBe('live');
    act(() => root.unmount());
  });

  it('accepts fragments and several top-level nodes', async () => {
    await revisit('<main>Inbox</main>');
    const container = document.getElementById('root')!;

    const root = createRoot(container, { transition: false });
    act(() =>
      root.render(
        <>
          <header>Top</header>
          <main>Body</main>
        </>,
      ),
    );

    expect(container.children).toHaveLength(2);
    act(() => root.unmount());
  });

  it('keeps the app mounted across later renders', () => {
    const container = document.getElementById('root')!;
    const root = createRoot(container);
    let mounts = 0;
    function Counter({ label }: { label: string }) {
      useState(() => (mounts += 1));
      return <p>{label}</p>;
    }

    act(() => root.render(<Counter label="one" />));
    act(() => root.render(<Counter label="two" />));

    expect(container.textContent).toBe('two');
    expect(mounts).toBe(1);
    act(() => root.unmount());
  });

  it('holds the frame until useFrameReady(true) with waitForReady', async () => {
    await revisit('<main>Inbox with 3 messages</main>');
    const container = document.getElementById('root')!;
    let finishLoading: () => void = () => {};

    function Inbox() {
      const [loaded, setLoaded] = useState(false);
      finishLoading = () => setLoaded(true);
      useFrameReady(loaded);
      return <main>{loaded ? 'Inbox with 4 messages' : 'Loading…'}</main>;
    }

    const root = createRoot(container, { transition: false, waitForReady: true });
    act(() => root.render(<Inbox />));

    expect(container.textContent).toBe('Loading…');
    expect(overlayShadow()).not.toBeNull();
    expect(getChannel().status).toBe('restored');

    act(() => finishLoading());

    expect(container.textContent).toBe('Inbox with 4 messages');
    expect(overlayShadow()).toBeNull();
    expect(getChannel().status).toBe('live');
    act(() => root.unmount());
  });

  it('captures from the container it was given', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await boot({ routes: ['/'] });
    const container = document.getElementById('app')!;

    const root = createRoot(container);
    act(() => root.render(<main>Custom container</main>));

    expect(await capture()).toMatchObject({ route: '/' });
    act(() => root.unmount());
  });
});
