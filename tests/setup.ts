import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-cleans when a global `afterEach` exists, which it does
// not under this vitest config. Without this, a second render of the same page in
// one file finds two copies of every element.
afterEach(() => {
  cleanup();
});
