// Utilidades para ordenar, paginar y exportar tablas.

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  totalPages: number;
  start: number;
}

// Ordena una copia del arreglo; números por valor y textos en orden alfabético.
export function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K> | null,
  getValue: (row: T, key: K) => string | number,
): T[] {
  if (!sort) return rows;
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const valueA = getValue(a, sort.key);
    const valueB = getValue(b, sort.key);
    if (typeof valueA === "number" && typeof valueB === "number") {
      return (valueA - valueB) * factor;
    }
    return String(valueA).localeCompare(String(valueB), "es", { sensitivity: "base" }) * factor;
  });
}

// Ciclo de orden al hacer clic: ascendente, descendente y sin orden.
export function nextSort<K extends string>(
  current: SortState<K> | null,
  key: K,
): SortState<K> | null {
  if (!current || current.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
}

// Devuelve solo las filas de la página pedida.
export function paginate<T>(rows: T[], page: number, pageSize: number): PageResult<T> {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), page: safePage, totalPages, start };
}

// Escapa un valor para CSV y evita que Excel lo ejecute como fórmula.
function csvCell(value: string | number): string {
  if (typeof value === "number") return String(value);
  const text = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Une encabezados y filas en texto CSV separado por punto y coma.
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
}

// Descarga el CSV con BOM para que Excel muestre bien las tildes.
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
