declare global {
  interface Window {
    /** Overrides the pathname used as the frame key, for apps that route by hash or query. */
    __LASTFRAME_ROUTE__?: string | (() => string);
  }
}

export {};
