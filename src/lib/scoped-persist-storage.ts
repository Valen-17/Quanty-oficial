import { createJSONStorage, type StateStorage } from "zustand/middleware";

let scopedUserId: string | null = null;

export function setScopedPersistenceUserId(userId: string | null): void {
  scopedUserId = userId;
}

function scopedKey(storeName: string): string {
  return scopedUserId ? `${storeName}__uid__${scopedUserId}` : `${storeName}__guest`;
}

const underlying: StateStorage = {
  getItem(name) {
    if (typeof localStorage === "undefined") return null;
    const key = scopedKey(name);
    const value = localStorage.getItem(key);
    if (value !== null) return value;
    if (scopedUserId !== null) {
      const legacy = localStorage.getItem(name);
      if (legacy !== null) {
        localStorage.setItem(key, legacy);
        localStorage.removeItem(name);
        return localStorage.getItem(key);
      }
    }
    return null;
  },
  setItem(name, value) {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(scopedKey(name), value);
  },
  removeItem(name) {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(scopedKey(name));
  },
};

export function createScopedJsonStorage() {
  return createJSONStorage(() => underlying);
}
