import { CategorySummary } from "@/lib/types";

import { getCategoryColor } from "@/lib/categoryColors";

interface CategoryTableProps {
  categories: CategorySummary[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function CategoryTable({ categories }: CategoryTableProps) {
  const rows = categories
    .map((category) => {
      const income = category.total_income;
      const expenses = category.total_expenses;
      const net = income - expenses;
      const turnover = income + expenses;

      return {
        ...category,
        income,
        expenses,
        net,
        turnover,
      };
    })
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  const maxAbsNet = Math.max(...rows.map((row) => Math.abs(row.net)), 1);
  const totalTurnover = rows.reduce((sum, row) => sum + row.turnover, 0);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-5 text-sm text-[var(--text-2)]">
        No category data available.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-1)]">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--text-2)]">
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Income</th>
            <th className="px-4 py-3">Expenses</th>
            <th className="px-4 py-3">Net</th>
            <th className="px-4 py-3">Share</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const netWidth = Math.min((Math.abs(row.net) / maxAbsNet) * 100, 100);
            const share = totalTurnover > 0 ? (row.turnover / totalTurnover) * 100 : 0;
            const netPrefix = row.net >= 0 ? "+" : "-";

            return (
              <tr key={row.category} className="border-b border-[var(--border)] align-top text-sm">
                <td className="px-4 py-3">
                  <div className="font-medium text-[var(--text-1)]">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: getCategoryColor(row.category) }}
                      />
                      {row.category}
                    </span>
                  </div>
                  <div className="mt-2 h-[5px] w-full rounded-full bg-[var(--bg-2)]">
                    <div
                      className="h-[5px] rounded-full"
                      style={{
                        width: `${netWidth}%`,
                        background: row.net >= 0 ? "var(--green)" : "var(--red)",
                      }}
                    />
                  </div>
                </td>

                <td className="px-4 py-3 text-[var(--green-text)]">
                  {row.income > 0 ? formatCurrency(row.income) : "-"}
                </td>

                <td className="px-4 py-3 text-[var(--red-text)]">
                  {row.expenses > 0 ? formatCurrency(row.expenses) : "-"}
                </td>

                <td className={`px-4 py-3 ${row.net >= 0 ? "text-[var(--blue-text)]" : "text-[var(--red-text)]"}`}>
                  {`${netPrefix}${formatCurrency(Math.abs(row.net))}`}
                </td>

                <td className="px-4 py-3 text-[var(--text-2)]">{share.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
