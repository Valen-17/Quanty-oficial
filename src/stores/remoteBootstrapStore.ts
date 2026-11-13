import { create } from "zustand";

export type RemoteBootstrapModule = "clients" | "products" | "quotes" | "expenses" | "agenda";

export type RemoteBootstrapModuleErrors = Partial<Record<RemoteBootstrapModule, string>>;

interface RemoteBootstrapState {
  bootstrapGeneration: number;
  isHydratingRemoteData: boolean;
  lastRemoteSyncAt: number | null;
  remoteBootstrapCompleted: boolean;
  moduleSyncErrors: RemoteBootstrapModuleErrors;
  lastBootstrapUserId: string | null;
  startRemoteBootstrap: (userId: string) => number;
  completeRemoteBootstrap: (
    generation: number,
    at: number,
    errors: RemoteBootstrapModuleErrors,
  ) => void;
  abortRemoteBootstrap: (generation: number) => void;
  resetForGuest: () => void;
}

const initialSlice = {
  bootstrapGeneration: 0,
  isHydratingRemoteData: false,
  lastRemoteSyncAt: null as number | null,
  remoteBootstrapCompleted: false,
  moduleSyncErrors: {} as RemoteBootstrapModuleErrors,
  lastBootstrapUserId: null as string | null,
};

export const useRemoteBootstrapStore = create<RemoteBootstrapState>((set, get) => ({
  ...initialSlice,
  startRemoteBootstrap: (userId) => {
    const generation = get().bootstrapGeneration + 1;
    set({
      bootstrapGeneration: generation,
      isHydratingRemoteData: true,
      remoteBootstrapCompleted: false,
      moduleSyncErrors: {},
      lastBootstrapUserId: userId,
    });
    return generation;
  },
  completeRemoteBootstrap: (generation, at, errors) => {
    if (get().bootstrapGeneration !== generation) return;
    set({
      isHydratingRemoteData: false,
      lastRemoteSyncAt: at,
      remoteBootstrapCompleted: true,
      moduleSyncErrors: errors,
    });
  },
  abortRemoteBootstrap: (generation) => {
    if (get().bootstrapGeneration !== generation) return;
    set({
      isHydratingRemoteData: false,
    });
  },
  resetForGuest: () => set({ ...initialSlice }),
}));
