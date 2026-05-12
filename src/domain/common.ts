import { z } from "zod";

export const idSchema = z.string().trim().min(1);
export const timestampSchema = z.number().int().nonnegative();

export function nowTs() {
  return Date.now();
}

export function createEntityId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}
