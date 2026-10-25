import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no matchMedia, so any component that asks about a breakpoint throws
// on render. Reports every query as unmatched, which is the narrow layout, and
// is enough for components that only read `matches` once.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// Testing Library only auto-cleans when a global `afterEach` exists, which it does
// not under this vitest config. Without this, a second render of the same page in
// one file finds two copies of every element.
afterEach(() => {
  cleanup();
});
