import { useEffect, useState, type FormEvent } from "react";
import { X, Wallet } from "lucide-react";
import {
  expenseInputSchema,
  type Expense,
  type ExpenseInput,
  type ExpenseType,
} from "@/stores/expensesStore";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  initial?: Expense | null;
  onClose: () => void;
  onSubmit: (data: ExpenseInput) => void;
}

function toDateInput(ts: number) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function ExpenseFormModal({ open, initial, onClose, onSubmit }: Props) {
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<ExpenseType>("variable");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(toDateInput(Date.now()));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setConcept(initial.concept);
      setAmount(String(initial.amount));
      setType(initial.type);
      setCategory(initial.category);
      setDate(toDateInput(initial.date));
    } else {
      setConcept("");
      setAmount("");
      setType("variable");
      setCategory("");
      setDate(toDateInput(Date.now()));
    }
    setErrors({});
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = expenseInputSchema.safeParse({
      concept,
      amount: Number(amount),
      type,
      category,
      date: new Date(date + "T12:00:00").getTime(),
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        next[issue.path.join(".")] = issue.message;
      }
      setErrors(next);
      return;
    }
    onSubmit(parsed.data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="h-4 w-4" />
            </div>
            <h2 className="font-display text-lg font-bold text-foreground">
              {initial ? "Editar gasto" : "Nuevo gasto"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">Concepto</label>
            <input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej. Arriendo del local"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            {errors.concept && <p className="mt-1 text-xs text-destructive">{errors.concept}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">Monto (COP)</label>
              <input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              {errors.date && <p className="mt-1 text-xs text-destructive">{errors.date}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {(["fijo", "variable"] as ExpenseType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                    type === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {t === "fijo" ? "Costo fijo" : "Costo variable"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">
              Categoría <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ej. Servicios, Nómina, Insumos…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            {errors.category && <p className="mt-1 text-xs text-destructive">{errors.category}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)]"
            >
              {initial ? "Guardar cambios" : "Registrar gasto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
