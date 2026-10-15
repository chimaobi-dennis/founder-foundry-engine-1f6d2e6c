import { Skeleton } from "@/components/ui/skeleton";

/**
 * Page-shaped loading states. Each mirrors the layout it stands in for, so
 * the page does not jump when the data arrives.
 */

/** A header line, then a stack of cards with a title and a few rows. */
export function ListSkeleton({ cards = 3, rows = 3, className = "" }: { cards?: number; rows?: number; className?: string }) {
  return (
    <div className={`space-y-4 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: cards }).map((_, i) => (
        <section key={i} className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-2/3" />
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <div className="space-y-2.5">
            {Array.from({ length: rows }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                <Skeleton className={j % 2 ? "h-4 w-1/2" : "h-4 w-3/4"} />
                <Skeleton className="ml-auto h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Rows in a bordered list (transactions, purchases, members). */
export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className={i % 2 ? "h-4 w-1/3" : "h-4 w-1/2"} />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}

/** A form: label and field pairs, then an action row. */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8 space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-56" />
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className={i === 1 ? "h-24 w-full rounded-lg" : "h-10 w-full rounded-lg"} />
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
    </div>
  );
}

/** The workspace shell: who-is-working bar, left rail, surface in the middle. */
export function WorkspaceSkeleton() {
  return (
    <div className="h-full flex flex-col bg-background" aria-busy="true" aria-label="Loading the workspace">
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="h-10 w-56 rounded-lg" />
        </div>
        <Skeleton className="hidden md:block h-9 w-40 rounded-lg" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </header>
      <div className="flex-1 flex min-h-0">
        <aside className="hidden md:flex w-64 shrink-0 flex-col gap-4 p-4 border-r border-border bg-muted/40">
          <div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
          <div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-3/4" /></div>
          <div className="space-y-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-1/2" /></div>
        </aside>
        <div className="flex-1 min-w-0 p-6 md:p-10">
          <div className="max-w-3xl mx-auto space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <div className="pt-4 space-y-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The whole app while the session and profile load: top bar, sidebar, a page of cards. */
export function AppSkeleton() {
  return (
    <div className="min-h-screen bg-background flex flex-col" aria-busy="true" aria-label="Loading Kinika">
      <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
        <Skeleton className="h-6 w-20" />
        <div className="flex items-center gap-2"><Skeleton className="h-8 w-24 rounded-lg" /><Skeleton className="h-8 w-8 rounded-full" /></div>
      </div>
      <div className="flex-1 flex">
        <aside className="hidden md:flex w-56 flex-col gap-2 p-3 border-r border-border">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className={i === 0 ? "h-9 w-full rounded-lg" : "h-9 w-5/6 rounded-lg"} />)}
        </aside>
        <main className="flex-1 p-6 md:p-10"><ListSkeleton cards={2} rows={3} className="max-w-4xl mx-auto" /></main>
      </div>
    </div>
  );
}
