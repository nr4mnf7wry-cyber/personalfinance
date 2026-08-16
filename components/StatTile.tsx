import { Money } from "@/components/BlurToggle";

export default function StatTile({
  label,
  value,
  isCurrency = true,
}: {
  label: string;
  value: number;
  isCurrency?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-semibold">
        {isCurrency ? <Money value={value} /> : `${value.toFixed(1)}%`}
      </div>
    </div>
  );
}
