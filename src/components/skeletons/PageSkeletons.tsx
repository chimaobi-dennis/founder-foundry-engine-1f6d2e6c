import { Skeleton } from "@/components/ui/skeleton";

// ── Home page skeleton ──
export function HomeSkeleton() {
  return (
    <div className="relative min-h-screen pb-16 overflow-x-hidden">
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8 px-4 md:px-6 pt-8 md:pt-10 pb-8 md:pb-12 max-w-full lg:max-w-[1200px] mx-auto">
        <div className="lg:col-span-3 flex flex-col justify-center gap-4 md:gap-5">
          <div className="flex items-center gap-3">
            <Skeleton className="w-4 h-4 rounded-full" />
            <Skeleton className="h-10 w-72" />
          </div>
          <Skeleton className="h-5 w-96 max-w-full" />
          <Skeleton className="h-5 w-64" />
          <div className="flex gap-2.5 mt-1">
            <Skeleton className="h-10 w-44 rounded-md" />
            <Skeleton className="h-10 w-44 rounded-md" />
          </div>
        </div>
        <div className="col-span-1 lg:col-span-2">
          <Skeleton className="rounded-xl h-[380px] w-full" />
        </div>
      </section>

      <section className="px-4 md:px-6 pb-8 pt-12 max-w-full lg:max-w-[1200px] mx-auto">
        <Skeleton className="h-3 w-48 mb-5" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="rounded-xl h-[180px]" />
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Stats cards skeleton (reusable for Creator Studio, Admin) ──
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-12" />
        </div>
      ))}
    </div>
  );
}

// ── Table skeleton ──
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-4 py-3 flex gap-6">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex items-center gap-6 border-b border-border last:border-0">
          <Skeleton className="w-10 h-10 rounded-md" />
          {Array.from({ length: cols - 1 }).map((_, j) => (
            <Skeleton key={j} className="h-4 w-20" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Brand DNA skeleton ──
export function BrandDNASkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-14 h-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <Skeleton className="rounded-xl h-[120px] w-[220px]" />
      </div>
      <Skeleton className="h-px w-full mb-6" />
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-32 mb-3" />
              <Skeleton className="rounded-xl h-[180px]" />
            </div>
          ))}
        </div>
        <div className="w-full lg:w-[300px] space-y-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-[52px] rounded-[10px]" />
          <Skeleton className="h-[52px] rounded-[10px]" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-3 w-24" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ProStudio skeleton ──
export function ProStudioSkeleton() {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="sticky top-10 z-[9] bg-background border-b border-border flex-shrink-0">
        <div className="flex gap-1 px-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 w-full space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="rounded-xl h-[260px]" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Library skeleton ──
export function LibrarySkeleton() {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-4 md:px-6 py-4 border-b border-border flex items-center gap-3">
        <Skeleton className="h-9 flex-1 max-w-xs rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
      <div className="flex-1 px-4 md:px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="rounded-xl h-16" />
          ))}
        </div>
        <Skeleton className="h-3 w-28" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="rounded-xl h-[200px]" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── CampaignKit skeleton ──
export function CampaignKitSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-4 w-80" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="rounded-xl h-[180px]" />
        <Skeleton className="rounded-xl h-[180px]" />
      </div>
      <Skeleton className="h-3 w-32" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="rounded-xl h-[120px]" />
        ))}
      </div>
    </div>
  );
}

// ── ContentCalendar skeleton ──
export function ContentCalendarSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 min-w-0 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-36" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={`h-${i}`} className="h-6 rounded" />
            ))}
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
      <div className="h-12 flex-shrink-0 border-t border-border px-5 flex items-center justify-between">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
    </div>
  );
}

// ── DocStudio skeleton ──
export function DocStudioSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="h-4 w-72" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="rounded-xl h-[140px]" />
        ))}
      </div>
      <Skeleton className="h-3 w-32 mt-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="rounded-xl h-[100px]" />
        <Skeleton className="rounded-xl h-[100px]" />
      </div>
    </div>
  );
}

// ── ReelBuilder skeleton ──
export function ReelBuilderSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="rounded-xl h-[200px]" />
        ))}
      </div>
      <Skeleton className="h-3 w-28 mt-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="rounded-xl h-[120px]" />
        <Skeleton className="rounded-xl h-[120px]" />
      </div>
    </div>
  );
}

// ── Mentor skeleton ──
export function MentorSkeleton() {
  return (
    <div className="flex h-full">
      <div className="w-[240px] border-r border-border p-4 space-y-3 hidden lg:block">
        <Skeleton className="h-4 w-20" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
      <div className="flex-1 flex flex-col p-4 space-y-3">
        <div className="flex-1 space-y-4 py-4">
          <div className="flex justify-start"><Skeleton className="h-16 w-3/4 rounded-lg" /></div>
          <div className="flex justify-end"><Skeleton className="h-10 w-1/2 rounded-lg" /></div>
          <div className="flex justify-start"><Skeleton className="h-20 w-2/3 rounded-lg" /></div>
          <div className="flex justify-end"><Skeleton className="h-10 w-1/3 rounded-lg" /></div>
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      <div className="w-[260px] border-l border-border p-4 space-y-3 hidden lg:block">
        <Skeleton className="h-4 w-20" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

// ── Admin skeleton ──
export function AdminSkeleton() {
  return (
    <div className="p-6 md:p-8 space-y-8">
      <Skeleton className="h-7 w-36" />
      <StatCardsSkeleton />
      <div className="space-y-3">
        <Skeleton className="h-5 w-52" />
        <TableSkeleton rows={3} cols={5} />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-44" />
        <TableSkeleton rows={3} cols={4} />
      </div>
    </div>
  );
}

// ── Creator Studio skeleton ──
export function CreatorStudioSkeleton() {
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-11 w-40 rounded-lg" />
      </div>
      <StatCardsSkeleton />
      <TableSkeleton rows={4} cols={5} />
    </div>
  );
}

// ── Creator Template Editor skeleton ──
export function CreatorTemplateEditorSkeleton() {
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <Skeleton className="h-6 w-44" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="aspect-square w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
