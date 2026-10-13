"use client";

import * as React from "react";

/**
 * Temporary comparison while this branch is in progress. Press `o` on any
 * dashboard page (local development only) to flip between the previous look
 * and the edits on this branch. Remove this before the branch is merged.
 *
 * Each visual change opts in with useTweak(current, original).
 */
const STORAGE_KEY = "bm-original-look";
const CHANGE_EVENT = "bm-look";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(CHANGE_EVENT, onStoreChange);
}

function getSnapshot() {
  return sessionStorage.getItem(STORAGE_KEY) === "1";
}

function getServerSnapshot() {
  return false;
}

export function LookToggle({ children }: { children: React.ReactNode }) {
  const original = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      if (event.key !== "o" || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      const next = sessionStorage.getItem(STORAGE_KEY) === "1" ? "0" : "1";
      sessionStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      {children}
      {process.env.NODE_ENV === "development" && original ? (
        <div className="pointer-events-none fixed bottom-3 left-3 z-50 rounded-md bg-primary px-2 py-1 text-xs text-bg">
          Original · press o
        </div>
      ) : null}
    </>
  );
}

/** Returns `current` until `o` is pressed, then `original`. */
export function useTweak(current: string, original: string) {
  const showOriginal = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return showOriginal ? original : current;
}

/** True while `o` is showing the committed look, before the edits on this branch. */
export function useOriginalLook() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
