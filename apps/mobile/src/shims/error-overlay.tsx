import type { ComponentType } from "react";

/** Shim for @expo/metro-runtime/error-overlay (removed in SDK 57 exports). */
export function withErrorOverlay<T extends ComponentType<any>>(Component: T): T {
  return Component;
}
