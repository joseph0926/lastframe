import { createRoot } from 'lastframe/react';
import { App } from './App';
import { readDelay } from './delay';
import './styles.css';

// Stands in for a slow network: the app waits before it renders, the way a large
// bundle on a phone would. Lastframe's boot script is not delayed.
await new Promise((resolve) => setTimeout(resolve, readDelay()));

createRoot(document.getElementById('root')!).render(<App />);
