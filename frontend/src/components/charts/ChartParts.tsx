import { useState, type ReactNode } from "react";
import { type YAxisTickContentProps, Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayCount, NameCount } from "../../types/stats";
import { cardClass } from "../styles";
import { useChartColors, type ChartColors } from "./chartTheme";

export function StatTile({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className={cardClass}>
      <p className="text-sm text-ink-600 dark:text-ink-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-ink-900 dark:text-ink-100">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-500">{note}</p>}
    </div>
  );
}

// A chart with a title and a table view of the same numbers, so no value depends on hover or colour. 
export function ChartCard({
  title,
  subtitle,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  table: ReactNode;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
        </div>
        <button
          onClick={() => setShowTable((s) => !s)}
          aria-pressed={showTable}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
        >
          {showTable ? "Show chart" : "Show table"}
        </button>
      </div>
      <div className="mt-3">{showTable ? table : children}</div>
    </section>
  );
}

export function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white text-left text-ink-500 dark:bg-ink-900">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`py-1.5 pr-3 font-medium ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={i} className={`py-1.5 pr-3 ${i > 0 ? "text-right tabular-nums" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function tooltipProps(c: ChartColors) {
  return {
    cursor: { fill: c.grid, fillOpacity: 0.6 },
    contentStyle: {
      background: c.surface,
      border: `1px solid ${c.axis}`,
      borderRadius: 8,
      color: c.ink,
      fontSize: 12,
    },
    labelStyle: { color: c.ink, fontWeight: 600 },
    itemStyle: { color: c.ink },
  };
}

const shorten = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// One series, ranked largest first: one colour for every bar, with its value at the bar end. 
export function RankedBars({ data, unit }: { data: NameCount[]; unit: string }) {
  const c = useChartColors();
  if (data.every((d) => d.count === 0)) return <p className="py-6 text-sm text-ink-500">No data for this period yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={data.length * 30 + 16}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={4}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tickLine={false}
          axisLine={{ stroke: c.axis }}
          // Drawn as one line of text (Recharts would wrap long names)
          tick={({ x, y, payload }: YAxisTickContentProps) => (
            <text x={x} y={y} dy={4} textAnchor="end" fill={c.muted} fontSize={12}>
              <title>{String(payload.value)}</title>
              {shorten(String(payload.value))}
            </text>
          )}
        />
        <Tooltip {...tooltipProps(c)} formatter={(v) => [v, unit]} />
        <Bar dataKey="count" name={unit} fill={c.series1} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
          <LabelList dataKey="count" position="right" fill={c.muted} fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function SearchesPerDay({ data }: { data: DayCount[] }) {
  const c = useChartColors();
  const gap = data.length > 40 ? 1 : 2;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} barCategoryGap={data.length > 40 ? 1 : 3}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis
          dataKey="day"
          tickFormatter={dayLabel}
          tickLine={false}
          axisLine={{ stroke: c.axis }}
          tick={{ fill: c.muted, fontSize: 12 }}
          minTickGap={24}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: c.muted, fontSize: 12 }} />
        <Tooltip {...tooltipProps(c)} labelFormatter={(v) => dayLabel(String(v))} />
        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          iconType="square"
          iconSize={10}
          formatter={(v) => <span style={{ color: c.muted, fontSize: 12 }}>{v}</span>}
        />
        <Bar dataKey="matched" name="Found a topic" stackId="s" fill={c.series1} stroke={c.surface} strokeWidth={gap} isAnimationActive={false} />
        <Bar
          dataKey="unmatched"
          name="No match"
          stackId="s"
          fill={c.series2}
          stroke={c.surface}
          strokeWidth={gap}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DaysPicker({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <div role="group" aria-label="Period" className="inline-flex rounded-md border border-ink-300 p-0.5 dark:border-ink-700">
      {[7, 30, 90].map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          aria-pressed={days === d}
          className={`rounded px-2.5 py-1 text-sm ${
            days === d
              ? "bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900"
              : "text-ink-600 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
          }`}
        >
          {d} days
        </button>
      ))}
    </div>
  );
}

