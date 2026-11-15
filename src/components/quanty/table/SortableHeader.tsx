import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortState } from "@/lib/table";
import { cn } from "@/lib/utils";

interface Props<K extends string> {
  label: string;
  sortKey: K;
  sort: SortState<K> | null;
  onSort: (key: K) => void;
  align?: "left" | "center" | "right";
}

// Encabezado de columna que ordena la tabla al hacer clic.
export function SortableHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: Props<K>) {
  const active = sort?.key === sortKey;
  const direction = active ? sort.direction : null;
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <th
      scope="col"
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
      className={cn(
        "px-4 py-3 sm:px-5",
        align === "right" && "text-right",
        align === "center" && "text-center",
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </th>
  );
}
