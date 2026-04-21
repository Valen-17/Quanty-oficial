import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { AppLayout } from "@/components/quanty/AppLayout";
import { PageStub } from "@/components/quanty/PageStub";

export const Route = createFileRoute("/balance")({
  head: () => ({
    meta: [
      { title: "Balance · Quanty" },
      { name: "description", content: "Desglose de costos fijos y variables, y cálculo de ganancias." },
    ],
  }),
  component: BalancePage,
});

function BalancePage() {
  return (
    <AppLayout title="Balance" subtitle="Costos fijos, variables y ganancias automáticas.">
      <PageStub
        icon={Wallet}
        title="Módulo financiero"
        description="Visualiza ingresos vs. gastos, registra costos fijos (arriendo, servicios, trabajadores) y variables."
      />
    </AppLayout>
  );
}
