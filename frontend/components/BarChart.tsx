export interface BarChartDatum {
  month: string;
  income?: number;
  expenses?: number;
  value?: number;
}

interface BarChartProps {
  data: BarChartDatum[];
  maxHeight?: number;
  mode?: "grouped" | "single";
  singleColor?: string;
  showValueLabels?: boolean;
}

function toMonthLabel(month: string): string {
  const parsed = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return month;
  }

  return parsed.toLocaleString("en-US", { month: "short" });
}

function formatCompactCurrency(value: number): string {
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000) {
    return `${value < 0 ? "-" : ""}$${(absolute / 1_000_000).toFixed(1)}M`;
  }

  if (absolute >= 1_000) {
    return `${value < 0 ? "-" : ""}$${(absolute / 1_000).toFixed(1)}k`;
  }

  return `${value < 0 ? "-" : ""}$${absolute.toFixed(0)}`;
}

export default function BarChart({
  data,
  maxHeight = 120,
  mode = "grouped",
  singleColor = "var(--blue)",
  showValueLabels = false,
}: BarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[150px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-2)] text-sm text-[var(--text-2)]">
        No chart data available.
      </div>
    );
  }

  const peakValue =
    mode === "grouped"
      ? Math.max(
          ...data.flatMap((item) => [Math.max(item.income ?? 0, 0), Math.max(item.expenses ?? 0, 0)]),
          1,
        )
      : Math.max(...data.map((item) => Math.abs(item.value ?? 0)), 1);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-end gap-4 px-1">
        {data.map((item) => {
          const income = Math.max(item.income ?? 0, 0);
          const expenses = Math.max(item.expenses ?? 0, 0);
          const value = item.value ?? 0;

          const incomeHeight = Math.max((income / peakValue) * maxHeight, income > 0 ? 4 : 0);
          const expensesHeight = Math.max((expenses / peakValue) * maxHeight, expenses > 0 ? 4 : 0);
          const singleHeight = Math.max((Math.abs(value) / peakValue) * maxHeight, value !== 0 ? 4 : 0);

          return (
            <div key={item.month} className="flex w-[48px] flex-col items-center gap-1">
              {mode === "single" && showValueLabels ? (
                <span className="text-[10px] text-[var(--text-2)]">{formatCompactCurrency(value)}</span>
              ) : null}

              <div
                className="flex items-end justify-center gap-1"
                style={{ height: `${maxHeight}px` }}
              >
                {mode === "grouped" ? (
                  <>
                    <div
                      className="w-[12px] rounded-t"
                      style={{
                        height: `${incomeHeight}px`,
                        background: "var(--green)",
                      }}
                    />
                    <div
                      className="w-[12px] rounded-t"
                      style={{
                        height: `${expensesHeight}px`,
                        background: "var(--red)",
                      }}
                    />
                  </>
                ) : (
                  <div
                    className="w-[18px] rounded-t"
                    style={{
                      height: `${singleHeight}px`,
                      background: singleColor,
                    }}
                  />
                )}
              </div>

              <span className="text-[11px] text-[var(--text-2)]">{toMonthLabel(item.month)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
