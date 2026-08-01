import { MONTH_LABELS_FR } from "@/lib/categories";

export default function MonthPicker({
  year,
  month,
  onChange,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
  function shift(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) {
      m = 1;
      y++;
    } else if (m < 1) {
      m = 12;
      y--;
    }
    onChange(y, m);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => shift(-1)}
        className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700"
        aria-label="Mois précédent"
      >
        ←
      </button>
      <span className="min-w-[9rem] text-center text-lg font-semibold">
        {MONTH_LABELS_FR[month - 1]} {year}
      </span>
      <button
        onClick={() => shift(1)}
        className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700"
        aria-label="Mois suivant"
      >
        →
      </button>
    </div>
  );
}
