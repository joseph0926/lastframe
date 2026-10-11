import { boot } from './boot';

declare const __LASTFRAME_POLICY__: unknown;

// Entry of the injected boot script. The build helper wraps this IIFE in a function
// whose parameter `__LASTFRAME_POLICY__` carries the policy resolved at build time.
void boot(__LASTFRAME_POLICY__);
