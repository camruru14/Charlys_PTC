export default function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-background/10 bg-background/5 p-4">
      <p className="text-xs uppercase tracking-wider text-background/60">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
