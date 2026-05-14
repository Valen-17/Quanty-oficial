import { supabase } from "@/integrations/supabase/client";
import type { Quote } from "@/stores/quotesStore";

export async function sendQuoteEmail(
  quote: Quote,
  clientEmail: string,
  businessName: string,
  currency: string,
): Promise<void> {
  if (!clientEmail) return;
  try {
    await supabase.functions.invoke("send-quote-email", {
      body: { quote, clientEmail, businessName, currency },
    });
  } catch {
  }
}
