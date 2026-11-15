// Perfil, preferencias y tasa de cambio guardados en el navegador.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  preferencesSchema as domainPreferencesSchema,
  profileSchema as domainProfileSchema,
  settingsPersistedSchema,
  type Preferences as DomainPreferences,
  type Profile as DomainProfile,
  type SettingsPersisted,
} from "@/domain/entities";
import { buildPersistOptions } from "@/lib/persist-helpers";
import { createScopedJsonStorage } from "@/lib/scoped-persist-storage";

export const profileSchema = domainProfileSchema;
export type Profile = DomainProfile;
export const preferencesSchema = domainPreferencesSchema;
export type Preferences = DomainPreferences;
export type Theme = Preferences["theme"];

interface SettingsState {
  profile: Profile;
  preferences: Preferences;
  exchangeRate: number;
  updateProfile: (data: Profile) => void;
  updatePreferences: (data: Partial<Preferences>) => void;
  setExchangeRate: (rate: number) => void;
  resetAll: () => void;
}

const defaultProfile: Profile = {
  fullName: "Tu cuenta",
  businessName: "",
  email: "",
  phone: "",
  currency: "COP",
  language: "es",
  hasEmployees: false,
  employeeCount: 0,
};

const defaultPreferences: Preferences = {
  theme: "light",
  notifyLowStock: true,
  notifyQuoteUpdates: true,
  notifyAgenda: true,
  weeklyDigest: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      profile: defaultProfile,
      preferences: defaultPreferences,
      exchangeRate: 1,
      updateProfile: (data) => set({ profile: data }),
      updatePreferences: (data) => set((s) => ({ preferences: { ...s.preferences, ...data } })),
      setExchangeRate: (rate) => set({ exchangeRate: rate > 0 ? rate : 1 }),
      resetAll: () =>
        set({ profile: defaultProfile, preferences: defaultPreferences, exchangeRate: 1 }),
    }),
    {
      ...buildPersistOptions<SettingsState, SettingsPersisted>({
        name: "quanty-settings-v1",
        version: 4,
        schema: settingsPersistedSchema,
        fallback: () => ({
          profile: defaultProfile,
          preferences: defaultPreferences,
          exchangeRate: 1,
        }),
        partialize: (state) => ({
          profile: state.profile,
          preferences: state.preferences,
          exchangeRate: state.exchangeRate,
        }),
        migrations: {
          2: (state) => ({
            ...state,
            profile: { ...defaultProfile, ...state.profile },
            preferences: { ...defaultPreferences, ...state.preferences },
          }),
          3: (state) => ({
            ...state,
            preferences: { ...defaultPreferences, ...state.preferences },
          }),
          4: (state) => ({
            ...state,
            profile: { ...defaultProfile, ...state.profile },
            preferences: { ...defaultPreferences, ...state.preferences },
          }),
        },
      }),
      storage: createScopedJsonStorage(),
    },
  ),
);
