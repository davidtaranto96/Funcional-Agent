// Skeleton para /admin/documentos. Aparece instantaneo mientras Next.js
// resuelve el Server Component, evitando que la pagina anterior se vea
// "congelada" durante el SSR.
export default function Loading() {
  return (
    <div className="flex gap-4 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 animate-pulse">
      <aside className="hidden md:flex w-[220px] flex-shrink-0 flex-col bg-card border border-[var(--border)] rounded-[var(--r-lg)] sticky top-5 self-start">
        <div className="h-10 border-b border-[var(--border)]" />
        <div className="flex-1 p-3 space-y-2">
          <div className="h-3 w-2/3 rounded bg-[var(--bg-inset)]" />
          <div className="h-7 rounded bg-[var(--bg-inset)]" />
          <div className="h-7 rounded bg-[var(--bg-inset)]" />
          <div className="h-7 rounded bg-[var(--bg-inset)]" />
        </div>
        <div className="border-t border-[var(--border)] p-2.5">
          <div className="h-8 rounded-md bg-[var(--bg-inset)]" />
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <div className="h-6 w-32 rounded bg-[var(--bg-inset)] mb-2" />
        <div className="h-4 w-48 rounded bg-[var(--bg-inset)] mb-5" />
        <div className="h-9 max-w-[400px] rounded-md bg-[var(--bg-inset)] mb-5" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-[var(--r-lg)] bg-[var(--bg-inset)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
