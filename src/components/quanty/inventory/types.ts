import {
  productInputSchema as domainProductInputSchema,
  type Product as DomainProduct,
  type ProductInput as DomainProductInput,
} from "@/domain/entities";

export const productSchema = domainProductInputSchema;
export type ProductInput = DomainProductInput;
export type Product = DomainProduct;

export type Availability = "agotado" | "pocas" | "disponible";

// Estado del producto según sus unidades y el umbral.
export function getAvailability(p: Pick<Product, "units" | "threshold">): Availability {
  if (p.units <= 0) return "agotado";
  if (p.units <= p.threshold) return "pocas";
  return "disponible";
}

export const availabilityLabel: Record<Availability, string> = {
  agotado: "Agotado",
  pocas: "Pocas unidades",
  disponible: "Disponible",
};

export const availabilityStyles: Record<Availability, string> = {
  agotado: "bg-destructive/10 text-destructive",
  pocas: "bg-warning/20 text-warning-foreground",
  disponible: "bg-success/15 text-success",
};
