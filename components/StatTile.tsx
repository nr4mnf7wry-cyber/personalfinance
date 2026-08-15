import { Money } from "@/components/BlurToggle";

export default function StatTile({
  label,
  value,
  delta,
  isCurrency = true,
  higherIsBetter = true,
}: {
  label: string;
  value: number;
  delta?: number | null;
  isCurrency?: boolean;
  higherIsBetter?: boolean;
}) {
  const favorable = delta == null ? null : higherIsBetter ? delta >= 0 : delta <= 0;
  return (
    <div className="card p-5">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-semibold">
        {isCurrency ? <Money value={value} /> : `${value.toFixed(1)}%`}
      </div>
      {delta !== undefined && delta !== null && !Number.isNaN(delta) && (
        <div className={`text-sm mt-1 ${favorable ? "text-green" : "text-red"}`}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}% vs mois précédent
        </div>
      )}
    </div>
  );
}
