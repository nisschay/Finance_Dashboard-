interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DonutChart({ segments, size = 110 }: DonutChartProps) {
  const sanitized = segments.filter((segment) => segment.value > 0);
  const total = sanitized.reduce((sum, segment) => sum + segment.value, 0);
  const radius = size / 2 - 10;
  const strokeWidth = 14;

  let cumulativeAngle = 0;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--bg-2)"
            strokeWidth={strokeWidth}
          />

          {sanitized.map((segment) => {
            const sweep = total > 0 ? (segment.value / total) * 360 : 0;
            const path = describeArc(
              size / 2,
              size / 2,
              radius,
              cumulativeAngle,
              cumulativeAngle + sweep,
            );

            cumulativeAngle += sweep;

            return (
              <path
                key={segment.label}
                d={path}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeLinecap="butt"
              />
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-2)]">Total</p>
            <p className="text-sm font-medium text-[var(--text-1)]">{formatCurrency(total)}</p>
          </div>
        </div>
      </div>

      <div className="min-w-[190px] space-y-2">
        {sanitized.length === 0 ? (
          <p className="text-sm text-[var(--text-2)]">No expense segments yet.</p>
        ) : (
          sanitized.map((segment) => (
            <div key={segment.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2 text-[var(--text-2)]">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: segment.color }}
                />
                {segment.label}
              </span>
              <span className="font-medium text-[var(--text-1)]">{formatCurrency(segment.value)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
