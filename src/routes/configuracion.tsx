import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { AppLayout } from "@/components/quanty/AppLayout";
import { PageStub } from "@/components/quanty/PageStub";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración · Quanty" },
      { name: "description", content: "Preferencias de perfil, visuales y gestión de cuenta." },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  return (
    <AppLayout title="Configuración" subtitle="Personaliza tu cuenta y preferencias.">
      <PageStub
        icon={Settings}
        title="Perfil y preferencias"
        description="Gestiona tu perfil, preferencias visuales (tema, idioma) y datos de la cuenta."
      />
    </AppLayout>
  );
}
