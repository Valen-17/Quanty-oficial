import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Une clases de Tailwind sin conflictos.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
