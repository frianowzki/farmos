"use client";
import { useSyncExternalStore } from "react";
import { playSound } from "@/lib/sounds/sound-engine";
import { clickSoftSound } from "@/lib/sounds/click-soft";
import { confirmation001Sound } from "@/lib/sounds/confirmation-001";
import { successChimeSound } from "@/lib/sounds/success-chime";
import { toggle001Sound } from "@/lib/sounds/toggle-001";

/**
 * Quiet UI sounds (soundcn, CC0 / Kenney). Only ever played in response to a user
 * gesture, so there is no autoplay. Default: on at low volume, unless the user
 * prefers reduced motion, in which case the default is off. Preference persists.
 */
const SOUNDS = {
  check: confirmation001Sound, // task completed
  uncheck: clickSoftSound, // task un-ticked
  allDone: successChimeSound, // every task due today is done / streak extended
  toggle: toggle001Sound, // switches, theme
} as const;
export type UiSound = keyof typeof SOUNDS;

const KEY = "frioos-sound";
const VOLUME: Record<UiSound, number> = { check: 0.22, uncheck: 0.18, allDone: 0.22, toggle: 0.16 };
const listeners = new Set<() => void>();

function readPref(): boolean {
  if (typeof window === "undefined") return false;
  const v = window.localStorage.getItem(KEY);
  if (v === "on") return true;
  if (v === "off") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function setSoundEnabled(on: boolean) {
  window.localStorage.setItem(KEY, on ? "on" : "off");
  listeners.forEach((l) => l());
}

export function useSoundEnabled() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => e.key === KEY && cb();
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    readPref,
    () => false,
  );
}

export function playUi(name: UiSound) {
  if (!readPref()) return;
  try {
    void playSound(SOUNDS[name].dataUri, { volume: VOLUME[name] }).catch(() => undefined);
  } catch {
    /* audio unavailable */
  }
}
