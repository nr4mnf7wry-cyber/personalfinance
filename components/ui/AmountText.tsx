import clsx from "clsx";

export function formatAmount(value: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Any amount shown on screen should go through this so the blur-privacy toggle works everywhere. */
export default function AmountText({
  value,
  currency = "EUR",
  className,
  colorByValue = false,
}: {
  value: number;
  currency?: string;
  className?: string;
  colorByValue?: boolean;
}) {
  const colorClass = colorByValue
    ? value >= 0
      ? "text-income"
      : "text-expense"
    : "";

  return (
    <span className={clsx("blur-target", colorClass, className)}>
      {formatAmount(value, currency)}
    </span>
  );
}
