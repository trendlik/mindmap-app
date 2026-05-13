/// <reference types="vite/client" />

declare const __COMMIT_HASH__: string;

interface Window {
  __PLAYWRIGHT_TEST_USER__?: { uid: string; email: string; displayName: string };
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
