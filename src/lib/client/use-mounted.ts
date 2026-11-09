"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};
/** true after hydration; avoids setState-in-effect for client-only UI. */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}
