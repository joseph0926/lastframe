import { useEffect, useState } from 'react';
import {
  capture,
  clearFrames,
  getRestoredFrame,
  onCapture,
  stopCapture,
  type CapturedFrame,
} from 'lastframe';
import { MAX_DELAY, readDelay, writeDelay } from './delay';
import { SupportQueue } from './SupportQueue';

const BASE = import.meta.env.BASE_URL;
const isMaskedPage = /\/masked\/?$/.test(window.location.pathname);

function formatAge(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.round(minutes / 60)} h`;
}

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="7" y="5" width="20" height="20" rx="4" className="logo-ghost-a" />
      <rect x="5" y="7" width="20" height="20" rx="4" className="logo-ghost-b" />
      <rect x="6" y="6" width="20" height="20" rx="4" className="logo-frame" />
      <rect x="10.5" y="10.5" width="11" height="3" rx="1.5" className="logo-line" />
      <rect x="10.5" y="16" width="7" height="3" rx="1.5" className="logo-line is-faint" />
    </svg>
  );
}

function Timeline({ paintedAt, liveAt }: { paintedAt: number | null; liveAt: number }) {
  const scale = Math.max(liveAt, 1);
  const framePosition = paintedAt === null ? null : Math.min(paintedAt / scale, 1) * 100;

  return (
    <figure className="timeline" aria-label="What this visit showed while the app loaded">
      <div className="timeline-track">
        {framePosition === null ? (
          <span className="timeline-blank" style={{ width: '100%' }} />
        ) : (
          <>
            <span className="timeline-blank" style={{ width: `${framePosition}%` }} />
            <span
              className="timeline-frame"
              style={{ left: `${framePosition}%`, width: `${100 - framePosition}%` }}
            />
          </>
        )}
      </div>
      <figcaption className="timeline-legend">
        {paintedAt === null ? (
          <span>Blank or loading screen until the app arrived at {liveAt} ms</span>
        ) : (
          <>
            <span>Last frame on screen at {paintedAt} ms</span>
            <span>Live app at {liveAt} ms</span>
          </>
        )}
      </figcaption>
    </figure>
  );
}

function Readout() {
  const [frame] = useState(getRestoredFrame);
  const [liveAt] = useState(() => Math.round(performance.now()));
  const [saved, setSaved] = useState<CapturedFrame | null>(null);
  useEffect(() => onCapture(setSaved), []);

  const paintedAt = frame
    ? Math.max(0, Math.round(frame.paintedAt - performance.timeOrigin))
    : null;

  return (
    <div className="readout" aria-live="polite">
      {frame ? (
        <p>
          This visit opened on a frame captured {formatAge(frame.paintedAt - frame.capturedAt)}{' '}
          before. The live app replaced it when it was ready.
        </p>
      ) : (
        <p>
          No frame existed for this page, so you saw what a client-rendered app usually shows.{' '}
          {saved
            ? `A ${(saved.bytes / 1024).toFixed(0)} KB frame is saved now. Reload to see it.`
            : 'Lastframe saves one as soon as the page is idle.'}
        </p>
      )}
      <Timeline paintedAt={paintedAt} liveAt={liveAt} />
    </div>
  );
}

function Controls() {
  const [delay, setDelay] = useState(readDelay);

  const reload = async () => {
    await capture();
    window.location.reload();
  };

  const clearAndReload = async () => {
    // Otherwise the reload's own pagehide capture would store a new frame.
    stopCapture();
    await clearFrames();
    window.location.reload();
  };

  return (
    <div className="controls">
      <button type="button" className="button is-primary" onClick={() => void reload()}>
        Reload this page
      </button>
      <label className="delay">
        <span>
          Simulated bundle load <output>{(delay / 1000).toFixed(1)} s</output>
        </span>
        <input
          type="range"
          min={0}
          max={MAX_DELAY}
          step={500}
          value={delay}
          onChange={(event) => {
            const next = Number(event.target.value);
            setDelay(next);
            writeDelay(next);
          }}
        />
      </label>
      <button type="button" className="button is-quiet" onClick={() => void clearAndReload()}>
        Clear frames and reload
      </button>
    </div>
  );
}

const STEPS = [
  {
    title: 'Capture',
    body: 'While the page is idle and when the user leaves, Lastframe serializes your app root and its CSS into IndexedDB, keyed by route. Masked and excluded parts never reach storage.',
  },
  {
    title: 'Paint',
    body: 'On the next visit a boot script of about 4 KB gzipped reads that frame and paints it in an inert overlay, typically within a few dozen milliseconds, before your bundle has even downloaded.',
  },
  {
    title: 'Hand off',
    body: 'Your app renders into its own untouched container underneath. When it calls ready(), the frame cross-fades to the live UI in a single paint.',
  },
];

const VITE_CONFIG = `// vite.config.ts
import { lastframe } from 'lastframe/vite';

export default defineConfig({
  plugins: [
    react(),
    lastframe({ routes: ['/', '/inbox', '/projects/:id'] }),
  ],
});`;

const ENTRY = `// main.tsx
import { createRoot } from 'lastframe/react';

createRoot(document.getElementById('root')!).render(<App />);`;

const VANILLA = `// Vue, Svelte, Solid, or plain DOM
import { ready } from 'lastframe';

createApp(App).mount('#root');
ready();`;

export function App() {
  return (
    <>
      <header className="site-header">
        <a className="wordmark" href={BASE}>
          <Logo />
          lastframe
        </a>
        <nav className="site-nav" aria-label="Project">
          <a href="https://github.com/joseph0926/lastframe#readme">Docs</a>
          <a href="https://github.com/joseph0926/lastframe">GitHub</a>
          <a href="https://www.npmjs.com/package/lastframe">npm</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="frame-note">Replaying the last frame. The live app is still loading.</p>
            <h1>Your app’s last frame, painted before your JavaScript arrives.</h1>
            <p className="lede">
              Lastframe remembers what each page looked like when your user left and shows it again
              on the next visit, while the bundle downloads. No server rendering, no framework
              migration.
            </p>
            <Controls />
            <Readout />
            <p className="mode-switch">
              {isMaskedPage ? (
                <>
                  Masked mode stores the queue as a skeleton, so names and numbers never touch the
                  disk. <a href={BASE}>See the full replay</a>
                </>
              ) : (
                <>
                  Showing private data? <a href={`${BASE}masked/`}>Try masked mode</a>, which
                  replays the layout without the content.
                </>
              )}
            </p>
          </div>
          <SupportQueue />
        </section>

        <section className="steps" aria-labelledby="steps-title">
          <h2 id="steps-title">How a revisit works</h2>
          <ol>
            {STEPS.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="start" aria-labelledby="start-title">
          <div className="start-intro">
            <h2 id="start-title">Two edits to an existing app</h2>
            <p>
              Install it, list the routes worth replaying, and swap one import. Vite 7 and 8 are
              supported; other bundlers can inline the script from <code>lastframe/build</code>.
            </p>
            <pre className="install">
              <code>npm install lastframe</code>
            </pre>
          </div>
          <div className="start-code">
            <pre>
              <code>{VITE_CONFIG}</code>
            </pre>
            <pre>
              <code>{ENTRY}</code>
            </pre>
            <pre>
              <code>{VANILLA}</code>
            </pre>
          </div>
        </section>

        <section className="fit" aria-labelledby="fit-title">
          <h2 id="fit-title">Where it fits</h2>
          <div className="fit-grid">
            <div>
              <h3>A good match</h3>
              <ul>
                <li>Dashboards, admin panels, CRMs, and other tools people reopen all day</li>
                <li>Client-rendered apps where SSR is not an option</li>
                <li>Slow devices and networks, where the bundle takes seconds</li>
              </ul>
            </div>
            <div>
              <h3>Reach for something else</h3>
              <ul>
                <li>First visits and SEO: use server rendering or static generation</li>
                <li>Screens that must never show stale data, even for a second</li>
                <li>Pages visited once, where there is no last frame to show</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>
          MIT licensed. Lastframe is the successor of FirstTx Prepaint.{' '}
          <a href="https://github.com/joseph0926/lastframe">Source on GitHub</a>
        </p>
      </footer>
    </>
  );
}
