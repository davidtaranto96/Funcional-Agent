import * as db from '@/lib/db';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Folder, Plus, Trash2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DocumentosPage() {
  const folders = await db.listDocumentFolders();

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">Documentos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{folders.length} carpetas</p>
        </div>
      </div>

      {/* Create folder form */}
      <Card className="p-5 mb-5">
        <h2 className="text-[length:var(--h2-size)] font-semibold mb-3">Nueva carpeta</h2>
        <form method="POST" action="/api/admin/folders/create" className="grid grid-cols-1 md:grid-cols-[1fr_120px_1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="color">Color</Label>
            <input id="color" name="color" type="color" defaultValue="#3b82f6"
              className="w-full h-10 rounded-md border border-[var(--border-strong)] bg-input px-2 cursor-pointer" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Input id="description" name="description" />
          </div>
          <Button type="submit" size="sm"><Plus className="w-4 h-4" /> Crear</Button>
        </form>
      </Card>

      {/* Folder grid */}
      {folders.length === 0 ? (
        <div className="bg-card border border-dashed border-[var(--border-strong)] rounded-xl p-12 text-center">
          <p className="text-sm text-muted-foreground">Sin carpetas todavía. Creá la primera arriba.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {folders.map(f => (
            <Card key={f.id} className="p-4 group hover:border-[var(--border-strong)] transition-colors">
              <div className="flex items-start justify-between mb-2">
                <Folder className="w-8 h-8" style={{ color: f.color }} />
                <form method="POST" action={`/api/admin/folders/${f.id}/delete`}
                  onSubmit={e => { if (!confirm('¿Borrar esta carpeta?')) e.preventDefault(); }}>
                  <button type="submit" className="text-muted-foreground hover:text-[var(--red)] opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Borrar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
              <div className="text-sm font-medium text-foreground truncate">{f.name}</div>
              {f.description && <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{f.description}</div>}
            </Card>
          ))}
        </div>
      )}

      <Card className="p-5 mt-5 bg-[var(--bg-inset)] border-dashed">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Migración Wave 4 — file uploads pendientes:</strong> el upload de archivos a carpetas (multer en el legacy) se port&aacute; en próxima sesi&oacute;n. Por ahora podés crear y borrar carpetas. Los archivos legacy siguen disponibles via <code className="bg-[var(--bg-card-2)] px-1.5 rounded text-[10px]">/project-files/</code> del Express viejo.
        </p>
      </Card>
    </div>
  );
}
