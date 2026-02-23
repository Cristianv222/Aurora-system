import React, { useState, useEffect, useCallback } from 'react';
import TableCroquis from './TableCroquis';

// ─── Hook responsivo ──────────────────────────────────────────────
const useWindowSize = () => {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handler = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    return width;
};

const RESTAURANT_API = process.env.REACT_APP_RESTAURANT_SERVICE || '';
const API_BASE = `${RESTAURANT_API}/api/restaurant`;

// ─── Configuración de estados ──────────────────────────────────────
const STATUS_CONFIG = {
    pending: { label: 'Pendiente', bg: '#fffbeb', color: '#78350f', border: '#fbbf24', dot: '#f59e0b' },
    confirmed: { label: 'Confirmada', bg: '#eff6ff', color: '#1e40af', border: '#93c5fd', dot: '#2563eb' },
    seated: { label: 'En mesa', bg: '#f0fdf4', color: '#14532d', border: '#86efac', dot: '#16a34a' },
    completed: { label: 'Completada', bg: '#f9fafb', color: '#374151', border: '#d1d5db', dot: '#9ca3af' },
    cancelled: { label: 'Cancelada', bg: '#fff1f2', color: '#881337', border: '#fda4af', dot: '#e11d48' },
    no_show: { label: 'No se presentó', bg: '#faf5ff', color: '#581c87', border: '#d8b4fe', dot: '#9333ea' },
};

const OCCASION_LABELS = {
    none: 'Ninguna',
    birthday: 'Cumpleanos',
    anniversary: 'Aniversario',
    business: 'Reunion de negocios',
    graduation: 'Graduacion',
    other: 'Ocasion especial',
};

// Acciones posibles por estado
const ACTIONS_BY_STATUS = {
    pending: ['confirm', 'seat', 'cancel', 'no_show'],
    confirmed: ['seat', 'cancel', 'no_show'],
    seated: ['complete'],
    completed: [],
    cancelled: [],
    no_show: [],
};

const ACTION_CONFIG = {
    confirm: { label: 'Confirmar reserva', style: 'primary' },
    seat: { label: 'Sentar en mesa', style: 'success' },
    complete: { label: 'Marcar completada', style: 'neutral' },
    cancel: { label: 'Cancelar reserva', style: 'danger' },
    no_show: { label: 'No se presento', style: 'warning' },
};

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (t) => t ? t.slice(0, 5) : '—';

// ─── Componentes pequeños ──────────────────────────────────────────

const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '3px 10px', borderRadius: '20px',
            fontSize: '12px', fontWeight: '600',
            backgroundColor: cfg.bg, color: cfg.color,
            border: `1px solid ${cfg.border}`,
            whiteSpace: 'nowrap',
        }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: cfg.dot, display: 'inline-block', flexShrink: 0 }} />
            {cfg.label}
        </span>
    );
};

const StatCard = ({ label, value, color, subtitle }) => (
    <div style={{
        background: '#fff', borderRadius: '10px', padding: '18px 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #f0f0f0',
        borderLeft: `4px solid ${color}`,
    }}>
        <div style={{ fontSize: '28px', fontWeight: '800', color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginTop: '4px' }}>{label}</div>
        {subtitle && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{subtitle}</div>}
    </div>
);

const Alert = ({ type, children }) => {
    const styles = {
        success: { bg: '#f0fdf4', border: '#86efac', color: '#14532d' },
        error: { bg: '#fff1f2', border: '#fda4af', color: '#9f1239' },
    };
    const s = styles[type];
    return (
        <div style={{
            position: 'fixed', top: 20, right: 24, zIndex: 99999,
            background: s.bg, border: `1px solid ${s.border}`, color: s.color,
            borderRadius: '8px', padding: '12px 20px', fontWeight: '600',
            fontSize: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            maxWidth: 380,
        }}>
            {children}
        </div>
    );
};

const Modal = ({ title, subtitle, onClose, children, width = 680 }) => (
    <div
        style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9000, padding: 16,
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
        <div style={{
            background: '#fff', borderRadius: '14px',
            width: '100%', maxWidth: width, maxHeight: '92vh',
            overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
        }}>
            {/* Header del modal */}
            <div style={{
                padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>{title}</h2>
                    {subtitle && <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#6b7280' }}>{subtitle}</p>}
                </div>
                <button onClick={onClose} style={{
                    background: '#f3f4f6', border: 'none', borderRadius: '8px',
                    width: 32, height: 32, fontSize: '16px', cursor: 'pointer',
                    color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                }}>x</button>
            </div>
            <div style={{ padding: '20px 24px 24px' }}>{children}</div>
        </div>
    </div>
);

const Field = ({ label, children, error, hint, half }) => (
    <div style={{ gridColumn: half ? 'auto' : '1 / -1' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {label}
        </label>
        {children}
        {hint && !error && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#9ca3af' }}>{hint}</p>}
        {error && <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#dc2626', fontWeight: '600' }}>
            {Array.isArray(error) ? error.join(', ') : error}
        </p>}
    </div>
);

const Input = (props) => (
    <input {...props} style={{
        width: '100%', padding: '9px 12px', fontSize: '14px', color: '#1f2937',
        border: '1px solid #d1d5db', borderRadius: '8px', outline: 'none',
        boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
        ...(props.readOnly ? { backgroundColor: '#f9fafb', cursor: 'default' } : {}),
        ...props.style,
    }} />
);

const Select = ({ children, ...props }) => (
    <select {...props} style={{
        width: '100%', padding: '9px 12px', fontSize: '14px', color: '#1f2937',
        border: '1px solid #d1d5db', borderRadius: '8px', outline: 'none',
        boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
        ...props.style,
    }}>{children}</select>
);

const Btn = ({ variant = 'primary', size = 'md', children, ...props }) => {
    const variants = {
        primary: { bg: '#2563eb', hover: '#1d4ed8', color: '#fff' },
        success: { bg: '#16a34a', hover: '#15803d', color: '#fff' },
        neutral: { bg: '#6b7280', hover: '#4b5563', color: '#fff' },
        danger: { bg: '#dc2626', hover: '#b91c1c', color: '#fff' },
        warning: { bg: '#d97706', hover: '#b45309', color: '#fff' },
        ghost: { bg: '#f3f4f6', hover: '#e5e7eb', color: '#374151' },
        outline: { bg: '#fff', hover: '#f9fafb', color: '#374151', border: '#d1d5db' },
    };
    const v = variants[variant] || variants.primary;
    const pad = size === 'sm' ? '6px 14px' : size === 'lg' ? '11px 28px' : '8px 18px';
    const fs = size === 'sm' ? '12px' : size === 'lg' ? '15px' : '13px';
    return (
        <button
            {...props}
            style={{
                background: v.bg, color: v.color, border: v.border ? `1px solid ${v.border}` : 'none',
                borderRadius: '8px', padding: pad, fontSize: fs, fontWeight: '600',
                cursor: props.disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                fontFamily: 'inherit', opacity: props.disabled ? 0.6 : 1,
                transition: 'background 0.15s',
                ...props.style,
            }}
            onMouseEnter={e => { if (!props.disabled) e.currentTarget.style.background = v.hover; }}
            onMouseLeave={e => { if (!props.disabled) e.currentTarget.style.background = v.bg; }}
        >
            {children}
        </button>
    );
};

// ─── Componente principal ──────────────────────────────────────────
const Reservaciones = () => {

    const [reservations, setReservations] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // Filtros
    const [filterDate, setFilterDate] = useState(today());
    const [filterStatus, setFilterStatus] = useState('');
    const [search, setSearch] = useState('');

    // Modales
    const [showCreate, setShowCreate] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [showCroquis, setShowCroquis] = useState(false);
    const [showCroquisSelector, setShowCroquisSelector] = useState(false);

    const [selected, setSelected] = useState(null);
    const [croquisData, setCroquisData] = useState([]);
    const [selectedMesa, setSelectedMesa] = useState(null);
    const [showCancel, setShowCancel] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [saving, setSaving] = useState(false);

    // Paginacion
    const PAGE_SIZE = 10;
    const [currentPage, setCurrentPage] = useState(1);

    const emptyForm = {
        guest_name: '', guest_phone: '', guest_email: '',
        party_size: 2,
        reservation_date: today(), reservation_time: '19:00',
        duration_minutes: 90,
        occasion: 'none', special_requests: '', table: '',
    };
    const [form, setForm] = useState(emptyForm);
    const [formErrors, setFormErrors] = useState({});

    // ─── Notificaciones ─────────────────────────────────────────────
    useEffect(() => {
        if (successMsg) { const t = setTimeout(() => setSuccessMsg(''), 3500); return () => clearTimeout(t); }
    }, [successMsg]);
    useEffect(() => {
        if (errorMsg) { const t = setTimeout(() => setErrorMsg(''), 4500); return () => clearTimeout(t); }
    }, [errorMsg]);

    // ─── API helpers ────────────────────────────────────────────────
    const fetchReservations = useCallback(async () => {
        setLoading(true);
        setCurrentPage(1); // Resetear pagina al buscar
        try {
            const p = new URLSearchParams();
            if (filterDate) p.append('date', filterDate);
            if (filterStatus) p.append('status', filterStatus);
            if (search) p.append('search', search);
            const res = await fetch(`${API_BASE}/reservations/?${p}`);
            const data = await res.json();
            if (data.status === 'success') setReservations(data.data);
        } catch { setErrorMsg('No se pudo conectar con el servidor'); }
        finally { setLoading(false); }
    }, [filterDate, filterStatus, search]);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/reservations/stats/`);
            const data = await res.json();
            if (data.status === 'success') setStats(data.data);
        } catch { }
    }, []);

    const fetchCroquisStatus = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/reservations/croquis/`);
            const data = await res.json();
            if (data.status === 'success') setCroquisData(data.data);
        } catch { }
    }, []);

    const fetchAvailableTables = async (dt, tm, pax, dur) => {
        try {
            const p = new URLSearchParams({ date: dt, time: tm, party_size: pax, duration: dur });
            const res = await fetch(`${API_BASE}/reservations/available-tables/?${p}`);
            const data = await res.json();
            if (data.status === 'success') return data.data;
        } catch { }
        return [];
    };

    useEffect(() => { fetchReservations(); fetchStats(); }, [fetchReservations, fetchStats]);

    const performAction = async (id, action, body = {}) => {
        const actionUrl = action === 'no_show' ? 'no-show' : action;
        try {
            const res = await fetch(`${API_BASE}/reservations/${id}/${actionUrl}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.status === 'success') {
                const labels = {
                    confirm: 'Reserva confirmada correctamente',
                    seat: 'El cliente fue sentado en su mesa',
                    complete: 'Reserva marcada como completada',
                    cancel: 'Reserva cancelada',
                    no_show: 'Marcado como no presentado',
                };
                setSuccessMsg(labels[action] || 'Accion realizada');
                fetchReservations(); fetchStats();
                if (showDetail) setShowDetail(false);
            } else {
                setErrorMsg(data.message || 'Ocurrio un error');
            }
        } catch { setErrorMsg('Error de conexion con el servidor'); }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSaving(true); setFormErrors({});
        try {
            const payload = {
                ...form,
                party_size: Number(form.party_size),
                duration_minutes: Number(form.duration_minutes),
                table: form.table || null,
            };
            const res = await fetch(`${API_BASE}/reservations/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.status === 'success') {
                setSuccessMsg(`Reserva ${data.data.reservation_number} registrada correctamente`);
                setShowCreate(false); setForm(emptyForm); setSelectedMesa(null);
                fetchReservations(); fetchStats();
            } else {
                setFormErrors(data.errors || {});
                setErrorMsg(data.message || 'Revise los datos del formulario');
            }
        } catch { setErrorMsg('Error de conexion'); }
        finally { setSaving(false); }
    };

    const openCroquisSelector = async () => {
        const tables = await fetchAvailableTables(form.reservation_date, form.reservation_time, form.party_size, form.duration_minutes);
        setCroquisData(tables); setSelectedMesa(null); setShowCroquisSelector(true);
    };

    const handleSelectMesa = (table) => {
        setForm(p => ({ ...p, table: table.id }));
        setSelectedMesa(table);
        setShowCroquisSelector(false);
    };

    const openCroquis = async () => {
        await fetchCroquisStatus();
        setShowCroquis(true);
    };

    // ─── Render ──────────────────────────────────────────────────────
    const s = stats?.today || {};
    const windowWidth = useWindowSize();
    const isMobile = windowWidth < 640;
    const isTablet = windowWidth < 1024;

    return (
        <div style={{ padding: isMobile ? '16px 14px' : '28px 32px', fontFamily: "'Inter','Segoe UI',sans-serif", minHeight: '100vh', backgroundColor: '#f8fafc', color: '#1f2937' }}>

            {/* Notificaciones flotantes */}
            {successMsg && <Alert type="success">{successMsg}</Alert>}
            {errorMsg && <Alert type="error">{errorMsg}</Alert>}

            {/* ── Encabezado ─────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isMobile ? 20 : 28, gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 26, fontWeight: 800, color: '#111827' }}>Reservaciones</h1>
                    <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>
                        Registro y seguimiento de reservas del restaurante
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                    <Btn variant="ghost" onClick={openCroquis} style={isMobile ? { flex: 1 } : {}}>Ver mapa de mesas</Btn>
                    <Btn variant="primary" size="lg" style={isMobile ? { flex: 1 } : {}} onClick={() => { setForm(emptyForm); setFormErrors({}); setSelectedMesa(null); setShowCreate(true); }}>
                        + Nueva reserva
                    </Btn>
                </div>
            </div>

            {/* ── Estadisticas del dia ───────────────────────────────── */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '110px' : '140px'}, 1fr))`, gap: isMobile ? 8 : 12, marginBottom: isMobile ? 20 : 28 }}>
                    <StatCard label="Total hoy" value={s.total || 0} color="#6366f1" subtitle="reservas del dia" />
                    <StatCard label="Pendientes" value={s.pending || 0} color="#f59e0b" subtitle="sin confirmar" />
                    <StatCard label="Confirmadas" value={s.confirmed || 0} color="#2563eb" subtitle="listas para llegar" />
                    <StatCard label="En mesa" value={s.seated || 0} color="#16a34a" subtitle="clientes sentados" />
                    <StatCard label="Completadas" value={s.completed || 0} color="#6b7280" subtitle="servicio finalizado" />
                    <StatCard label="Canceladas" value={s.cancelled || 0} color="#dc2626" />
                    <StatCard label="No se presentaron" value={s.no_show || 0} color="#9333ea" />
                </div>
            )}

            {/* ── Filtros ────────────────────────────────────────────── */}
            <div style={{ background: '#fff', borderRadius: 12, padding: isMobile ? '14px' : '16px 20px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', gap: isMobile ? 10 : 12, flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap', alignItems: isMobile ? 'stretch' : 'flex-end' }}>
                    <div style={isMobile ? { width: '100%' } : {}}>
                        <label style={labelS}>Fecha</label>
                        <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ width: isMobile ? '100%' : 160 }} />
                    </div>
                    <div style={isMobile ? { width: '100%' } : {}}>
                        <label style={labelS}>Estado</label>
                        <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: isMobile ? '100%' : 180 }}>
                            <option value="">Todos los estados</option>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </Select>
                    </div>
                    <div style={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}>
                        <label style={labelS}>Buscar</label>
                        <Input
                            type="text"
                            placeholder="Nombre del cliente, telefono o numero de reserva..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && fetchReservations()}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Btn variant="primary" onClick={fetchReservations} style={isMobile ? { flex: 1 } : {}}>Buscar</Btn>
                        <Btn variant="ghost" onClick={() => { setFilterDate(today()); setFilterStatus(''); setSearch(''); }} style={isMobile ? { flex: 1 } : {}}>
                            Limpiar
                        </Btn>
                    </div>
                </div>
            </div>

            {/* ── Tabla de reservas ──────────────────────────────────── */}
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                        Cargando reservaciones...
                    </div>
                ) : reservations.length === 0 ? (
                    <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                        <div style={{ fontSize: 48, marginBottom: 12, color: '#d1d5db' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                            </svg>
                        </div>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#374151' }}>
                            No hay reservaciones para esta fecha
                        </p>
                        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#9ca3af' }}>
                            Use el boton "Nueva reserva" para registrar una.
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', minWidth: 780, borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                    {['N. Reserva', 'Cliente', 'Telefono', 'Mesa', 'Personas', 'Hora', 'Ocasion', 'Estado', 'Acciones'].map(h => (
                                        <th key={h} style={thS}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const totalPages = Math.ceil(reservations.length / PAGE_SIZE);
                                    const start = (currentPage - 1) * PAGE_SIZE;
                                    const pageItems = reservations.slice(start, start + PAGE_SIZE);
                                    return pageItems.map((r, i) => (
                                        <tr
                                            key={r.id}
                                            style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa', cursor: 'pointer', transition: 'background 0.1s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
                                            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa'}
                                            onClick={() => { setSelected(r); setShowDetail(true); setShowCancel(false); setCancelReason(''); }}
                                        >
                                            <td style={tdS}>
                                                <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#4f46e5', background: '#ede9fe', padding: '2px 8px', borderRadius: 6 }}>
                                                    {r.reservation_number}
                                                </span>
                                            </td>
                                            <td style={tdS}>
                                                <div style={{ fontWeight: 600, color: '#111827' }}>{r.guest_name}</div>
                                            </td>
                                            <td style={{ ...tdS, color: '#6b7280' }}>{r.guest_phone || '—'}</td>
                                            <td style={tdS}>
                                                {r.table_number
                                                    ? <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>Mesa {r.table_number}</span>
                                                    : <span style={{ color: '#9ca3af', fontSize: 12, whiteSpace: 'nowrap' }}>Sin asignar</span>
                                                }
                                            </td>
                                            <td style={{ ...tdS, textAlign: 'center', fontWeight: 600 }}>{r.party_size}</td>
                                            <td style={tdS}>
                                                <span style={{ fontWeight: 600 }}>{fmt(r.reservation_time)}</span>
                                                <span style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>{r.duration_minutes} min</span>
                                            </td>
                                            <td style={{ ...tdS, color: '#6b7280', fontSize: 12 }}>
                                                {r.occasion !== 'none' ? OCCASION_LABELS[r.occasion] || '—' : '—'}
                                            </td>
                                            <td style={tdS} onClick={e => e.stopPropagation()}>
                                                <StatusBadge status={r.status} />
                                            </td>
                                            <td style={tdS} onClick={e => e.stopPropagation()}>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    {r.status === 'pending' && (
                                                        <Btn variant="primary" size="sm" onClick={() => performAction(r.id, 'confirm')}>Confirmar</Btn>
                                                    )}
                                                    {(r.status === 'pending' || r.status === 'confirmed') && (
                                                        <Btn variant="success" size="sm" onClick={() => performAction(r.id, 'seat')}>Sentar</Btn>
                                                    )}
                                                    {r.status === 'seated' && (
                                                        <Btn variant="neutral" size="sm" onClick={() => performAction(r.id, 'complete')}>Completar</Btn>
                                                    )}
                                                    <Btn variant="ghost" size="sm" onClick={() => { setSelected(r); setShowDetail(true); }}>Ver detalle</Btn>
                                                </div>
                                            </td>
                                        </tr>
                                    ));
                                })()}
                            </tbody>
                        </table>
                        {/* ── Paginacion ─────────────────────────────────── */}
                        {(() => {
                            const totalPages = Math.ceil(reservations.length / PAGE_SIZE);
                            const start = (currentPage - 1) * PAGE_SIZE + 1;
                            const end = Math.min(currentPage * PAGE_SIZE, reservations.length);
                            return (
                                <div style={{
                                    display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
                                    flexDirection: isMobile ? 'column' : 'row',
                                    justifyContent: 'space-between',
                                    padding: '12px 20px', borderTop: '1px solid #f0f0f0',
                                    backgroundColor: '#fafafa', gap: isMobile ? 8 : 0
                                }}>
                                    <span style={{ fontSize: 13, color: '#6b7280' }}>
                                        {reservations.length === 0
                                            ? '0 reservas'
                                            : `Mostrando ${start}–${end} de ${reservations.length} reserva${reservations.length !== 1 ? 's' : ''}`
                                        }
                                    </span>
                                    {totalPages > 1 && (
                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                            <button
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                                style={{
                                                    padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb',
                                                    background: currentPage === 1 ? '#f3f4f6' : '#fff',
                                                    color: currentPage === 1 ? '#d1d5db' : '#374151',
                                                    fontWeight: 600, fontSize: 13,
                                                    cursor: currentPage === 1 ? 'default' : 'pointer'
                                                }}
                                            >
                                                Anterior
                                            </button>
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => setCurrentPage(p)}
                                                    style={{
                                                        padding: '5px 10px', borderRadius: 6,
                                                        border: '1px solid ' + (p === currentPage ? '#4f46e5' : '#e5e7eb'),
                                                        background: p === currentPage ? '#4f46e5' : '#fff',
                                                        color: p === currentPage ? '#fff' : '#374151',
                                                        fontWeight: 600, fontSize: 13, cursor: 'pointer',
                                                        minWidth: 32
                                                    }}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                                style={{
                                                    padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb',
                                                    background: currentPage === totalPages ? '#f3f4f6' : '#fff',
                                                    color: currentPage === totalPages ? '#d1d5db' : '#374151',
                                                    fontWeight: 600, fontSize: 13,
                                                    cursor: currentPage === totalPages ? 'default' : 'pointer'
                                                }}
                                            >
                                                Siguiente
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* ══ MODAL: NUEVA RESERVA ══════════════════════════════════ */}
            {showCreate && (
                <Modal
                    title="Registrar nueva reserva"
                    subtitle="Complete los datos del cliente y la reserva"
                    onClose={() => setShowCreate(false)}
                    width={720}
                >
                    <form onSubmit={handleCreate}>
                        {/* Datos del cliente */}
                        <SectionHeader>Datos del cliente</SectionHeader>
                        <div style={grid2}>
                            <Field label="Nombre completo del cliente *" error={formErrors.guest_name} half>
                                <Input required value={form.guest_name} placeholder="Ej: Maria Lopez"
                                    onChange={e => setForm(p => ({ ...p, guest_name: e.target.value }))} />
                            </Field>
                            <Field label="Telefono de contacto *" error={formErrors.guest_phone} half>
                                <Input required value={form.guest_phone} placeholder="Ej: 0991234567"
                                    onChange={e => setForm(p => ({ ...p, guest_phone: e.target.value }))} />
                            </Field>
                            <Field label="Correo electronico" error={formErrors.guest_email} half>
                                <Input type="email" value={form.guest_email} placeholder="Opcional"
                                    onChange={e => setForm(p => ({ ...p, guest_email: e.target.value }))} />
                            </Field>
                            <Field label="Numero de personas *" error={formErrors.party_size} hint="Cuantas personas asistiran" half>
                                <Input required type="number" min="1" max="50" value={form.party_size}
                                    onChange={e => setForm(p => ({ ...p, party_size: e.target.value }))} />
                            </Field>
                        </div>

                        {/* Fecha y hora */}
                        <SectionHeader>Fecha y horario</SectionHeader>
                        <div style={grid2}>
                            <Field label="Fecha de la reserva *" error={formErrors.reservation_date} half>
                                <Input required type="date" value={form.reservation_date}
                                    onChange={e => setForm(p => ({ ...p, reservation_date: e.target.value }))} />
                            </Field>
                            <Field label="Hora de llegada *" error={formErrors.reservation_time} half>
                                <Input required type="time" value={form.reservation_time}
                                    onChange={e => setForm(p => ({ ...p, reservation_time: e.target.value }))} />
                            </Field>
                            <Field label="Duracion estimada" hint="Cuanto tiempo ocuparan la mesa (en minutos)" half>
                                <Select value={form.duration_minutes}
                                    onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))}>
                                    <option value={60}>1 hora</option>
                                    <option value={90}>1 hora 30 minutos</option>
                                    <option value={120}>2 horas</option>
                                    <option value={150}>2 horas 30 minutos</option>
                                    <option value={180}>3 horas</option>
                                </Select>
                            </Field>
                            <Field label="Tipo de ocasion" half>
                                <Select value={form.occasion}
                                    onChange={e => setForm(p => ({ ...p, occasion: e.target.value }))}>
                                    {Object.entries(OCCASION_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </Select>
                            </Field>
                        </div>

                        {/* Mesa */}
                        <SectionHeader>Asignacion de mesa</SectionHeader>
                        <Field label="Mesa asignada" hint="Puede dejar sin asignar y asignar luego" error={formErrors.table}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <Input
                                    readOnly
                                    value={selectedMesa ? `Mesa ${selectedMesa.number} — capacidad ${selectedMesa.capacity} personas` : ''}
                                    placeholder="Sin mesa asignada (se asignara al llegar el cliente)"
                                    style={{ flex: 1 }}
                                />
                                <Btn type="button" variant="outline" onClick={openCroquisSelector}>
                                    Ver mapa de mesas
                                </Btn>
                                {selectedMesa && (
                                    <Btn type="button" variant="ghost" onClick={() => { setForm(p => ({ ...p, table: '' })); setSelectedMesa(null); }}>
                                        Quitar
                                    </Btn>
                                )}
                            </div>
                        </Field>

                        {/* Notas */}
                        <div style={{ marginTop: 4 }}>
                            <Field label="Solicitudes especiales" hint="Alergias, preferencias de asiento, decoracion, etc.">
                                <textarea
                                    value={form.special_requests}
                                    onChange={e => setForm(p => ({ ...p, special_requests: e.target.value }))}
                                    placeholder="Ej: cliente alergico a los mariscos, necesita silla de bebe..."
                                    rows={3}
                                    style={{ ...inputBaseS, resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
                                />
                            </Field>
                        </div>

                        {formErrors.non_field_errors && (
                            <div style={{ background: '#fff1f2', border: '1px solid #fda4af', borderRadius: 8, padding: '10px 14px', marginTop: 8, fontSize: 13, color: '#9f1239', fontWeight: 600 }}>
                                {formErrors.non_field_errors}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                            <Btn type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Btn>
                            <Btn type="submit" variant="primary" size="lg" disabled={saving}>
                                {saving ? 'Guardando reserva...' : 'Guardar reserva'}
                            </Btn>
                        </div>
                    </form>
                </Modal>
            )}

            {/* ══ MODAL: DETALLE DE RESERVA ═════════════════════════════ */}
            {showDetail && selected && (
                <Modal
                    title={`Reserva ${selected.reservation_number}`}
                    subtitle={`${selected.reservation_date} a las ${fmt(selected.reservation_time)} — ${selected.guest_name}`}
                    onClose={() => { setShowDetail(false); setShowCancel(false); }}
                    width={640}
                >
                    {/* Info principal */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', marginBottom: 20 }}>
                        <InfoRow label="Cliente" value={selected.guest_name} />
                        <InfoRow label="Telefono" value={selected.guest_phone || '—'} />
                        <InfoRow label="Correo" value={selected.guest_email || '—'} />
                        <InfoRow label="Personas" value={`${selected.party_size} persona${selected.party_size !== 1 ? 's' : ''}`} />
                        <InfoRow label="Fecha" value={selected.reservation_date} />
                        <InfoRow label="Hora" value={`${fmt(selected.reservation_time)} (${selected.duration_minutes} min)`} />
                        <InfoRow label="Mesa" value={selected.table_number ? `Mesa ${selected.table_number}` : 'Sin asignar'} />
                        <InfoRow label="Ocasion" value={selected.occasion !== 'none' ? OCCASION_LABELS[selected.occasion] : 'Ninguna'} />
                        <div style={{ gridColumn: '1 / -1' }}>
                            <InfoRow label="Estado" value={<StatusBadge status={selected.status} />} />
                        </div>
                    </div>

                    {selected.special_requests && (
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                                Solicitudes especiales
                            </div>
                            <div style={{ fontSize: 14, color: '#78350f' }}>{selected.special_requests}</div>
                        </div>
                    )}

                    {selected.cancellation_reason && (
                        <div style={{ background: '#fff1f2', border: '1px solid #fda4af', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#9f1239', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                                Motivo de cancelacion
                            </div>
                            <div style={{ fontSize: 14, color: '#881337' }}>{selected.cancellation_reason}</div>
                        </div>
                    )}

                    {/* Acciones */}
                    {ACTIONS_BY_STATUS[selected.status]?.length > 0 && (
                        <>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                                Acciones disponibles
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                                {ACTIONS_BY_STATUS[selected.status].map(action => {
                                    const cfg = ACTION_CONFIG[action];
                                    if (action === 'cancel') {
                                        return <Btn key={action} variant="danger" onClick={() => setShowCancel(true)}>{cfg.label}</Btn>;
                                    }
                                    return <Btn key={action} variant={cfg.style} onClick={() => performAction(selected.id, action)}>{cfg.label}</Btn>;
                                })}
                            </div>
                        </>
                    )}

                    {/* Formulario de cancelacion */}
                    {showCancel && (
                        <div style={{ background: '#fff1f2', border: '1px solid #fda4af', borderRadius: 10, padding: '16px', marginBottom: 16 }}>
                            <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#9f1239' }}>
                                Indique el motivo por el cual se cancela la reserva:
                            </p>
                            <textarea
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                rows={2}
                                placeholder="Ej: El cliente llamo para cancelar..."
                                style={{ ...inputBaseS, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                            />
                            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                <Btn variant="danger" onClick={() => performAction(selected.id, 'cancel', { reason: cancelReason })}>
                                    Confirmar cancelacion
                                </Btn>
                                <Btn variant="ghost" onClick={() => setShowCancel(false)}>Volver</Btn>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                        <Btn variant="ghost" onClick={() => { setShowDetail(false); setShowCancel(false); }}>Cerrar</Btn>
                    </div>
                </Modal>
            )}

            {/* ══ CROQUIS GENERAL ══════════════════════════════════════ */}
            {showCroquis && (
                <TableCroquis
                    tables={croquisData}
                    selectedTable={null}
                    onSelectTable={(table) => {
                        const res = table.reservation;
                        if (res) {
                            setSelected({ ...res, table_number: table.number });
                            setShowDetail(true);
                            setShowCroquis(false);
                        }
                    }}
                    onClose={() => setShowCroquis(false)}
                />
            )}

            {/* ══ CROQUIS SELECTOR DE MESA ═════════════════════════════ */}
            {showCroquisSelector && (
                <TableCroquis
                    tables={croquisData}
                    selectedTable={selectedMesa}
                    onSelectTable={handleSelectMesa}
                    onClose={() => setShowCroquisSelector(false)}
                />
            )}

            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
    );
};

// ─── Micro-componentes ─────────────────────────────────────────────
const SectionHeader = ({ children }) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 20, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #f0f0f0' }}>
        {children}
    </div>
);

const InfoRow = ({ label, value }) => (
    <div style={{ paddingBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontSize: 14, color: '#111827', fontWeight: 500, marginTop: 2 }}>{value}</div>
    </div>
);

// ─── Estilos base ──────────────────────────────────────────────────
const labelS = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' };
const thS = { padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' };
const tdS = { padding: '12px 16px', fontSize: '13px', color: '#374151', verticalAlign: 'middle' };
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' };
const inputBaseS = { padding: '9px 12px', fontSize: '14px', color: '#1f2937', border: '1px solid #d1d5db', borderRadius: '8px', outline: 'none', fontFamily: 'inherit', background: '#fff' };

export default Reservaciones;
