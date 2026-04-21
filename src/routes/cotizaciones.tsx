import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { AppLayout } from "@/components/quanty/AppLayout";
import { PageStub } from "@/components/quanty/PageStub";

export const Route = createFileRoute("/cotizaciones")({
  head: () => ({
    meta: [
      { title: "Cotizaciones · Quanty" },
      { name: "description", content: "Crea cotizaciones con cálculo automático de mano de obra y exporta a PDF." },
    ],
  }),
  component: CotizacionesPage,
});

function CotizacionesPage() {
  return (
    <AppLayout title="Cotizaciones" subtitle="Genera propuestas comerciales en segundos.">
      <PageStub
        icon={FileText}
        title="Nueva cotización"
        description="Selecciona cliente, elige insumos del inventario, define el % de mano de obra y exporta el PDF estructurado."
      />
    </AppLayout>
  );
}
