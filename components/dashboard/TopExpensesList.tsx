import AmountText from "@/components/ui/AmountText";
import { colorForIndex } from "@/lib/chartColors";

export default function TopExpensesList({
  data,
}: {
  data: { categoryName: string; amount: number }[];
}) {
  const top = [...data].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const max = top[0]?.amount ?? 1;

  if (top.length === 0) {
    return <p className="text-sm text-slate-400">Aucune dépense ce mois-ci</p>;
  }

  return (
    <ul className="space-y-2">
      {top.map((item, i) => (
        <li key={item.categoryName}>
          <div className="mb-0.5 flex items-center justify-between text-sm">
            <span>{item.categoryName}</span>
            <AmountText value={item.amount} className="font-medium" />
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${(item.amount / max) * 100}%`,
                backgroundColor: colorForIndex(i),
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
