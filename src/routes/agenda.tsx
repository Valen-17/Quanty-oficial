import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { AppLayout } from "@/components/quanty/AppLayout";
import { PageStub } from "@/components/quanty/PageStub";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda · Quanty" },
      { name: "description", content: "Organiza trabajos, citas y cotizaciones pendientes." },
    ],
  }),
  component: AgendaPage,
});

function AgendaPage() {
  return (
    <AppLayout title="Agenda" subtitle="Organiza trabajos y compromisos.">
      <PageStub
        icon={CalendarDays}
        title="Agenda de trabajos"
        description="Programa visitas, vincula cotizaciones pendientes y recibe recordatorios."
      />
    </AppLayout>
  );
}
