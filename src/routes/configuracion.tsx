import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Settings,
  User,
  Bell,
  Palette,
  Shield,
  Save,
  RotateCcw,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { AppLayout } from "@/components/quanty/AppLayout";
import { profileSchema, useSettingsStore, type Profile, type Theme } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { nameFromEmail, useProfile } from "@/hooks/useProfile";
import { AvatarUploader } from "@/components/quanty/AvatarUploader";
import { fetchCopRate } from "@/lib/exchangeRate";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración · Quanty" },
      {
        name: "description",
        content: "Preferencias de perfil, visuales y gestión de cuenta.",
      },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  const profile = useSettingsStore((s) => s.profile);
  const preferences = useSettingsStore((s) => s.preferences);
  const updateLocalProfile = useSettingsStore((s) => s.updateProfile);
  const updatePreferences = useSettingsStore((s) => s.updatePreferences);
  const setExchangeRate = useSettingsStore((s) => s.setExchangeRate);
  const resetAll = useSettingsStore((s) => s.resetAll);

  const { user } = useAuth();
  const {
    profile: cloudProfile,
    updateProfile: updateCloudProfile,
    loading: profileLoading,
  } = useProfile();

  const [form, setForm] = useState<Profile>(profile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const syncedRef = useRef(false);

  useEffect(() => {
    if (profileLoading || syncedRef.current) return;
    syncedRef.current = true;
    setForm((prev) => ({
      ...prev,
      fullName: cloudProfile?.full_name?.trim() || nameFromEmail(user?.email) || prev.fullName,
      businessName: cloudProfile?.business_name ?? prev.businessName ?? "",
      phone: cloudProfile?.phone ?? prev.phone ?? "",
      email: user?.email ?? prev.email ?? "",
      hasEmployees: cloudProfile?.has_employees ?? prev.hasEmployees ?? false,
      employeeCount: cloudProfile?.employee_count ?? prev.employeeCount ?? 0,
    }));
  }, [cloudProfile, user, profileLoading]);

  useEffect(() => {
    fetchCopRate(profile.currency).then(setExchangeRate);
  }, [profile.currency, setExchangeRate]);

  const handleSave = async () => {
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    // Persiste preferencias locales (moneda, idioma)
    updateLocalProfile(parsed.data);
    // Persiste perfil en Supabase
    const { error } = await updateCloudProfile({
      full_name: parsed.data.fullName,
      business_name: parsed.data.businessName ?? "",
      phone: parsed.data.phone ?? "",
      has_employees: parsed.data.hasEmployees,
      employee_count: parsed.data.hasEmployees ? parsed.data.employeeCount : 0,
    });
    setSaving(false);
    if (error) {
      setErrors({ fullName: "No se pudo guardar en la nube" });
      return;
    }
    setSavedAt(Date.now());
  };

  const setField = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Oscuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Monitor },
  ];

  return (
    <AppLayout title="Configuración" subtitle="Personaliza tu cuenta y preferencias.">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] xl:col-span-2">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Perfil</h2>
              <p className="text-xs text-muted-foreground">Datos personales y de tu negocio</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-background/60 p-4">
              <AvatarUploader size={88} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Nombre completo
                </label>
                <input
                  value={form.fullName}
                  onChange={(e) => setField("fullName", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
                {errors.fullName && (
                  <p className="mt-1 text-xs text-destructive">{errors.fullName}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Negocio</label>
                <input
                  value={form.businessName}
                  onChange={(e) => setField("businessName", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Correo</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Teléfono</label>
                <input
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Moneda</label>
                <select
                  value={form.currency}
                  onChange={(e) => setField("currency", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                >
                  <option value="COP">COP — Peso colombiano</option>
                  <option value="USD">USD — Dólar</option>
                  <option value="MXN">MXN — Peso mexicano</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Idioma</label>
                <select
                  value={form.language}
                  onChange={(e) => setField("language", e.target.value as "es" | "en")}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-background/60 p-4">
              <div>
                <p className="mb-2 text-xs font-semibold text-foreground">¿Tienes empleados?</p>
                <div className="flex gap-3">
                  {(["Sí", "No"] as const).map((opt) => {
                    const isYes = opt === "Sí";
                    const active = form.hasEmployees === isYes;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            hasEmployees: isYes,
                            employeeCount: isYes ? f.employeeCount : 0,
                          }))
                        }
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input bg-background text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
              {form.hasEmployees && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Número de empleados
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={form.employeeCount || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        employeeCount: Math.max(0, parseInt(e.target.value, 10) || 0),
                      }))
                    }
                    placeholder="Ej. 5"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
              {savedAt && <span className="mr-auto text-xs text-success">✓ Cambios guardados</span>}
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] disabled:opacity-60"
              >
                <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">Apariencia</h2>
                <p className="text-xs text-muted-foreground">Tema visual de la app</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => updatePreferences({ theme: value })}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-semibold transition-colors",
                    preferences.theme === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              El cambio se aplica al instante. "Sistema" usa la preferencia de tu dispositivo.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">Notificaciones</h2>
                <p className="text-xs text-muted-foreground">Avisos automáticos</p>
              </div>
            </div>
            <ul className="space-y-3">
              {[
                { key: "notifyLowStock", label: "Alertas de stock bajo" },
                { key: "notifyQuoteUpdates", label: "Actualizaciones de cotización" },
                { key: "notifyAgenda", label: "Recordatorios de agenda" },
                { key: "weeklyDigest", label: "Resumen semanal por correo" },
              ].map(({ key, label }) => (
                <li key={key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">{label}</span>
                  <button
                    onClick={() =>
                      updatePreferences({
                        [key]: !preferences[key as keyof typeof preferences],
                      } as Partial<typeof preferences>)
                    }
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                      preferences[key as keyof typeof preferences] ? "bg-primary" : "bg-muted",
                    )}
                    aria-pressed={!!preferences[key as keyof typeof preferences]}
                  >
                    <span
                      className={cn(
                        "inline-block h-3.5 w-3.5 transform rounded-full bg-card shadow transition-transform",
                        preferences[key as keyof typeof preferences]
                          ? "translate-x-5"
                          : "translate-x-1",
                      )}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">Zona delicada</h2>
                <p className="text-xs text-muted-foreground">
                  Restablece tu perfil a los valores por defecto.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm("¿Restablecer perfil y preferencias?")) {
                  resetAll();
                  setSavedAt(null);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-card px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restablecer
            </button>
          </div>
        </section>
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Settings className="h-3.5 w-3.5" />
        Quanty v1.0 · Datos guardados localmente en tu dispositivo
      </div>
    </AppLayout>
  );
}
