'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Save, Printer } from 'lucide-react';
import { showToast } from '@/components/ui/toast';
import { formatARS } from '@/lib/utils';
import type { Project } from '@/lib/db';

interface LaborRow { id: string; concept: string; hours: number; rateUSD: number }
interface CustomService { id: string; name: string; cost: number; currency: 'ARS' | 'USD' }

const CONCEPTS = [
  'Diseño UI/UX', 'Diseño gráfico', 'Desarrollo Frontend', 'Desarrollo Backend',
  'Desarrollo fullstack', 'Testing y QA', 'Deploy y configuración',
  'Capacitación y onboarding', 'Reuniones y coordinación', 'Documentación técnica',
  'SEO / Optimización', 'Soporte técnico', 'Integración de APIs', 'Base de datos y migraciones',
];

const PROJECT_TYPES = [
  { key: 'web', label: 'Página web / Landing page' },
  { key: 'ecommerce', label: 'E-commerce / Tienda online' },
  { key: 'app', label: 'App web completa' },
  { key: 'bot', label: 'Bot WhatsApp / Automatización' },
  { key: 'design', label: 'Diseño y branding' },
  { key: 'maintenance', label: 'Mantenimiento / Soporte' },
  { key: 'custom', label: 'Personalizado' },
];

// Servicios preconfigurados (costos USD/mes o únicos)
const PRESET_SERVICES = [
  { name: 'Hosting (Railway/Vercel)', cost: 5, period: 'mes' },
  { name: 'Dominio .com', cost: 12, period: 'año' },
  { name: 'Email (Resend Pro)', cost: 20, period: 'mes' },
  { name: 'Base de datos (Turso Hobby)', cost: 0, period: 'mes' },
  { name: 'CDN / Imágenes', cost: 0, period: 'mes' },
  { name: 'Mantenimiento mensual', cost: 50, period: 'mes' },
  { name: 'WhatsApp Business API', cost: 5, period: 'mes' },
];

function uid() { return Math.random().toString(36).slice(2, 9); }

const STORAGE_KEY = 'pd-cfg-v1';

interface Props { projects: Project[] }

export function PresupuestoCalc({ projects }: Props) {
  // Config
  const [clientType, setClientType] = useState<'ARS' | 'USD'>('ARS');
  const [exchangeRate, setExchangeRate] = useState(1000);
  const [hourlyARS, setHourlyARS] = useState(25000);
  const [hourlyUSD, setHourlyUSD] = useState(25);
  const [marginPct, setMarginPct] = useState(40);

  // Project info
  const [linkedProjectId, setLinkedProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [projectType, setProjectType] = useState('web');
  const [description, setDescription] = useState('');

  // Labor + services
  const [labor, setLabor] = useState<LaborRow[]>([
    { id: uid(), concept: 'Desarrollo fullstack', hours: 40, rateUSD: hourlyUSD },
  ]);
  const [enabledServices, setEnabledServices] = useState<Record<string, boolean>>({});
  const [customServices, setCustomServices] = useState<CustomService[]>([]);

  // Load saved config from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const cfg = JSON.parse(raw);
      if (cfg.exchangeRate) setExchangeRate(cfg.exchangeRate);
      if (cfg.hourlyARS) setHourlyARS(cfg.hourlyARS);
      if (cfg.hourlyUSD) setHourlyUSD(cfg.hourlyUSD);
      if (cfg.marginPct !== undefined) setMarginPct(cfg.marginPct);
    } catch {}
  }, []);

  // Persist config
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ exchangeRate, hourlyARS, hourlyUSD, marginPct }));
  }, [exchangeRate, hourlyARS, hourlyUSD, marginPct]);

  // Calculations
  const totals = useMemo(() => {
    const totalHours = labor.reduce((acc, l) => acc + (Number(l.hours) || 0), 0);
    const laborUSD = labor.reduce((acc, l) => acc + (Number(l.hours) || 0) * (Number(l.rateUSD) || 0), 0);

    const presetServicesUSD = PRESET_SERVICES.reduce((acc, s) =>
      enabledServices[s.name] ? acc + s.cost : acc, 0);
    const customServicesUSD = customServices.reduce((acc, s) => {
      const cost = Number(s.cost) || 0;
      return acc + (s.currency === 'USD' ? cost : cost / exchangeRate);
    }, 0);
    const servicesUSD = presetServicesUSD + customServicesUSD;

    const subtotalUSD = laborUSD + servicesUSD;
    const margin = subtotalUSD * (marginPct / 100);
    const totalUSD = subtotalUSD + margin;
    const totalARS = totalUSD * exchangeRate;

    return { totalHours, laborUSD, servicesUSD, subtotalUSD, margin, totalUSD, totalARS };
  }, [labor, enabledServices, customServices, marginPct, exchangeRate]);

  function loadProject(id: string) {
    if (!id) return;
    const p = projects.find(x => x.id === id);
    if (!p) return;
    setLinkedProjectId(id);
    setProjectName(p.title || '');
    setClientName(p.client_name || '');
    setDescription(p.description || p.notes || '');
    if (p.budget) {
      const num = parseFloat(String(p.budget).replace(/[^\d.-]/g, ''));
      if (Number.isFinite(num)) {
        // Estimate from budget — assume 40% margin baked in
        const estUSD = num / exchangeRate;
        const estLaborUSD = estUSD / (1 + marginPct / 100);
        const hours = Math.round(estLaborUSD / hourlyUSD);
        if (hours > 0) {
          setLabor([{ id: uid(), concept: 'Desarrollo fullstack', hours, rateUSD: hourlyUSD }]);
        }
      }
    }
  }

  function addLaborRow() {
    setLabor([...labor, { id: uid(), concept: '', hours: 8, rateUSD: hourlyUSD }]);
  }
  function updateLaborRow(id: string, patch: Partial<LaborRow>) {
    setLabor(labor.map(l => l.id === id ? { ...l, ...patch } : l));
  }
  function removeLaborRow(id: string) {
    setLabor(labor.filter(l => l.id !== id));
  }

  function addCustomService() {
    setCustomServices([...customServices, { id: uid(), name: '', cost: 0, currency: 'USD' }]);
  }
  function updateCustom(id: string, patch: Partial<CustomService>) {
    setCustomServices(customServices.map(s => s.id === id ? { ...s, ...patch } : s));
  }
  function removeCustom(id: string) {
    setCustomServices(customServices.filter(s => s.id !== id));
  }

  async function saveQuote() {
    if (!linkedProjectId) {
      showToast('Vinculá un proyecto primero (selector arriba)', 'err');
      return;
    }
    const p = projects.find(x => x.id === linkedProjectId);
    if (!p) return;
    try {
      const fd = new FormData();
      const newBudget = clientType === 'ARS' ? Math.round(totals.totalARS).toString() : Math.round(totals.totalUSD).toString();
      fd.append('title', p.title);
      fd.append('type', p.type);
      fd.append('description', description);
      fd.append('status', p.status);
      fd.append('client_name', clientName);
      fd.append('client_phone', p.client_phone);
      fd.append('client_email', p.client_email);
      fd.append('client_id', p.client_id);
      fd.append('category', p.category);
      fd.append('deadline', p.deadline || '');
      fd.append('budget', newBudget);
      fd.append('budget_status', 'quoted');
      fd.append('notes', `${p.notes || ''}\n\n[Presupuesto guardado] ${totals.totalHours}hs · USD ${Math.round(totals.totalUSD)} · ARS ${formatARS(totals.totalARS)}`.trim());
      if (p.is_personal) fd.append('is_personal', 'on');

      const r = await fetch(`/api/admin/projects/${linkedProjectId}/update`, { method: 'POST', body: fd, redirect: 'manual' });
      // Redirect via 303, fetch returns opaque — basta que no tire error
      if (r.type === 'opaqueredirect' || r.status === 303 || r.ok) {
        showToast('Presupuesto guardado en el proyecto', 'ok');
      } else {
        throw new Error('save failed');
      }
    } catch {
      showToast('Error al guardar', 'err');
    }
  }

  function printQuote() {
    window.print();
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
      {/* LEFT: Form */}
      <div className="xl:col-span-3 space-y-4 print:col-span-5">

        {/* Config */}
        <Card className="p-5 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[length:var(--h2-size)] font-semibold">⚙️ Configuración de tarifas</h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setClientType('ARS')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${clientType === 'ARS' ? 'bg-[var(--accent)] text-white' : 'text-muted-foreground hover:bg-secondary'}`}>
                🇦🇷 ARS
              </button>
              <button type="button" onClick={() => setClientType('USD')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${clientType === 'USD' ? 'bg-[var(--accent)] text-white' : 'text-muted-foreground hover:bg-secondary'}`}>
                🌍 USD
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Tipo de cambio">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">$1=</span>
                <Input type="number" value={exchangeRate} min={1} step={10} className="h-9 text-sm"
                  onChange={e => setExchangeRate(Number(e.target.value))} />
                <span className="text-[10px] text-muted-foreground">ARS</span>
              </div>
            </Field>
            <Field label="🇦🇷 Tarifa ARS/h">
              <Input type="number" value={hourlyARS} min={1} step={500} className="h-9 text-sm"
                onChange={e => setHourlyARS(Number(e.target.value))} />
            </Field>
            <Field label="🌍 Tarifa USD/h">
              <Input type="number" value={hourlyUSD} min={1} step={1} className="h-9 text-sm"
                onChange={e => setHourlyUSD(Number(e.target.value))} />
            </Field>
            <Field label="Margen %">
              <Input type="number" value={marginPct} min={0} max={200} step={5} className="h-9 text-sm"
                onChange={e => setMarginPct(Number(e.target.value))} />
            </Field>
          </div>
        </Card>

        {/* Project info */}
        <Card className="p-5">
          <h2 className="text-[length:var(--h2-size)] font-semibold mb-3">📋 Datos del proyecto</h2>
          <div className="space-y-3">
            <div className="print:hidden">
              <Label htmlFor="link-project">Vincular a proyecto existente</Label>
              <select id="link-project" value={linkedProjectId} onChange={e => loadProject(e.target.value)}
                className="flex h-10 w-full rounded-md border border-[var(--border-strong)] bg-input px-3 py-2 text-sm mt-1.5">
                <option value="">— Cargar desde proyecto existente —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.title || 'Sin título'} {p.client_name ? `— ${p.client_name}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nombre del proyecto">
                <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Ej: Tienda Online Ropa Nordeste" />
              </Field>
              <Field label="Cliente">
                <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nombre del cliente" />
              </Field>
            </div>
            <Field label="Tipo de proyecto">
              <select value={projectType} onChange={e => setProjectType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-[var(--border-strong)] bg-input px-3 py-2 text-sm">
                {PROJECT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Descripción / alcance">
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                placeholder="Describí brevemente el alcance..." className="flex w-full rounded-md border border-[var(--border-strong)] bg-input px-3 py-2 text-sm resize-none" />
            </Field>
          </div>
        </Card>

        {/* Labor */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[length:var(--h2-size)] font-semibold">👷 Mano de obra</h2>
            <Button type="button" variant="ghost" size="sm" onClick={addLaborRow}><Plus className="w-3.5 h-3.5" /> Agregar</Button>
          </div>
          <datalist id="labor-concepts">{CONCEPTS.map(c => <option key={c} value={c} />)}</datalist>
          <div className="space-y-2">
            {labor.map(row => (
              <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
                <input list="labor-concepts" value={row.concept} onChange={e => updateLaborRow(row.id, { concept: e.target.value })}
                  placeholder="Concepto" className="col-span-6 h-9 rounded-md border border-[var(--border-strong)] bg-input px-2 text-xs" />
                <input type="number" value={row.hours} onChange={e => updateLaborRow(row.id, { hours: Number(e.target.value) })}
                  min={0} step={1} placeholder="hs" className="col-span-2 h-9 rounded-md border border-[var(--border-strong)] bg-input px-2 text-xs mono" />
                <input type="number" value={row.rateUSD} onChange={e => updateLaborRow(row.id, { rateUSD: Number(e.target.value) })}
                  min={0} step={1} placeholder="USD/h" className="col-span-3 h-9 rounded-md border border-[var(--border-strong)] bg-input px-2 text-xs mono" />
                <button type="button" onClick={() => removeLaborRow(row.id)} className="col-span-1 text-muted-foreground hover:text-[var(--red)]" aria-label="Borrar">
                  <Trash2 className="w-3.5 h-3.5 mx-auto" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--border)] flex justify-between text-xs">
            <span className="text-muted-foreground">Total horas: <span className="mono font-bold text-foreground">{totals.totalHours}</span></span>
            <span className="text-muted-foreground">Subtotal labor: <span className="mono font-bold text-foreground">USD {Math.round(totals.laborUSD)}</span></span>
          </div>
        </Card>

        {/* Services */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[length:var(--h2-size)] font-semibold">🔧 Servicios y gastos</h2>
            <Button type="button" variant="ghost" size="sm" onClick={addCustomService}><Plus className="w-3.5 h-3.5" /> Personalizado</Button>
          </div>
          <div className="space-y-1.5 mb-3">
            {PRESET_SERVICES.map(s => (
              <label key={s.name} className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-[var(--bg-inset)]">
                <input type="checkbox" checked={!!enabledServices[s.name]}
                  onChange={e => setEnabledServices({ ...enabledServices, [s.name]: e.target.checked })} />
                <span className="text-sm flex-1">{s.name}</span>
                <span className="text-[10px] text-muted-foreground mono">USD {s.cost}/{s.period}</span>
              </label>
            ))}
          </div>
          {customServices.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[var(--border)]">
              {customServices.map(s => (
                <div key={s.id} className="grid grid-cols-12 gap-2 items-center">
                  <input value={s.name} onChange={e => updateCustom(s.id, { name: e.target.value })} placeholder="Servicio personalizado"
                    className="col-span-6 h-9 rounded-md border border-[var(--border-strong)] bg-input px-2 text-xs" />
                  <input type="number" value={s.cost} onChange={e => updateCustom(s.id, { cost: Number(e.target.value) })}
                    min={0} step={1} placeholder="Costo" className="col-span-3 h-9 rounded-md border border-[var(--border-strong)] bg-input px-2 text-xs mono" />
                  <select value={s.currency} onChange={e => updateCustom(s.id, { currency: e.target.value as 'ARS' | 'USD' })}
                    className="col-span-2 h-9 rounded-md border border-[var(--border-strong)] bg-input px-2 text-xs">
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </select>
                  <button type="button" onClick={() => removeCustom(s.id)} className="col-span-1 text-muted-foreground hover:text-[var(--red)]">
                    <Trash2 className="w-3.5 h-3.5 mx-auto" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-[var(--border)] flex justify-between text-xs">
            <span className="text-muted-foreground">Subtotal servicios:</span>
            <span className="mono font-bold text-foreground">USD {Math.round(totals.servicesUSD)}</span>
          </div>
        </Card>
      </div>

      {/* RIGHT: Totals */}
      <div className="xl:col-span-2 print:col-span-5">
        <Card className="p-6 sticky top-5">
          <h2 className="text-[length:var(--h2-size)] font-semibold mb-4">Total del presupuesto</h2>
          <div className="space-y-2 text-sm">
            <Row label="Mano de obra" value={`USD ${Math.round(totals.laborUSD)}`} />
            <Row label="Servicios" value={`USD ${Math.round(totals.servicesUSD)}`} />
            <Row label="Subtotal" value={`USD ${Math.round(totals.subtotalUSD)}`} bold />
            <Row label={`Margen (${marginPct}%)`} value={`USD ${Math.round(totals.margin)}`} muted />
            <div className="h-px bg-[var(--border)] my-3" />
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Total {clientType}</span>
              <span className="mono text-3xl font-bold text-[var(--accent-strong)]">
                {clientType === 'ARS' ? formatARS(totals.totalARS) : `USD ${Math.round(totals.totalUSD)}`}
              </span>
            </div>
            <div className="text-xs text-muted-foreground text-right mt-1">
              {clientType === 'ARS'
                ? `(USD ${Math.round(totals.totalUSD)} a $${exchangeRate})`
                : `(${formatARS(totals.totalARS)} a $${exchangeRate})`
              }
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-[var(--border)] space-y-2 print:hidden">
            <Button type="button" onClick={saveQuote} className="w-full" size="lg" disabled={!linkedProjectId}>
              <Save className="w-4 h-4" /> Guardar en proyecto
            </Button>
            <Button type="button" variant="outline" onClick={printQuote} className="w-full" size="sm">
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </Button>
            {!linkedProjectId && (
              <p className="text-[10px] text-muted-foreground text-center">Vinculá un proyecto arriba para poder guardar el presupuesto.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`text-xs ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>{label}</span>
      <span className={`mono ${bold ? 'font-bold text-foreground' : muted ? 'text-muted-foreground' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}
