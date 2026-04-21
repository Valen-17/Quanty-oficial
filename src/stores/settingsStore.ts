import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";

export const themeSchema = z.enum(["light", "dark", "system"]);
export type Theme = z.infer<typeof themeSchema>;

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: "Mínimo 2 caracteres" })
    .max(80, { message: "Máximo 80 caracteres" }),
  businessName: z
    .string()
    .trim()
    .max(80, { message: "Máximo 80 caracteres" })
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .trim()
    .email({ message: "Correo inválido" })
    .max(120)
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(30, { message: "Máximo 30 caracteres" })
    .optional()
    .or(z.literal("")),
  currency: z.string().min(3).max(5),
  language: z.enum(["es", "en"]),
});
export type Profile = z.infer<typeof profileSchema>;

export const preferencesSchema = z.object({
  theme: themeSchema,
  notifyLowStock: z.boolean(),
  notifyQuoteUpdates: z.boolean(),
  notifyAgenda: z.boolean(),
  weeklyDigest: z.boolean(),
});
export type Preferences = z.infer<typeof preferencesSchema>;

interface SettingsState {
  profile: Profile;
  preferences: Preferences;
  updateProfile: (data: Profile) => void;
  updatePreferences: (data: Partial<Preferences>) => void;
  resetAll: () => void;
}

const defaultProfile: Profile = {
  fullName: "Isabella Arango",
  businessName: "Diseños Quanty",
  email: "isabella@quanty.app",
  phone: "+57 300 555 0000",
  currency: "COP",
  language: "es",
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
      updatePreferences: (data) =>
        set((s) => ({ preferences: { ...s.preferences, ...data } })),
      resetAll: () =>
        set({ profile: defaultProfile, preferences: defaultPreferences }),
    }),
    { name: "quanty-settings-v1" },
  ),
);
