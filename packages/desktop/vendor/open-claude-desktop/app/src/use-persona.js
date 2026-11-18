import { useSyncExternalStore } from "react";
import { getSnapshot, subscribe } from "./persona-store.mjs";

/** C2: the live persona ({assistantName, greeting, sparkIcon, sparkImage}). */
export function usePersona() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
