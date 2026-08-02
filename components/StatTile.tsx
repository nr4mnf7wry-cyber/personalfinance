import { Money } from "@/components/BlurToggle";

export default function StatTile({
  label,
  value,
  delta,
  isCurrency = true,
}: {
  label: string;
  value: number;
  delta?: number | null;
  isCurrency?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-semibold">
        {isCurrency ? <Money value={value} /> : `${value.toFixed(1)}%`}
      </div>
      {delta !== undefined && delta !== null && !Number.isNaN(delta) && (
        <div className={`text-sm mt-1 ${delta >= 0 ? "text-green" : "text-red"}`}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}% vs mois précédent
        </div>
      )}
    </div>
  );
}
