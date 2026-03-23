interface Props {
  stats: { total: number; images: number; documents: number; scripts: number };
}

const metrics = [
  { key: "total" as const, label: "Total assets" },
  { key: "images" as const, label: "Images" },
  { key: "documents" as const, label: "Documents" },
  { key: "scripts" as const, label: "Scripts" },
];

export function LibraryStats({ stats }: Props) {
  return (
    <div className="px-6 pt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map((m) => (
        <div
          key={m.key}
          className="rounded-[10px] bg-card border border-border px-4 py-3"
        >
          <p className="text-xl font-medium text-primary font-ui">{stats[m.key]}</p>
          <p className="text-[11px] text-muted-foreground font-ui mt-0.5">{m.label}</p>
        </div>
      ))}
    </div>
  );
}
