import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { initialsFrom } from "@/lib/names";
import { cn } from "@/lib/utils";

const AVATAR_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const AVATAR_TYPES = Object.keys(AVATAR_EXTENSIONS);

interface AvatarUploaderProps {
  size?: number;
  showHint?: boolean;
}

export function AvatarUploader({ size = 96, showHint = true }: AvatarUploaderProps) {
  const { user } = useAuth();
  const { profile, displayName, updateProfile } = useProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarUrl = profile?.avatar_url || null;
  const initials = initialsFrom(displayName, user?.email);

  const handleFile = async (file: File) => {
    if (!user) return;
    setError(null);

    if (!AVATAR_TYPES.includes(file.type)) {
      setError("Formato no soportado (JPG, PNG o WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Máximo 5 MB.");
      return;
    }

    setBusy(true);
    try {
      const ext = AVATAR_EXTENSIONS[file.type] ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

      const { error: updErr } = await updateProfile({ avatar_url: publicUrl });
      if (updErr) throw updErr;
    } catch {
      setError("No se pudo subir la imagen.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await updateProfile({ avatar_url: null });
    } catch {
      setError("No se pudo eliminar la foto.");
    } finally {
      setBusy(false);
    }
  };

  const dimension = { width: size, height: size };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="group relative shrink-0 overflow-hidden rounded-full ring-2 ring-border transition-all hover:ring-primary/60 disabled:opacity-60"
        style={dimension}
        aria-label="Cambiar foto de perfil"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center bg-[image:var(--gradient-primary)] font-display font-bold text-primary-foreground"
            style={{ fontSize: size * 0.35 }}
          >
            {initials}
          </span>
        )}
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-foreground/40 text-background opacity-0 transition-opacity",
            "group-hover:opacity-100",
            busy && "opacity-100",
          )}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
        </span>
      </button>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-60"
          >
            <Camera className="h-3.5 w-3.5" />
            {avatarUrl ? "Cambiar foto" : "Subir foto"}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-card px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" /> Quitar
            </button>
          )}
        </div>
        {showHint && (
          <p className="text-[11px] text-muted-foreground">JPG, PNG o WEBP · máximo 5 MB</p>
        )}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
