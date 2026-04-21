import { z } from "zod";

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "El nombre debe tener al menos 2 caracteres" })
    .max(80, { message: "El nombre no puede superar 80 caracteres" }),
  description: z
    .string()
    .trim()
    .max(240, { message: "La descripción no puede superar 240 caracteres" })
    .optional()
    .or(z.literal("")),
  price: z
    .number({ invalid_type_error: "El precio debe ser un número" })
    .nonnegative({ message: "El precio no puede ser negativo" })
    .max(999_999_999, { message: "Precio demasiado alto" }),
  units: z
    .number({ invalid_type_error: "Las unidades deben ser un número" })
    .int({ message: "Las unidades deben ser un entero" })
    .min(0, { message: "Las unidades no pueden ser negativas" })
    .max(999_999, { message: "Cantidad demasiado alta" }),
  threshold: z
    .number({ invalid_type_error: "El umbral debe ser un número" })
    .int({ message: "El umbral debe ser un entero" })
    .min(1, { message: "El umbral mínimo es 1" })
    .max(9_999, { message: "Umbral demasiado alto" }),
  imageUrl: z
    .string()
    .max(2_000_000, { message: "Imagen demasiado grande" })
    .optional()
    .or(z.literal("")),
});

export type ProductInput = z.infer<typeof productSchema>;

export interface Product extends ProductInput {
  id: string;
  description: string;
  imageUrl: string;
}

export type Availability = "agotado" | "pocas" | "disponible";

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
