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
  updateProfile: (data: Profile) => void;
  updatePreferences: (data: Partial<Preferences>) => void;
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
  laborPercent: 20,
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
      updateProfile: (data) => set({ profile: data }),
      updatePreferences: (data) => set((s) => ({ preferences: { ...s.preferences, ...data } })),
      resetAll: () => set({ profile: defaultProfile, preferences: defaultPreferences }),
    }),
    {
      ...buildPersistOptions<SettingsState, SettingsPersisted>({
        name: "quanty-settings-v1",
        version: 3,
        schema: settingsPersistedSchema,
        fallback: () => ({ profile: defaultProfile, preferences: defaultPreferences }),
        partialize: (state) => ({ profile: state.profile, preferences: state.preferences }),
        migrations: {
          2: (state) => ({
            profile: {
              ...state.profile,
              businessName: state.profile.businessName ?? "",
              email: state.profile.email ?? "",
              phone: state.profile.phone ?? "",
              hasEmployees: state.profile.hasEmployees ?? false,
              employeeCount: state.profile.employeeCount ?? 0,
              laborPercent: state.profile.laborPercent ?? 20,
            },
            preferences: { ...defaultPreferences, ...state.preferences },
          }),
          3: (state) => ({
            profile: {
              ...state.profile,
              laborPercent: state.profile.laborPercent ?? 20,
            },
            preferences: { ...defaultPreferences, ...state.preferences },
          }),
        },
      }),
      storage: createScopedJsonStorage(),
    },
  ),
);
