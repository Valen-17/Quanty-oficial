import { supabase } from "@/integrations/supabase/client";
import type { Quote } from "@/stores/quotesStore";
import { useClientsStore } from "@/stores/clientsStore";
import { useSettingsStore } from "@/stores/settingsStore";

export type QuoteEmailEvent = "created" | "enviada" | "aprobada" | "rechazada";

export type QuoteEmailResult = { ok: true } | { ok: false; error: string };

// Busca el correo del cliente de la cotización.
export function findClientEmail(clientId?: string): string {
  if (!clientId) return "";
  return useClientsStore.getState().clients.find((c) => c.id === clientId)?.email ?? "";
}

// Solo envía los campos que necesita el correo.
function toEmailQuote(quote: Quote) {
  return {
    folio: quote.folio,
    clientName: quote.clientName,
    notes: quote.notes,
    subtotal: quote.subtotal,
    total: quote.total,
    laborWorkers: quote.laborWorkers,
    laborHours: quote.laborHours,
    laborEmployeeAmount: quote.laborEmployeeAmount,
    items: quote.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };
}

// Envía el correo de la cotización con la función de Supabase.
export async function sendQuoteEmail(
  quote: Quote,
  eventType: QuoteEmailEvent,
): Promise<QuoteEmailResult> {
  const clientEmail = findClientEmail(quote.clientId);
  if (!clientEmail) return { ok: false, error: "El cliente no tiene correo registrado." };
  const { profile, exchangeRate } = useSettingsStore.getState();
  try {
    const { error } = await supabase.functions.invoke("send-quote-email", {
      body: {
        quote: toEmailQuote(quote),
        clientEmail,
        businessName: profile.businessName ?? "",
        currency: profile.currency,
        exchangeRate,
        eventType,
      },
    });
    if (error) {
      console.error("send-quote-email failed", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error("send-quote-email failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}
