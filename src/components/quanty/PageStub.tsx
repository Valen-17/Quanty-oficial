import type { LucideIcon } from "lucide-react";

interface PageStubProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

// Aviso para secciones que aún no existen.
export function PageStub({ icon: Icon, title, description }: PageStubProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
        🚧 Próximamente en esta versión
      </p>
    </div>
  );
}
