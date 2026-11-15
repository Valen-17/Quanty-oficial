import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

interface Props {
  page: number;
  totalPages: number;
  pageSize: number;
  start: number;
  shown: number;
  totalFiltered: number;
  totalAll: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

// Pie de tabla con el rango visible, filas por página y botones de navegación.
export function TablePagination({
  page,
  totalPages,
  pageSize,
  start,
  shown,
  totalFiltered,
  totalAll,
  itemLabel,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const from = totalFiltered === 0 ? 0 : start + 1;
  const to = start + shown;

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-muted/30 px-5 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>
        Mostrando{" "}
        <span className="font-semibold text-foreground">
          {from}–{to}
        </span>{" "}
        de <span className="font-semibold text-foreground">{totalFiltered}</span> {itemLabel}
        {totalFiltered !== totalAll && <> (de {totalAll} en total)</>}
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5">
          Filas
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-md border border-input bg-card px-1.5 py-1 text-xs text-foreground"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
            className="rounded-md border border-border bg-card p-1 text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[4.5rem] text-center">
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Página siguiente"
            className="rounded-md border border-border bg-card p-1 text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
