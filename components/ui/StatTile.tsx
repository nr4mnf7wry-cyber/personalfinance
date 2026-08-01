import clsx from "clsx";

export default function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  positiveIsGood = true,
}: {
  label: string;
  value: React.ReactNode;
  delta?: number | null;
  deltaLabel?: string;
  positiveIsGood?: boolean;
}) {
  const hasDelta = typeof delta === "number";
  const isGood = hasDelta && (positiveIsGood ? delta! >= 0 : delta! <= 0);

  return (
    <div className="card flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-2xl font-semibold blur-target">{value}</span>
      {hasDelta && (
        <span
          className={clsx(
            "text-xs font-medium",
            isGood ? "text-income" : "text-expense"
          )}
        >
          {delta! >= 0 ? "+" : ""}
          {delta!.toFixed(1)}% {deltaLabel ?? ""}
        </span>
      )}
    </div>
  );
}
