// Pure SVG donut chart — zero dependencies.
//
// Uses stroke-dasharray on a circle to create arc segments. Each segment is a separate
// circle element, offset by the cumulative angle of all preceding segments.
// Accessible via aria-label on each segment.

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  /** Number shown in the center of the donut. */
  centerValue: number | string;
  /** Small label below the center number. */
  centerLabel: string;
  /** Outer diameter in pixels. Default 160. */
  size?: number;
  /** Ring thickness in pixels. Default 20. */
  thickness?: number;
}

export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  size = 160,
  thickness = 20,
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div
          className="flex items-center justify-center rounded-full border-4 border-stone-100"
          style={{ width: size, height: size }}
        >
          <span className="text-sm text-stone-400">No data</span>
        </div>
      </div>
    );
  }

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calculate cumulative offsets for each segment
  let cumulative = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((segment) => {
      const fraction = segment.value / total;
      const dashLength = fraction * circumference;
      const dashGap = circumference - dashLength;
      // Rotate so it starts from the top (-90°) and offset by cumulative
      const rotation = (cumulative / total) * 360 - 90;
      cumulative += segment.value;
      return { ...segment, dashLength, dashGap, rotation };
    });

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Chart: ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}`}
        >
          {/* background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#f5f5f4"
            strokeWidth={thickness}
          />
          {/* segments */}
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={thickness}
              strokeDasharray={`${arc.dashLength} ${arc.dashGap}`}
              strokeLinecap="butt"
              transform={`rotate(${arc.rotation} ${center} ${center})`}
              aria-label={`${arc.label}: ${arc.value}`}
            />
          ))}
        </svg>
        {/* center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-stone-900">{centerValue}</span>
          <span className="text-xs text-stone-500">{centerLabel}</span>
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <span className="text-xs text-stone-600">
                {s.label} ({s.value})
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
