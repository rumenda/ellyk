import { formatKESCompact } from "@/lib/format";

/**
 * Lightweight SVG charts (server-rendered, zero client JS). Each chart carries
 * an accessible data table for screen readers.
 */
interface Point { label: string; value: number }

function SrTable({ data, valueLabel }: { data: Point[]; valueLabel: string }) {
  return (
    <div className="sr-only">
      <table>
        <thead><tr><th>Label</th><th>{valueLabel}</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.label}><td>{d.label}</td><td>{d.value}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function BarChart({ data, height = 180, money, valueLabel = "Value" }: {
  data: Point[]; height?: number; money?: boolean; valueLabel?: string;
}) {
  if (data.length === 0) return <ChartEmpty />;
  const max = Math.max(...data.map((d) => d.value), 1);
  const dense = data.length > 12;
  const every = Math.ceil(data.length / 8);
  return (
    <figure>
      <div className={dense ? "flex items-end gap-0.5" : "flex items-end gap-1.5"} style={{ height }} aria-hidden>
        {data.map((d) => (
          <div key={d.label} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.label}: ${money ? formatKESCompact(d.value) : d.value}`}>
            {!dense && <span className="mb-1 truncate text-center text-[11px] font-medium text-muted tabular">{money ? formatKESCompact(d.value) : d.value}</span>}
            <div className="rounded-t-[4px] bg-brand-500 transition-colors group-hover:bg-brand-600" style={{ height: `${Math.max(2, (d.value / max) * 82)}%` }} />
          </div>
        ))}
      </div>
      <div className={dense ? "mt-2 flex gap-0.5" : "mt-2 flex gap-1.5"} aria-hidden>
        {data.map((d, i) => <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[11px] text-subtle">{!dense || i % every === 0 ? d.label : ""}</span>)}
      </div>
      {dense && <p className="mt-1 text-right text-[11px] text-subtle">Peak {money ? formatKESCompact(max) : max}</p>}
      <SrTable data={data} valueLabel={valueLabel} />
    </figure>
  );
}

export function HBarChart({ data, money, valueLabel = "Value" }: { data: Point[]; money?: boolean; valueLabel?: string }) {
  if (data.length === 0) return <ChartEmpty />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <figure className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} aria-hidden>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="truncate text-text">{d.label}</span>
            <span className="tabular font-medium">{money ? formatKESCompact(d.value) : d.value}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-muted">
            <div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
      <SrTable data={data} valueLabel={valueLabel} />
    </figure>
  );
}

export function LineChart({ data, height = 160, money, valueLabel = "Value" }: {
  data: Point[]; height?: number; money?: boolean; valueLabel?: string;
}) {
  if (data.length < 2) return data.length ? <BarChart data={data} money={money} /> : <ChartEmpty />;
  const max = Math.max(...data.map((d) => d.value), 1);
  const W = 600, H = height, pad = 8;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (data.length - 1);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${H - pad} L${x(0)},${H - pad} Z`;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="lc-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--brand-500)" stopOpacity="0.25" />
            <stop offset="1" stopColor="var(--brand-500)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lc-fill)" />
        <path d={line} fill="none" stroke="var(--brand-600)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-subtle" aria-hidden>
        <span>{data[0]!.label}</span>
        <span>max {money ? formatKESCompact(max) : max}</span>
        <span>{data[data.length - 1]!.label}</span>
      </div>
      <SrTable data={data} valueLabel={valueLabel} />
    </figure>
  );
}

export function StackedBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <ChartEmpty />;
  return (
    <figure>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
        {segments.map((s) => s.value > 0 && <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />)}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-muted"><span className="size-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>
            <span className="tabular font-medium">{formatKESCompact(s.value)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function ChartEmpty() {
  return <p className="py-8 text-center text-sm text-muted">No data for this period yet.</p>;
}
