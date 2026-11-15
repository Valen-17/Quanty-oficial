import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Sparkles, Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { redirect: string; mode: "login" | "signup" } => ({
    redirect: safeRedirectPath(search.redirect),
    mode: search.mode === "signup" ? "signup" : "login",
  }),
  head: () => ({
    meta: [
      { title: "Acceder · Quanty" },
      {
        name: "description",
        content: "Inicia sesión o crea tu cuenta de Quanty para gestionar tu negocio.",
      },
    ],
  }),
  component: AuthPage,
});

// Solo permite redirigir a rutas internas de la app.
function safeRedirectPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.startsWith("/auth")) return "/";
  return value;
}

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Correo inválido" }).max(255),
  password: z.string().min(6, { message: "Mínimo 6 caracteres" }).max(72),
});

const signupSchema = loginSchema.extend({
  fullName: z
    .string()
    .trim()
    .min(2, { message: "Mínimo 2 caracteres" })
    .max(80, { message: "Máximo 80 caracteres" }),
  businessName: z.string().trim().max(80).optional().or(z.literal("")),
  hasEmployees: z.boolean().default(false),
  employeeCount: z.number().int().min(0).max(9999).default(0),
});

// Página para iniciar sesión o crear una cuenta.
function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">(search.mode);
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    businessName: "",
    hasEmployees: false,
    employeeCount: "",
  });

  useEffect(() => {
    if (!loading && user) navigate({ to: search.redirect });
  }, [loading, user, navigate, search.redirect]);

  const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === "login") {
      const parsed = loginSchema.safeParse(form);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
        return;
      }
      setSubmitting(true);
      const { error: err } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      setSubmitting(false);
      if (err) {
        setError(
          err.message.includes("Invalid login") ? "Correo o contraseña incorrectos" : err.message,
        );
        return;
      }
      navigate({ to: search.redirect });
      return;
    }

    const parsed = signupSchema.safeParse({
      ...form,
      hasEmployees: form.hasEmployees,
      employeeCount: form.hasEmployees ? Number(form.employeeCount) || 0 : 0,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const { error: err } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: parsed.data.fullName,
          business_name: parsed.data.businessName ?? "",
          has_employees: parsed.data.hasEmployees,
          employee_count: parsed.data.hasEmployees ? parsed.data.employeeCount : 0,
        },
      },
    });
    setSubmitting(false);
    if (err) {
      setError(
        err.message.includes("already registered") ? "Este correo ya está registrado" : err.message,
      );
      return;
    }
    setInfo("¡Cuenta creada! Revisa tu correo si necesitas confirmar.");
    setMode("login");
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-primary-glow/30 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-elegant)]">
            <Sparkles className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <p className="font-display text-2xl font-bold text-foreground">Quanty</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Insumos · Cotizaciones
            </p>
          </div>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          <div className="mb-6 flex rounded-lg bg-muted p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setInfo(null);
                }}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-all",
                  mode === m
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </button>
            ))}
          </div>

          <h1 className="font-display text-2xl font-bold text-foreground">
            {mode === "login" ? "Bienvenida de vuelta" : "Crea tu cuenta"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Accede a tu panel para gestionar inventario y cotizaciones."
              : "Empieza a centralizar tu negocio en minutos."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Nombre completo
                  </label>
                  <input
                    value={form.fullName}
                    onChange={(e) => setField("fullName", e.target.value)}
                    placeholder="Isabella Arango"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                    autoComplete="name"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Negocio <span className="font-normal text-muted-foreground">(opcional)</span>
                  </label>
                  <input
                    value={form.businessName}
                    onChange={(e) => setField("businessName", e.target.value)}
                    placeholder="Diseños Quanty"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                    autoComplete="organization"
                  />
                </div>
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
                              employeeCount: isYes ? f.employeeCount : "",
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
                      ¿Cuántos empleados?
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={form.employeeCount}
                      onChange={(e) => setField("employeeCount", e.target.value)}
                      placeholder="Ej. 5"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">Correo</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="tu@correo.com"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">Contraseña</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs font-medium text-success">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition-opacity hover:opacity-95 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {mode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
                setInfo(null);
              }}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "login" ? "Crear cuenta" : "Iniciar sesión"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
