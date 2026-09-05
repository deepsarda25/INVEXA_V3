import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

type Holding = { ticker: string; marketValue: number };

type Props = {
  cash: number;
  holdings: Holding[];
};

const SLICE_COLORS = [
  "var(--secondary-neon)",
  "#6c8cff",
  "#ffb454",
  "#c792ea",
  "#ff8fa3",
  "#7fd3c7",
  "#e0af68"
];

function fmtCur(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function PortfolioAllocationChart({ cash, holdings }: Props) {
  const data = [
    { name: "Cash", value: Math.max(0, cash) },
    ...holdings.filter((h) => h.marketValue > 0).map((h) => ({ name: h.ticker, value: h.marketValue }))
  ].filter((d) => d.value > 0);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>
        No portfolio data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={idx === 0 ? "var(--outline-variant)" : SLICE_COLORS[(idx - 1) % SLICE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: "var(--surface)", border: "1px solid var(--outline)", borderRadius: "0.5rem", color: "var(--on-surface)" }}
          formatter={(value: number, name: string) => [`${fmtCur(value)} (${((value / total) * 100).toFixed(1)}%)`, name]}
        />
        <Legend
          verticalAlign="middle"
          align="right"
          layout="vertical"
          iconSize={10}
          wrapperStyle={{ fontSize: "0.78rem", color: "var(--text-2)", fontFamily: "var(--font-data)" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
