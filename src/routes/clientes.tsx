import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { AppLayout } from "@/components/quanty/AppLayout";
import { PageStub } from "@/components/quanty/PageStub";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes · Quanty" },
      { name: "description", content: "Directorio de clientes con historial de servicios y contacto." },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  return (
    <AppLayout title="Clientes" subtitle="Tu directorio centralizado.">
      <PageStub
        icon={Users}
        title="Gestión de clientes"
        description="Registra clientes, contacto e historial completo de servicios y cotizaciones."
      />
    </AppLayout>
  );
}
