import { ReactNode } from "react";

type MetricColor = "green" | "red" | "blue" | "amber";

interface MetricCardProps {
  label: string;
  value: string;
  subtext: string;
  valueColor: MetricColor;
  footer?: ReactNode;
}

const VALUE_COLOR_CLASS: Record<MetricColor, string> = {
  green: "text-[var(--green-text)]",
  red: "text-[var(--red-text)]",
  blue: "text-[var(--blue-text)]",
  amber: "text-[var(--amber-text)]",
};

export default function MetricCard({ label, value, subtext, valueColor, footer }: MetricCardProps) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-4">
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-2)]">{label}</p>
      <p className={`mt-1.5 text-[21px] font-medium ${VALUE_COLOR_CLASS[valueColor]}`}>{value}</p>
      <p className="mt-1 text-xs text-[var(--text-2)]">{subtext}</p>
      {footer ? <div className="mt-2">{footer}</div> : null}
    </article>
  );
}
