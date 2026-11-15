// Saca un nombre legible del correo, por ejemplo ana.perez -> Ana Perez.
export function nameFromEmail(email?: string | null): string {
  if (!email) return "";
  const local = email.split("@")[0] ?? "";
  return local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

// Primer nombre de un nombre completo.
export function firstName(fullName?: string | null): string {
  const n = (fullName ?? "").trim();
  if (!n) return "";
  return n.split(/\s+/)[0];
}

// Iniciales para el avatar.
export function initialsFrom(name?: string | null, email?: string | null): string {
  const source = (name && name.trim()) || (email ? email.split("@")[0] : "");
  if (!source) return "U";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase() || source[0].toUpperCase();
}
