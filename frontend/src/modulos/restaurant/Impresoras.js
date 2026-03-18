import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import printerServiceRestaurant from '../../services/printerServiceRestaurant';

// ─── Style Tokens ─────────────────────────────────────────────────────────────
const COLORS = {
  bg: '#0f172a',
  card: '#1e293b',
  cardBorder: '#334155',
  accent: '#6366f1',
  accentHover: '#4f46e5',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  text: '#f1f5f9',
  muted: '#94a3b8',
  input: '#0f172a',
};

const ROLE_COLORS = {
  pos: { bg: '#1d4ed8', label: 'POS' },
  kitchen: { bg: '#d97706', label: 'Cocina' },
  both: { bg: '#7c3aed', label: 'Ambas' },
};

const STATUS_COLORS = {
  pending:   { bg: '#1e3a5f', text: '#60a5fa', label: 'Pendiente' },
  printing:  { bg: '#1a3a2a', text: '#34d399', label: 'Imprimiendo' },
  completed: { bg: '#14532d', text: '#86efac', label: 'Completado' },
  failed:    { bg: '#450a0a', text: '#fca5a5', label: 'Fallido' },
  cancelled: { bg: '#1c1917', text: '#a8a29e', label: 'Cancelado' },
};

const badge = (color, text) => (
  <span style={{
    backgroundColor: color.bg,
    color: color.text || '#fff',
    padding: '2px 10px',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  }}>{text}</span>
);

const btn = (onClick, color, icon, label, small = false) => (
  <button
    onClick={onClick}
    style={{
      backgroundColor: color,
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      padding: small ? '5px 12px' : '8px 16px',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: small ? '0.78rem' : '0.875rem',
      display: 'flex', alignItems: 'center', gap: '6px',
      transition: 'opacity .15s',
    }}
    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
  >
    {icon && <i className={`bi bi-${icon}`}></i>} {label}
  </button>
);

// ── Reusable Field ──────────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <label style={{ fontSize: '0.78rem', color: COLORS.muted, fontWeight: 600 }}>{label}</label>
    {children}
  </div>
);

const inputStyle = {
  backgroundColor: COLORS.input,
  border: `1px solid ${COLORS.cardBorder}`,
  borderRadius: '8px',
  color: COLORS.text,
  padding: '8px 12px',
  fontSize: '0.875rem',
  outline: 'none',
  width: '100%',
};

const SelectField = ({ label, value, onChange, options }) => (
  <Field label={label}>
    <select value={value} onChange={onChange} style={inputStyle}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </Field>
);

const InputField = ({ label, value, onChange, type = 'text', placeholder = '' }) => (
  <Field label={label}>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={inputStyle}
    />
  </Field>
);

const CheckField = ({ label, checked, onChange, desc }) => (
  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
    <input type="checkbox" checked={checked} onChange={onChange}
      style={{ marginTop: '2px', accentColor: COLORS.accent }} />
    <div>
      <div style={{ fontSize: '0.875rem', color: COLORS.text, fontWeight: 600 }}>{label}</div>
      {desc && <div style={{ fontSize: '0.75rem', color: COLORS.muted }}>{desc}</div>}
    </div>
  </label>
);

// ─── Empty printer form ───────────────────────────────────────────────────────
const emptyForm = {
  name: '', printer_type: 'thermal', role: 'pos',
  connection_type: 'usb', connection_string: '', port: '',
  paper_width: 80, characters_per_line: 42,
  has_cash_drawer: true, cash_drawer_pin: 0,
  cash_drawer_on_time: 100, cash_drawer_off_time: 100,
  is_active: true, is_default: false,
};

// ─── Main Component ─────────────────────────────────────────────────────────
const Impresoras = () => {
  const navigate = useNavigate();
  const API = '/api/restaurant/hardware';

  // Tabs
  const [tab, setTab] = useState('printers'); // printers | jobs | settings | status

  // Printers
  const [printers, setPrinters] = useState([]);
  const [loadingPrinters, setLoadingPrinters] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);

  // Jobs
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Settings
  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // System Status
  const [sysStatus, setSysStatus] = useState(null);

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

  useEffect(() => { fetchPrinters(); }, [fetchPrinters]);

  useEffect(() => {
    if (tab === 'jobs') fetchJobs();
    else if (tab === 'settings') fetchSettings();
    else if (tab === 'status') { fetchStatus(); fetchPrinters(); }
  }, [tab, fetchJobs, fetchSettings, fetchStatus, fetchPrinters]);

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const openNew = () => { setForm(emptyForm); setEditingId(null); setShowModal(true); };
  const openEdit = (p) => {
    setForm({
      name: p.name, printer_type: p.printer_type, role: p.role,
      connection_type: p.connection_type, connection_string: p.connection_string,
      port: p.port || '', paper_width: p.paper_width,
      characters_per_line: p.characters_per_line,
      has_cash_drawer: p.has_cash_drawer,
      cash_drawer_pin: p.cash_drawer_pin,
      cash_drawer_on_time: p.cash_drawer_on_time,
      cash_drawer_off_time: p.cash_drawer_off_time,
      is_active: p.is_active, is_default: p.is_default,
    });
    setEditingId(p.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, port: form.port ? parseInt(form.port) : null };
      if (editingId) await api.patch(`${API}/printers/${editingId}/`, payload);
      else await api.post(`${API}/printers/`, payload);
      setShowModal(false);
      fetchPrinters();
    } catch (e) {
      alert('Error al guardar: ' + JSON.stringify(e.response?.data || e.message));
    } finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Eliminar impresora "${name}"?`)) return;
    try {
      await api.delete(`${API}/printers/${id}/`);
      fetchPrinters();
    } catch (e) { alert('Error al eliminar'); }
  };

  const handleTestPrint = async (p) => {
    setTestingId(p.id);
    try {
      await api.post(`${API}/printers/${p.id}/test_print/`);
      alert('✅ Prueba enviada. Revisa la impresora.');
    } catch (e) { alert('❌ Error: ' + (e.response?.data?.message || e.message)); }
    finally { setTestingId(null); }
  };

  const handleOpenDrawer = async (p) => {
    try {
      await api.post(`${API}/printers/${p.id}/test_cash_drawer/`);
      alert('✅ Señal de apertura de caja enviada.');
    } catch (e) { alert('❌ Error abriendo caja: ' + (e.response?.data?.message || e.message)); }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.patch(`${API}/settings/`, settings);
      alert('✅ Configuración guardada.');
    } catch (e) { alert('Error al guardar configuración'); }
    finally { setSavingSettings(false); }
  };

  const f = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const sf = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  // ─── Tabs ────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'printers', icon: 'printer', label: 'Impresoras' },
    { id: 'jobs',     icon: 'list-task', label: 'Historial de Trabajos' },
    { id: 'settings', icon: 'gear-fill', label: 'Configuración' },
    { id: 'status',   icon: 'activity', label: 'Estado del Sistema' },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: COLORS.bg, color: COLORS.text, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ backgroundColor: COLORS.card, borderBottom: `1px solid ${COLORS.cardBorder}`, padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/restaurant/panel')} style={{ background: 'none', border: 'none', color: COLORS.muted, fontSize: '1.2rem', cursor: 'pointer' }}>
            <i className="bi bi-arrow-left-circle-fill"></i>
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}><i className="bi bi-printer-fill" style={{ marginRight: '8px', color: COLORS.accent }}></i>Gestión de Impresoras</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: COLORS.muted }}>Configura impresoras POS y de cocina</p>
          </div>
        </div>
        {tab === 'printers' && btn(openNew, COLORS.accent, 'plus-lg', 'Nueva Impresora')}
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: COLORS.card, borderBottom: `1px solid ${COLORS.cardBorder}`, display: 'flex', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none',
            borderBottom: tab === t.id ? `3px solid ${COLORS.accent}` : '3px solid transparent',
            color: tab === t.id ? COLORS.accent : COLORS.muted,
            padding: '12px 20px', cursor: 'pointer', fontWeight: 600,
            fontSize: '0.875rem', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: '6px',
            transition: 'color .15s',
          }}>
            <i className={`bi bi-${t.icon}`}></i> {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>

        {/* ── TAB: Printers ─────────────────────────────────────────────── */}
        {tab === 'printers' && (
          <>
            {loadingPrinters ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: COLORS.muted }}>
                <div className="spinner-border text-primary" role="status"></div>
              </div>
            ) : printers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: COLORS.muted }}>
                <i className="bi bi-printer" style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}></i>
                <p>No hay impresoras configuradas aún.</p>
                {btn(openNew, COLORS.accent, 'plus-lg', 'Agregar primera impresora')}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {printers.map(p => (
                  <div key={p.id} style={{
                    backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
                    borderRadius: '12px', padding: '1.25rem',
                    display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
                    borderLeft: `4px solid ${ROLE_COLORS[p.role]?.bg || COLORS.accent}`,
                    opacity: p.is_active ? 1 : 0.55,
                  }}>
                    {/* Icon */}
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: `${ROLE_COLORS[p.role]?.bg}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="bi bi-printer-fill" style={{ fontSize: '1.4rem', color: ROLE_COLORS[p.role]?.bg || COLORS.accent }}></i>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                        {p.name}
                        {p.is_default && <span style={{ marginLeft: '8px', fontSize: '0.7rem', backgroundColor: '#facc1533', color: '#facc15', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>★ Default</span>}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: COLORS.muted, marginTop: '2px' }}>
                        {p.connection_type.toUpperCase()} · {p.connection_string}{p.port ? `:${p.port}` : ''} · {p.paper_width}mm · {p.characters_per_line} col
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {badge({ bg: ROLE_COLORS[p.role]?.bg || '#334155', text: '#fff' }, ROLE_COLORS[p.role]?.label || p.role)}
                        {badge(p.is_active ? { bg: '#14532d', text: '#86efac' } : { bg: '#1c1917', text: '#a8a29e' }, p.is_active ? 'Activa' : 'Inactiva')}
                        {p.has_cash_drawer && badge({ bg: '#1e3a5f', text: '#93c5fd' }, '🗄 Cajón')}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {btn(() => handleTestPrint(p), COLORS.success, testingId === p.id ? 'hourglass-split' : 'printer', testingId === p.id ? 'Probando…' : 'Test', true)}
                      {p.has_cash_drawer && btn(() => handleOpenDrawer(p), COLORS.warning, 'safe', 'Caja', true)}
                      {btn(() => openEdit(p), COLORS.accent, 'pencil-fill', 'Editar', true)}
                      {btn(() => handleDelete(p.id, p.name), COLORS.danger, 'trash3-fill', '', true)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── TAB: Jobs ─────────────────────────────────────────────────── */}
        {tab === 'jobs' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Historial de Trabajos de Impresión</h2>
              {btn(fetchJobs, COLORS.accent, 'arrow-clockwise', 'Refrescar', true)}
            </div>
            {loadingJobs ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner-border text-primary"></div></div>
            ) : jobs.length === 0 ? (
              <p style={{ color: COLORS.muted, textAlign: 'center', padding: '2rem' }}>Sin trabajos de impresión.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${COLORS.cardBorder}`, color: COLORS.muted, textAlign: 'left' }}>
                      {['# Trabajo', 'Impresora', 'Tipo', 'Estado', 'Cajón', 'Por', 'Fecha'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j, i) => (
                      <tr key={j.id} style={{ borderBottom: `1px solid ${COLORS.cardBorder}`, backgroundColor: i % 2 === 0 ? 'transparent' : '#ffffff08' }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.78rem' }}>{j.job_number}</td>
                        <td style={{ padding: '8px 12px' }}>{j.printer_name}</td>
                        <td style={{ padding: '8px 12px', color: COLORS.muted }}>{j.document_type_display}</td>
                        <td style={{ padding: '8px 12px' }}>{badge(STATUS_COLORS[j.status] || STATUS_COLORS.pending, STATUS_COLORS[j.status]?.label || j.status)}</td>
                        <td style={{ padding: '8px 12px' }}>{j.cash_drawer_opened ? '✅' : '—'}</td>
                        <td style={{ padding: '8px 12px', color: COLORS.muted, fontSize: '0.78rem' }}>{j.created_by || 'sistema'}</td>
                        <td style={{ padding: '8px 12px', color: COLORS.muted, fontSize: '0.78rem' }}>{new Date(j.created_at).toLocaleString()}</td>
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
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Configuración Global de Impresión</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {/* Card: Empresa */}
              <div style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '12px', padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: COLORS.accent }}>
                  <i className="bi bi-building" style={{ marginRight: '6px' }}></i>Datos de Empresa
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <InputField label="Nombre Empresa" value={settings.company_name || ''} onChange={sf('company_name')} />
                  <InputField label="Dirección" value={settings.company_address || ''} onChange={sf('company_address')} />
                  <InputField label="Teléfono" value={settings.company_phone || ''} onChange={sf('company_phone')} />
                  <InputField label="Email" type="email" value={settings.company_email || ''} onChange={sf('company_email')} />
                  <InputField label="RUC / NIT" value={settings.tax_id || ''} onChange={sf('tax_id')} />
                </div>
              </div>

              {/* Card: Ticket */}
              <div style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '12px', padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: COLORS.accent }}>
                  <i className="bi bi-receipt" style={{ marginRight: '6px' }}></i>Mensajes del Ticket
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Field label="Encabezado">
                    <textarea value={settings.receipt_header || ''} onChange={sf('receipt_header')}
                      rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  </Field>
                  <Field label="Pie de Página">
                    <textarea value={settings.receipt_footer || ''} onChange={sf('receipt_footer')}
                      rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  </Field>
                </div>
              </div>

              {/* Card: Automático */}
              <div style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '12px', padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: COLORS.accent }}>
                  <i className="bi bi-toggles" style={{ marginRight: '6px' }}></i>Comportamiento Automático
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <CheckField label="Imprimir ticket al pagar" checked={settings.auto_print_receipt} onChange={sf('auto_print_receipt')} desc="Se genera un ticket al completar el pago" />
                  <CheckField label="Imprimir comanda a cocina" checked={settings.auto_print_kitchen} onChange={sf('auto_print_kitchen')} desc="Enviar orden a cocina al confirmar pedido" />
                  <CheckField label="Abrir caja automáticamente" checked={settings.auto_open_drawer_on_payment} onChange={sf('auto_open_drawer_on_payment')} desc="Al imprimir ticket de venta" />
                  <CheckField label="Pedir confirmación para abrir caja" checked={settings.require_confirmation_to_open_drawer} onChange={sf('require_confirmation_to_open_drawer')} desc="Muestra un aviso antes de abrir" />
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              {btn(handleSaveSettings, COLORS.success, savingSettings ? 'hourglass-split' : 'floppy-fill', savingSettings ? 'Guardando…' : 'Guardar Configuración')}
            </div>
          </div>
        )}

        {/* ── TAB: Status ───────────────────────────────────────────────── */}
        {tab === 'status' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Estado del Sistema de Impresión</h2>
              {btn(() => { fetchStatus(); fetchPrinters(); }, COLORS.accent, 'arrow-clockwise', 'Actualizar', true)}
            </div>

            {sysStatus && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Estado', value: sysStatus.system === 'online' ? '🟢 Online' : '🔴 Error', color: sysStatus.system === 'online' ? COLORS.success : COLORS.danger },
                  { label: 'Impresoras Activas', value: sysStatus.printers_active, color: COLORS.accent },
                  { label: 'Jobs Pendientes', value: sysStatus.jobs_pending, color: COLORS.warning },
                  { label: 'Jobs Hoy', value: sysStatus.jobs_today, color: COLORS.text },
                  { label: 'Total Jobs', value: sysStatus.jobs_total, color: COLORS.muted },
                ].map(s => (
                  <div key={s.label} style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '0.78rem', color: COLORS.muted, marginTop: '4px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Impresoras en detalle */}
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Impresoras Registradas</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              {printers.map(p => (
                <div key={p.id} style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '10px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: '0.78rem', color: COLORS.muted }}>{p.connection_string}{p.port ? `:${p.port}` : ''} · {p.printer_type_display}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {badge({ bg: ROLE_COLORS[p.role]?.bg || '#334155', text: '#fff' }, ROLE_COLORS[p.role]?.label || p.role)}
                    {badge(p.is_active ? { bg: '#14532d', text: '#86efac' } : { bg: '#1c1917', text: '#a8a29e' }, p.is_active ? 'Activa' : 'Inactiva')}
                    {p.is_default && badge({ bg: '#78350f', text: '#fcd34d' }, '★ Default')}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {btn(() => handleTestPrint(p), COLORS.success, 'printer', 'Test', true)}
                    {p.has_cash_drawer && btn(() => handleOpenDrawer(p), COLORS.warning, 'safe', 'Abrir Caja', true)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: Create / Edit Printer ────────────────────────────────────── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '16px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${COLORS.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                <i className="bi bi-printer-fill" style={{ marginRight: '8px', color: COLORS.accent }}></i>
                {editingId ? 'Editar Impresora' : 'Nueva Impresora'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: COLORS.muted, fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <InputField label="Nombre" value={form.name} onChange={f('name')} placeholder="Ej: Impresora POS Caja 1" />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <SelectField label="Tipo" value={form.printer_type} onChange={f('printer_type')} options={[
                  { value: 'thermal', label: 'Térmica (Tickets)' },
                  { value: 'laser', label: 'Láser' },
                  { value: 'matrix', label: 'Matriz de Puntos' },
                ]} />
                <SelectField label="Rol" value={form.role} onChange={f('role')} options={[
                  { value: 'pos', label: 'Punto de Venta (POS)' },
                  { value: 'kitchen', label: 'Cocina' },
                  { value: 'both', label: 'Ambas funciones' },
                ]} />
              </div>

              <SelectField label="Tipo de Conexión" value={form.connection_type} onChange={f('connection_type')} options={[
                { value: 'usb', label: 'USB' },
                { value: 'network', label: 'Red / IP' },
                { value: 'bluetooth', label: 'Bluetooth' },
                { value: 'serial', label: 'Serial / COM' },
              ]} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <InputField label="Dirección / Puerto Serie" value={form.connection_string} onChange={f('connection_string')}
                  placeholder={form.connection_type === 'network' ? '192.168.1.100' : form.connection_type === 'usb' ? '/dev/usb/lp0' : 'COM1'} />
                <InputField label="Puerto TCP (solo red)" value={form.port} onChange={f('port')} type="number" placeholder="9100" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <InputField label="Ancho papel (mm)" value={form.paper_width} onChange={f('paper_width')} type="number" />
                <InputField label="Caracteres / línea" value={form.characters_per_line} onChange={f('characters_per_line')} type="number" />
              </div>

              <div style={{ borderTop: `1px solid ${COLORS.cardBorder}`, paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <CheckField label="Tiene cajón de efectivo" checked={form.has_cash_drawer} onChange={f('has_cash_drawer')} />
                {form.has_cash_drawer && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', paddingLeft: '24px' }}>
                    <SelectField label="Pin cajón" value={form.cash_drawer_pin} onChange={f('cash_drawer_pin')} options={[
                      { value: 0, label: 'Pin 2' }, { value: 1, label: 'Pin 5' }
                    ]} />
                    <InputField label="Tiempo ON (ms)" value={form.cash_drawer_on_time} onChange={f('cash_drawer_on_time')} type="number" />
                    <InputField label="Tiempo OFF (ms)" value={form.cash_drawer_off_time} onChange={f('cash_drawer_off_time')} type="number" />
                  </div>
                )}
                <CheckField label="Impresora activa" checked={form.is_active} onChange={f('is_active')} />
                <CheckField label="Impresora por defecto" checked={form.is_default} onChange={f('is_default')} />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: `1px solid ${COLORS.cardBorder}`, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {btn(() => setShowModal(false), '#475569', null, 'Cancelar')}
              {btn(handleSave, COLORS.accent, saving ? 'hourglass-split' : 'floppy-fill', saving ? 'Guardando…' : 'Guardar')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Impresoras;
