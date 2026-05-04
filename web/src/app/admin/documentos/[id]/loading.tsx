// Skeleton para /admin/documentos/[id] mientras carga el contenido de la carpeta.
export default function Loading() {
  return (
    <div className="max-w-[1200px] mx-auto animate-pulse">
      <div className="flex items-center gap-1.5 mb-3">
        <div className="h-3 w-16 rounded bg-[var(--bg-inset)]" />
        <div className="h-3 w-3 rounded bg-[var(--bg-inset)]" />
        <div className="h-3 w-24 rounded bg-[var(--bg-inset)]" />
      </div>
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded bg-[var(--bg-inset)]" />
        <div className="flex-1">
          <div className="h-6 w-48 rounded bg-[var(--bg-inset)] mb-2" />
          <div className="h-3 w-32 rounded bg-[var(--bg-inset)]" />
        </div>
      </div>
      <div className="h-9 max-w-[400px] rounded-md bg-[var(--bg-inset)] mb-5" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[120px] rounded-[var(--r-lg)] bg-[var(--bg-inset)]" />
        ))}
      </div>
    </div>
  );
}
