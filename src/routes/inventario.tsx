import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { AppLayout } from "@/components/quanty/AppLayout";
import { PageStub } from "@/components/quanty/PageStub";

export const Route = createFileRoute("/inventario")({
  head: () => ({
    meta: [
      { title: "Inventario · Quanty" },
      { name: "description", content: "Gestiona productos, stock y disponibilidad de tu inventario." },
    ],
  }),
  component: InventarioPage,
});

function InventarioPage() {
  return (
    <AppLayout title="Inventario" subtitle="Controla tus productos, stock y disponibilidad.">
      <PageStub
        icon={Package}
        title="Módulo de Inventario"
        description="Aquí podrás buscar productos, filtrar por disponibilidad, ajustar stock con +/- y agregar/editar productos en un modal."
      />
    </AppLayout>
  );
}
