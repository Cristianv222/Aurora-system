import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import printerServiceRestaurant from '../../services/printerServiceRestaurant';

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface Printer {
  id: string;
  name: string;
  printer_type: 'thermal' | 'laser' | 'matrix';
  printer_type_display?: string;
  role: 'pos' | 'kitchen' | 'both';
  connection_type: 'usb' | 'network' | 'bluetooth' | 'serial';
  connection_string: string;
  port?: number | string | null;
  paper_width: number;
  characters_per_line: number;
  has_cash_drawer: boolean;
  cash_drawer_pin: number;
  cash_drawer_on_time: number;
  cash_drawer_off_time: number;
  is_active: boolean;
  is_default: boolean;
}

interface PrintJob {
  id: string;
  job_number: string;
  printer_name: string;
  document_type_display: string;
  status: 'pending' | 'printing' | 'completed' | 'failed' | 'cancelled';
  cash_drawer_opened: boolean;
  created_by?: string;
  created_at: string;
}

interface PrintSettings {
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  tax_id?: string;
  receipt_header?: string;
  receipt_footer?: string;
  auto_print_receipt: boolean;
  auto_print_kitchen: boolean;
  auto_open_drawer_on_payment: boolean;
  require_confirmation_to_open_drawer: boolean;
}

interface SystemStatus {
  system: 'online' | 'offline' | string;
  printers_active: number;
  jobs_pending: number;
  jobs_today: number;
  jobs_total: number;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pos: { bg: 'bg-blue-600', text: 'text-white', label: 'POS' },
  kitchen: { bg: 'bg-amber-600', text: 'text-white', label: 'Cocina' },
  both: { bg: 'bg-purple-600', text: 'text-white', label: 'Ambas' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending:   { bg: 'bg-blue-950/40 border border-blue-800/40', text: 'text-blue-400', label: 'Pendiente' },
  printing:  { bg: 'bg-emerald-950/40 border border-emerald-800/40', text: 'text-emerald-400', label: 'Imprimiendo' },
  completed: { bg: 'bg-emerald-900/40 border border-emerald-700/40', text: 'text-emerald-300', label: 'Completado' },
  failed:    { bg: 'bg-red-950/40 border border-red-850/40', text: 'text-red-300', label: 'Fallido' },
  cancelled: { bg: 'bg-stone-900/40 border border-stone-800/40', text: 'text-stone-300', label: 'Cancelado' },
};

// ── Reusable Form Components ──────────────────────────────────────────────────
interface FieldProps {
  label: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold text-slate-400">{label}</label>
    {children}
  </div>
);

interface SelectFieldProps {
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string | number; label: string }[];
}

const SelectField: React.FC<SelectFieldProps> = ({ label, value, onChange, options }) => (
  <Field label={label}>
    <select
      value={value}
      onChange={onChange}
      className="bg-slate-950 border border-slate-700 rounded-lg text-slate-100 px-3 py-2 text-sm outline-none w-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </Field>
);

interface InputFieldProps {
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
}

const InputField: React.FC<InputFieldProps> = ({ label, value, onChange, type = 'text', placeholder = '' }) => (
  <Field label={label}>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="bg-slate-950 border border-slate-700 rounded-lg text-slate-100 px-3 py-2 text-sm outline-none w-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
    />
  </Field>
);

interface CheckFieldProps {
  label: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  desc?: string;
}

const CheckField: React.FC<CheckFieldProps> = ({ label, checked, onChange, desc }) => (
  <label className="flex items-start gap-2.5 cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600 accent-indigo-500 focus:ring-indigo-500"
    />
    <div>
      <div className="text-sm font-semibold text-slate-200">{label}</div>
      {desc && <div className="text-xs text-slate-400">{desc}</div>}
    </div>
  </label>
);

interface PrinterForm {
  name: string;
  printer_type: 'thermal' | 'laser' | 'matrix';
  role: 'pos' | 'kitchen' | 'both';
  connection_type: 'usb' | 'network' | 'bluetooth' | 'serial';
  connection_string: string;
  port: string;
  paper_width: number;
  characters_per_line: number;
  has_cash_drawer: boolean;
  cash_drawer_pin: number;
  cash_drawer_on_time: number;
  cash_drawer_off_time: number;
  is_active: boolean;
  is_default: boolean;
}

// ─── Empty printer form ───────────────────────────────────────────────────────
const emptyForm: PrinterForm = {
  name: '',
  printer_type: 'thermal',
  role: 'pos',
  connection_type: 'usb',
  connection_string: '',
  port: '',
  paper_width: 80,
  characters_per_line: 42,
  has_cash_drawer: true,
  cash_drawer_pin: 0,
  cash_drawer_on_time: 100,
  cash_drawer_off_time: 100,
  is_active: true,
  is_default: false,
};

// ─── Main Component ─────────────────────────────────────────────────────────
const Impresoras: React.FC = () => {
  const navigate = useNavigate();
  const API = '/api/restaurant/hardware';

  // Tabs
  const [tab, setTab] = useState<'printers' | 'jobs' | 'settings' | 'status'>('printers');

  // Printers
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PrinterForm>(emptyForm);
  const [saving, setSaving] = useState<boolean>(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Jobs
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState<boolean>(false);

  // Settings
  const [settings, setSettings] = useState<PrintSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  // System Status
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchPrinters = useCallback(async () => {
    setLoadingPrinters(true);
    try {
      const res = await api.get(`${API}/printers/`);
      setPrinters(res.data.results || res.data || []);
    } catch { /* ignore */ } finally {
      setLoadingPrinters(false);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await api.get(`${API}/jobs/`);
      setJobs(res.data.results || res.data || []);
    } catch { /* ignore */ } finally {
      setLoadingJobs(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get(`${API}/settings/`);
      setSettings(res.data);
    } catch { /* ignore */ }
  }, []);

  const fetchStatus = useCallback(async () => {
    const s = await printerServiceRestaurant.getPrintStatus();
    setSysStatus(s);
  }, []);

  useEffect(() => {
    fetchPrinters();
  }, [fetchPrinters]);

  useEffect(() => {
    if (tab === 'jobs') fetchJobs();
    else if (tab === 'settings') fetchSettings();
    else if (tab === 'status') {
      fetchStatus();
      fetchPrinters();
    }
  }, [tab, fetchJobs, fetchSettings, fetchStatus, fetchPrinters]);

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (p: Printer) => {
    setForm({
      name: p.name,
      printer_type: p.printer_type,
      role: p.role,
      connection_type: p.connection_type,
      connection_string: p.connection_string,
      port: p.port ? String(p.port) : '',
      paper_width: p.paper_width,
      characters_per_line: p.characters_per_line,
      has_cash_drawer: p.has_cash_drawer,
      cash_drawer_pin: p.cash_drawer_pin,
      cash_drawer_on_time: p.cash_drawer_on_time,
      cash_drawer_off_time: p.cash_drawer_off_time,
      is_active: p.is_active,
      is_default: p.is_default,
    });
    setEditingId(p.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, port: form.port ? parseInt(form.port, 10) : null };
      if (editingId) {
        await api.patch(`${API}/printers/${editingId}/`, payload);
      } else {
        await api.post(`${API}/printers/`, payload);
      }
      setShowModal(false);
      fetchPrinters();
    } catch (e: any) {
      alert('Error al guardar: ' + JSON.stringify(e.response?.data || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar impresora "${name}"?`)) return;
    try {
      await api.delete(`${API}/printers/${id}/`);
      fetchPrinters();
    } catch (e) {
      alert('Error al eliminar');
    }
  };

  const handleTestPrint = async (p: Printer) => {
    setTestingId(p.id);
    try {
      await api.post(`${API}/printers/${p.id}/test_print/`);
      alert('✅ Prueba enviada. Revisa la impresora.');
    } catch (e: any) {
      alert('❌ Error: ' + (e.response?.data?.message || e.message));
    } finally {
      setTestingId(null);
    }
  };

  const handleOpenDrawer = async (p: Printer) => {
    try {
      await api.post(`${API}/printers/${p.id}/test_cash_drawer/`);
      alert('✅ Señal de apertura de caja enviada.');
    } catch (e: any) {
      alert('❌ Error abriendo caja: ' + (e.response?.data?.message || e.message));
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      await api.patch(`${API}/settings/`, settings);
      alert('✅ Configuración guardada.');
    } catch (e) {
      alert('Error al guardar configuración');
    } finally {
      setSavingSettings(false);
    }
  };

  const f = (key: keyof typeof emptyForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const val = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const sf = (key: keyof PrintSettings) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const val = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setSettings(prev => prev ? ({ ...prev, [key]: val }) : null);
  };

  // ─── Tabs ────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'printers', icon: 'printer', label: 'Impresoras' },
    { id: 'jobs',     icon: 'list-task', label: 'Historial de Trabajos' },
    { id: 'settings', icon: 'gear-fill', label: 'Configuración' },
    { id: 'status',   icon: 'activity', label: 'Estado del Sistema' },
  ] as const;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/restaurant/panel')}
            className="bg-transparent border-none text-slate-400 hover:text-white text-xl cursor-pointer p-0 transition-colors"
          >
            <i className="bi bi-arrow-left-circle-fill"></i>
          </button>
          <div>
            <h1 className="m-0 text-xl font-bold flex items-center gap-2">
              <i className="bi bi-printer-fill text-indigo-500"></i>
              Gestión de Impresoras
            </h1>
            <p className="m-0 text-xs text-slate-400">Configura impresoras POS y de cocina</p>
          </div>
        </div>
        {tab === 'printers' && (
          <button
            onClick={openNew}
            className="bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-lg px-4 py-2 font-semibold text-sm cursor-pointer transition-colors flex items-center gap-1.5 shadow-md"
          >
            <i className="bi bi-plus-lg"></i>
            Nueva Impresora
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-slate-800 border-b border-slate-700 flex overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`bg-transparent border-none cursor-pointer px-5 py-3 font-semibold text-sm whitespace-nowrap flex items-center gap-1.5 border-b-2 transition-colors ${
              tab === t.id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <i className={`bi bi-${t.icon}`}></i> {t.label}
          </button>
        ))}
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        {/* ── TAB: Printers ─────────────────────────────────────────────── */}
        {tab === 'printers' && (
          <>
            {loadingPrinters ? (
              <div className="text-center py-16 text-slate-400 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-2"></div>
                Cargando impresoras...
              </div>
            ) : printers.length === 0 ? (
              <div className="text-center py-16 text-slate-400 flex flex-col items-center">
                <i className="bi bi-printer text-5xl mb-4 text-slate-600"></i>
                <p className="mb-4">No hay impresoras configuradas aún.</p>
                <button
                  onClick={openNew}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-lg px-4 py-2 font-semibold text-sm cursor-pointer transition-colors flex items-center gap-1.5 shadow-md"
                >
                  <i className="bi bi-plus-lg"></i>
                  Agregar primera impresora
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {printers.map(p => (
                  <div
                    key={p.id}
                    className={`bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-center gap-4 flex-wrap border-l-4 transition-opacity ${
                      p.is_active ? 'opacity-100' : 'opacity-60'
                    }`}
                    style={{ borderLeftColor: p.role === 'pos' ? '#2563eb' : p.role === 'kitchen' ? '#d97706' : '#7c3aed' }}
                  >
                    {/* Icon */}
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0`}
                      style={{ backgroundColor: p.role === 'pos' ? 'rgba(37,99,235,0.15)' : p.role === 'kitchen' ? 'rgba(217,119,6,0.15)' : 'rgba(124,58,237,0.15)' }}
                    >
                      <i
                        className="bi bi-printer-fill text-2xl"
                        style={{ color: p.role === 'pos' ? '#3b82f6' : p.role === 'kitchen' ? '#f59e0b' : '#a78bfa' }}
                      ></i>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-bold text-lg flex items-center gap-2">
                        {p.name}
                        {p.is_default && (
                          <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-semibold border border-amber-500/30">
                            ★ Default
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {p.connection_type.toUpperCase()} · {p.connection_string}
                        {p.port ? `:${p.port}` : ''} · {p.paper_width}mm · {p.characters_per_line} col
                      </div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          ROLE_COLORS[p.role]?.bg || 'bg-slate-700'
                        } text-white`}>
                          {ROLE_COLORS[p.role]?.label || p.role}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          p.is_active
                            ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400'
                            : 'bg-stone-900/40 border-stone-850/40 text-stone-400'
                        }`}>
                          {p.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                        {p.has_cash_drawer && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-950/40 border border-blue-800/40 text-blue-400">
                            🗄 Cajón
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleTestPrint(p)}
                        disabled={testingId === p.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-lg px-3 py-1.5 font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                      >
                        <i className={`bi bi-${testingId === p.id ? 'hourglass-split animate-spin' : 'printer'}`}></i>
                        {testingId === p.id ? 'Probando…' : 'Test'}
                      </button>
                      {p.has_cash_drawer && (
                        <button
                          onClick={() => handleOpenDrawer(p)}
                          className="bg-amber-600 hover:bg-amber-700 text-white border-none rounded-lg px-3 py-1.5 font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <i className="bi bi-safe"></i>
                          Caja
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(p)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-lg px-3 py-1.5 font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <i className="bi bi-pencil-fill"></i>
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        className="bg-rose-600 hover:bg-rose-700 text-white border-none rounded-lg px-2.5 py-1.5 font-semibold text-xs cursor-pointer transition-colors flex items-center shadow-sm"
                        title="Eliminar"
                      >
                        <i className="bi bi-trash3-fill"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── TAB: Jobs ─────────────────────────────────────────────────── */}
        {tab === 'jobs' && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="m-0 text-base font-bold">Historial de Trabajos de Impresión</h2>
              <button
                onClick={fetchJobs}
                className="bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-lg px-3 py-1.5 font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1 shadow-sm"
              >
                <i className="bi bi-arrow-clockwise"></i>
                Refrescar
              </button>
            </div>
            {loadingJobs ? (
              <div className="text-center py-10 flex justify-center items-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mr-2"></div>
                Cargando trabajos...
              </div>
            ) : jobs.length === 0 ? (
              <p className="text-slate-400 text-center py-8">Sin trabajos de impresión.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 uppercase tracking-wider font-bold">
                      <th className="p-3"># Trabajo</th>
                      <th className="p-3">Impresora</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3">Cajón</th>
                      <th className="p-3">Por</th>
                      <th className="p-3">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {jobs.map((j, i) => (
                      <tr key={j.id} className={i % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/80'}>
                        <td className="p-3 font-mono text-[11px] text-slate-300">{j.job_number}</td>
                        <td className="p-3 font-semibold text-slate-200">{j.printer_name}</td>
                        <td className="p-3 text-slate-400">{j.document_type_display}</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-semibold border ${
                            STATUS_COLORS[j.status]?.bg || STATUS_COLORS.pending.bg
                          } ${STATUS_COLORS[j.status]?.text || STATUS_COLORS.pending.text}`}>
                            {STATUS_COLORS[j.status]?.label || j.status}
                          </span>
                        </td>
                        <td className="p-3">{j.cash_drawer_opened ? '✅' : '—'}</td>
                        <td className="p-3 text-slate-400 font-mono text-[10px]">{j.created_by || 'sistema'}</td>
                        <td className="p-3 text-slate-400 font-mono text-[10px]">{new Date(j.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Settings ─────────────────────────────────────────────── */}
        {tab === 'settings' && settings && (
          <div className="space-y-6">
            <h2 className="text-base font-bold mb-4">Configuración Global de Impresión</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card: Empresa */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
                <h3 className="m-0 text-sm font-bold text-indigo-400 flex items-center gap-1.5 border-b border-slate-700 pb-2">
                  <i className="bi bi-building"></i>Datos de Empresa
                </h3>
                <div className="space-y-3">
                  <InputField label="Nombre Empresa" value={settings.company_name || ''} onChange={sf('company_name')} />
                  <InputField label="Dirección" value={settings.company_address || ''} onChange={sf('company_address')} />
                  <InputField label="Teléfono" value={settings.company_phone || ''} onChange={sf('company_phone')} />
                  <InputField label="Email" type="email" value={settings.company_email || ''} onChange={sf('company_email')} />
                  <InputField label="RUC / NIT" value={settings.tax_id || ''} onChange={sf('tax_id')} />
                </div>
              </div>

              {/* Card: Ticket */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
                <h3 className="m-0 text-sm font-bold text-indigo-400 flex items-center gap-1.5 border-b border-slate-700 pb-2">
                  <i className="bi bi-receipt"></i>Mensajes del Ticket
                </h3>
                <div className="space-y-3">
                  <Field label="Encabezado">
                    <textarea
                      value={settings.receipt_header || ''}
                      onChange={sf('receipt_header')}
                      rows={3}
                      className="bg-slate-950 border border-slate-700 rounded-lg text-slate-100 px-3 py-2 text-sm outline-none w-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-y"
                    />
                  </Field>
                  <Field label="Pie de Página">
                    <textarea
                      value={settings.receipt_footer || ''}
                      onChange={sf('receipt_footer')}
                      rows={3}
                      className="bg-slate-950 border border-slate-700 rounded-lg text-slate-100 px-3 py-2 text-sm outline-none w-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-y"
                    />
                  </Field>
                </div>
              </div>

              {/* Card: Automático */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4 md:col-span-2">
                <h3 className="m-0 text-sm font-bold text-indigo-400 flex items-center gap-1.5 border-b border-slate-700 pb-2">
                  <i className="bi bi-toggles"></i>Comportamiento Automático
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CheckField label="Imprimir ticket al pagar" checked={settings.auto_print_receipt} onChange={sf('auto_print_receipt')} desc="Se genera un ticket al completar el pago" />
                  <CheckField label="Imprimir comanda a cocina" checked={settings.auto_print_kitchen} onChange={sf('auto_print_kitchen')} desc="Enviar orden a cocina al confirmar pedido" />
                  <CheckField label="Abrir caja automáticamente" checked={settings.auto_open_drawer_on_payment} onChange={sf('auto_open_drawer_on_payment')} desc="Al imprimir ticket de venta" />
                  <CheckField label="Pedir confirmación para abrir caja" checked={settings.require_confirmation_to_open_drawer} onChange={sf('require_confirmation_to_open_drawer')} desc="Muestra un aviso antes de abrir" />
                </div>
              </div>
            </div>

            <div className="mt-6 text-right">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white border-none rounded-lg px-5 py-2.5 font-semibold text-sm cursor-pointer transition-colors flex items-center gap-1.5 ml-auto shadow-md"
              >
                <i className={`bi bi-${savingSettings ? 'hourglass-split animate-spin' : 'floppy-fill'}`}></i>
                {savingSettings ? 'Guardando…' : 'Guardar Configuración'}
              </button>
            </div>
          </div>
        )}

        {/* ── TAB: Status ───────────────────────────────────────────────── */}
        {tab === 'status' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="m-0 text-base font-bold">Estado del Sistema de Impresión</h2>
              <button
                onClick={() => { fetchStatus(); fetchPrinters(); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-lg px-3 py-1.5 font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1 shadow-sm"
              >
                <i className="bi bi-arrow-clockwise"></i>
                Actualizar
              </button>
            </div>

            {sysStatus && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {[
                  {
                    label: 'Estado',
                    value: sysStatus.system === 'online' ? '🟢 Online' : '🔴 Error',
                    colorClass: sysStatus.system === 'online' ? 'text-emerald-400' : 'text-rose-400'
                  },
                  { label: 'Impresoras Activas', value: sysStatus.printers_active, colorClass: 'text-indigo-400' },
                  { label: 'Jobs Pendientes', value: sysStatus.jobs_pending, colorClass: 'text-amber-400' },
                  { label: 'Jobs Hoy', value: sysStatus.jobs_today, colorClass: 'text-slate-100' },
                  { label: 'Total Jobs', value: sysStatus.jobs_total, colorClass: 'text-slate-400' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                    <div className={`text-xl font-extrabold ${s.colorClass}`}>{s.value}</div>
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Impresoras en detalle */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold m-0 border-b border-slate-700 pb-2">Detalle de Conectividad</h3>
              <div className="grid gap-3">
                {printers.map(p => (
                  <div key={p.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex justify-between items-center gap-4 flex-wrap">
                    <div>
                      <div className="font-bold text-sm text-slate-200">{p.name}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{p.connection_string}{p.port ? `:${p.port}` : ''} · {p.printer_type_display || p.printer_type}</div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        ROLE_COLORS[p.role]?.bg || 'bg-slate-700'
                      } text-white`}>
                        {ROLE_COLORS[p.role]?.label || p.role}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        p.is_active
                          ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400'
                          : 'bg-stone-900/40 border-stone-850/40 text-stone-400'
                      }`}>
                        {p.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                      {p.is_default && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          ★ Default
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTestPrint(p)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-lg px-3 py-1.5 font-semibold text-xs cursor-pointer transition-colors shadow-sm"
                      >
                        Test
                      </button>
                      {p.has_cash_drawer && (
                        <button
                          onClick={() => handleOpenDrawer(p)}
                          className="bg-amber-600 hover:bg-amber-700 text-white border-none rounded-lg px-3 py-1.5 font-semibold text-xs cursor-pointer transition-colors shadow-sm"
                        >
                          Abrir Caja
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: Create / Edit Printer ────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center">
              <h2 className="m-0 text-base font-bold flex items-center gap-2">
                <i className="bi bi-printer-fill text-indigo-500"></i>
                {editingId ? 'Editar Impresora' : 'Nueva Impresora'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="bg-transparent border-none text-slate-400 hover:text-white text-2xl cursor-pointer p-0 leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <InputField label="Nombre" value={form.name} onChange={f('name')} placeholder="Ej: Impresora POS Caja 1" />

              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Tipo"
                  value={form.printer_type}
                  onChange={f('printer_type')}
                  options={[
                    { value: 'thermal', label: 'Térmica (Tickets)' },
                    { value: 'laser', label: 'Láser' },
                    { value: 'matrix', label: 'Matriz de Puntos' },
                  ]}
                />
                <SelectField
                  label="Rol"
                  value={form.role}
                  onChange={f('role')}
                  options={[
                    { value: 'pos', label: 'Punto de Venta (POS)' },
                    { value: 'kitchen', label: 'Cocina' },
                    { value: 'both', label: 'Ambas funciones' },
                  ]}
                />
              </div>

              <SelectField
                label="Tipo de Conexión"
                value={form.connection_type}
                onChange={f('connection_type')}
                options={[
                  { value: 'usb', label: 'USB' },
                  { value: 'network', label: 'Red / IP' },
                  { value: 'bluetooth', label: 'Bluetooth' },
                  { value: 'serial', label: 'Serial / COM' },
                ]}
              />

              <div className="grid grid-cols-2 gap-3">
                <InputField
                  label="Dirección / Puerto Serie"
                  value={form.connection_string}
                  onChange={f('connection_string')}
                  placeholder={form.connection_type === 'network' ? '192.168.1.100' : form.connection_type === 'usb' ? '/dev/usb/lp0' : 'COM1'}
                />
                <InputField label="Puerto TCP (solo red)" value={form.port} onChange={f('port')} type="number" placeholder="9100" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InputField label="Ancho papel (mm)" value={form.paper_width} onChange={f('paper_width')} type="number" />
                <InputField label="Caracteres / línea" value={form.characters_per_line} onChange={f('characters_per_line')} type="number" />
              </div>

              <div className="border-t border-slate-700 pt-4 space-y-3">
                <CheckField label="Tiene cajón de efectivo" checked={form.has_cash_drawer} onChange={f('has_cash_drawer')} />
                {form.has_cash_drawer && (
                  <div className="grid grid-cols-3 gap-3 pl-6">
                    <SelectField
                      label="Pin cajón"
                      value={form.cash_drawer_pin}
                      onChange={f('cash_drawer_pin')}
                      options={[
                        { value: 0, label: 'Pin 2' },
                        { value: 1, label: 'Pin 5' }
                      ]}
                    />
                    <InputField label="Tiempo ON (ms)" value={form.cash_drawer_on_time} onChange={f('cash_drawer_on_time')} type="number" />
                    <InputField label="Tiempo OFF (ms)" value={form.cash_drawer_off_time} onChange={f('cash_drawer_off_time')} type="number" />
                  </div>
                )}
                <CheckField label="Impresora activa" checked={form.is_active} onChange={f('is_active')} />
                <CheckField label="Impresora por defecto" checked={form.is_default} onChange={f('is_default')} />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-slate-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="bg-slate-700 hover:bg-slate-600 text-slate-100 border-none rounded-lg px-4 py-2 font-semibold text-sm cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-lg px-5 py-2 font-semibold text-sm cursor-pointer transition-colors flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <i className={`bi bi-${saving ? 'hourglass-split animate-spin' : 'floppy-fill'}`}></i>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Impresoras;
