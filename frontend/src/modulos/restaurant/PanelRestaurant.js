import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TableCroquis from './TableCroquis';
import api from '../../services/api';
import printerServiceRestaurant from '../../services/printerServiceRestaurant';

const PanelRestaurant = () => {
    const navigate = useNavigate();
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrderModal, setSelectedOrderModal] = useState(null); // table object
    const [tableOrders, setTableOrders] = useState([]); // all today's orders for this table

    // Nuevos estados para pagos parciales/separados
    const [showPartialPayment, setShowPartialPayment] = useState(false);
    const [partialAmount, setPartialAmount] = useState('');
    const [showSplitItems, setShowSplitItems] = useState(false);
    const [splitItemsSelection, setSplitItemsSelection] = useState({});

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);
    // isCompact: tablet range (601–1024px) → left column, icons only
    const [isCompact, setIsCompact] = useState(window.innerWidth > 600 && window.innerWidth <= 1024);

    useEffect(() => {
        const handleResize = () => {
            const w = window.innerWidth;
            setIsMobile(w <= 600);
            setIsCompact(w > 600 && w <= 1024);
        };
        window.addEventListener('resize', handleResize);
        
        const fetchTables = async () => {
            try {
                const tablesRes = await api.get('/api/restaurant/pos/tables/');
                setTables(tablesRes.data.results || tablesRes.data || []);
            } catch (err) {
                console.error('Error cargando mesas', err);
            } finally {
                setLoading(false);
            }
        };
        fetchTables();
        
        // Polling para refrescar el estado de las mesas cada minuto
        const intervalId = setInterval(fetchTables, 60000);
        return () => {
            clearInterval(intervalId);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const handleTableSelect = async (table) => {
        if (table.status === 'occupied') {
            try {
                let items = [];

                if (table.current_order_number) {
                    // ✅ Fetch directo — el detalle siempre trae los items completos
                    const res = await api.get(`/api/restaurant/orders/orders/${table.current_order_number}/`);
                    items = res.data.items || [];
                } else {
                    // Fallback: buscar por número de mesa
                    const today = new Date().toISOString().split('T')[0];
                    const res = await api.get(
                        `/api/restaurant/orders/orders/?table_number=${encodeURIComponent(table.number)}&date_from=${today}`
                    );
                    const orders = res.data.results || res.data || [];
                    items = orders.flatMap(o => o.items || []);
                }

                // Guardamos como un "pseudo-order" para reutilizar la lógica del modal
                setTableOrders([{ items, order_number: table.current_order_number }]);
                setSelectedOrderModal(table);
            } catch (err) {
                console.error('Error al cargar orden de la mesa:', err);
                navigate(`/restaurant/pos?table=${encodeURIComponent(table.number)}&restaurantMode=1`);
            }
        } else {
            navigate(`/restaurant/pos?table=${encodeURIComponent(table.number)}&restaurantMode=1`);
        }
    };


    if (loading) {
        return (
            <div style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh',
                backgroundColor: '#111827' // Fondo oscuro como el croquis
            }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Cargando mesas...</span>
                </div>
            </div>
        );
    }

    // Estilo base de los botones
    const floatingBtnStyle = {
        backgroundColor: 'rgba(30, 41, 59, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#f8fafc',
        // Mobile: small horizontal pill | Compact(tablet): square icon-only | Desktop: icon + label
        padding: isMobile ? '0.55rem 0.75rem' : isCompact ? '0.75rem' : '0.8rem 1.2rem',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        cursor: 'pointer',
        fontSize: isMobile ? '0.875rem' : '1rem',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
        whiteSpace: 'nowrap',
        flex: isMobile ? '0 0 auto' : 'initial',
        // tooltip on hover for compact mode
        position: 'relative',
    };

    // Layout del contenedor
    const navContainerStyle = isMobile ? {
        // Mobile: fila horizontal abajo
        position: 'absolute',
        bottom: '20px',
        left: '10px',
        right: '10px',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'row',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '10px',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
    } : {
        // Tablet / Desktop: columna izquierda
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    };
    
    // === AGRUPAR ITEMS PARA EL MODAL ===
    const getGroupedItems = () => {
        if (!tableOrders || tableOrders.length === 0) return [];
        const allItems = tableOrders.flatMap(o => o.items || []);
        
        const grouped = allItems.reduce((acc, item) => {
            const name = item.product_details?.name || item.product_name || 'Producto';
            const notes = item.notes || '';
            const key = `${name}|${notes}`;
            
            if (!acc[key]) {
                acc[key] = {
                    name,
                    notes,
                    quantity: 0,
                    line_total: 0,
                    product_id: item.product_id || item.product?.id || item.id
                };
            }
            acc[key].quantity += item.quantity;
            acc[key].line_total += parseFloat(item.line_total || (parseFloat(item.unit_price || 0) * item.quantity));
            return acc;
        }, {});
        
        return Object.values(grouped);
    };

    const groupedItemsForModal = getGroupedItems();

    return (
        <div style={{
            height: 'calc(100vh - 60px)', // Ajustar según el navbar superior
            position: 'relative',
            backgroundColor: '#0a0a0a', 
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            
            {/* Ocultar scrollbar en navegadores Webkit */}
            <style>{`.nav-scroll::-webkit-scrollbar { display: none; }`}</style>

            {/* Legend (Semáforo) */}
            <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                zIndex: 10,
                backgroundColor: 'rgba(30, 41, 59, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '10px 15px',
                display: 'flex',
                flexDirection: isMobile ? 'row' : 'column',
                gap: '10px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: '600'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: 'rgba(241, 237, 218, 0.8)', border: '2px solid #d97706' }}></div>
                    <span>Disponible</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: 'rgba(254, 202, 202, 0.85)', border: '2px solid #dc2626' }}></div>
                    <span>Ocupada</span>
                </div>
            </div>
            
            {/* Tooltip CSS para modo compacto (tablet) */}
            {isCompact && (
                <style>{`
                    .nav-icon-btn { position: relative; }
                    .nav-icon-btn::after {
                        content: attr(data-tooltip);
                        position: absolute;
                        left: calc(100% + 10px);
                        top: 50%;
                        transform: translateY(-50%);
                        background: rgba(15,23,42,0.95);
                        color: #f1f5f9;
                        padding: 5px 10px;
                        border-radius: 8px;
                        font-size: 0.78rem;
                        font-weight: 600;
                        white-space: nowrap;
                        pointer-events: none;
                        opacity: 0;
                        transition: opacity 0.15s;
                        border: 1px solid rgba(255,255,255,0.15);
                        z-index: 999;
                    }
                    .nav-icon-btn:hover::after { opacity: 1; }
                `}</style>
            )}

            {/* Overlay de Botones de Navegación */}
            <div className={isMobile ? 'nav-scroll' : ''} style={navContainerStyle}>

                {/* Helper local para renderizar cada botón */}
                {[
                    { icon: 'box-seam',       label: 'Inventario',       to: '/restaurant/inventory',    mLabel: 'Inventario' },
                    { icon: 'receipt-cutoff', label: 'Órdenes Activas',  to: '/restaurant/orders',       mLabel: 'Órdenes' },
                    { icon: 'calendar-check', label: 'Reservaciones',    to: '/restaurant/reservations', mLabel: 'Reservas' },
                    { icon: 'bar-chart-fill', label: 'Reportes',         to: '/restaurant/reports',      mLabel: 'Reportes' },
                    { icon: 'printer-fill',   label: 'Impresoras',       to: '/restaurant/printers',     mLabel: 'Impresoras' },
                ].map(({ icon, label, to, mLabel }) => (
                    <button
                        key={to}
                        className={isCompact ? 'nav-icon-btn' : ''}
                        data-tooltip={label}
                        style={floatingBtnStyle}
                        title={isCompact ? label : undefined}
                        onClick={() => navigate(to)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.9)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.85)'}
                    >
                        <i className={`bi bi-${icon}`} style={{ fontSize: isCompact ? '1.25rem' : isMobile ? '1rem' : '1.1rem' }}></i>
                        {/* Desktop: label completo | Tablet(compact): nada | Mobile: label corto */}
                        {!isCompact && (isMobile ? mLabel : label)}
                    </button>
                ))}

                {/* Separador antes del botón verde */}
                {!isMobile && (
                    <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.2)', margin: '2px 0' }}></div>
                )}

                {/* Caja Libre (verde) */}
                <button
                    className={isCompact ? 'nav-icon-btn' : ''}
                    data-tooltip="Caja Libre / Llevar"
                    style={{
                        ...floatingBtnStyle,
                        backgroundColor: 'rgba(16, 185, 129, 0.9)',
                        border: '1px solid rgba(16, 185, 129, 1)'
                    }}
                    onClick={() => navigate('/restaurant/pos')}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(5, 150, 105, 1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.9)'}
                >
                    <i className="bi bi-shop" style={{ fontSize: isCompact ? '1.25rem' : isMobile ? '1rem' : '1.1rem' }}></i>
                    {!isCompact && (isMobile ? 'Caja / Llevar' : 'Caja Libre / Llevar')}
                </button>
            </div>

            {/* Modal de resumen de mesa ocupada - TODAS LAS ORDENES DEL DIA */}
            {selectedOrderModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.78)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999, padding: '1rem',
                }}>
                    <div style={{
                        backgroundColor: '#1e293b',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '500px',
                        overflow: 'hidden',
                        boxShadow: '0 25px 60px rgba(0,0,0,0.65)',
                        display: 'flex',
                        flexDirection: 'column',
                        maxHeight: '92vh',
                        border: '1px solid #334155',
                    }}>
                        {/* Header */}
                        <div style={{
                            background: 'linear-gradient(135deg,#1d4ed8,#4f46e5)',
                            padding: '1rem 1.25rem',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            color: '#fff',
                            flexShrink: 0,
                        }}>
                            <div>
                                <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                                    🪑 Mesa {selectedOrderModal.number}
                                </div>
                                <div style={{ fontSize: '0.78rem', opacity: 0.8, marginTop: '2px' }}>
                                    {tableOrders.length} orden{tableOrders.length !== 1 ? 'es' : ''} hoy
                                </div>
                            </div>
                            <button onClick={() => { setSelectedOrderModal(null); setTableOrders([]); }}
                                style={{ background: 'none', border: 'none', color: '#c7d2fe', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}>
                                &times;
                            </button>
                        </div>
                                      {/* Scrollable body */}
                        <div style={{ overflowY: 'auto', flex: 1 }}>

                            {tableOrders.length === 0 && (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                                    No hay órdenes registradas hoy para esta mesa.
                                </div>
                            )}

                            {/* Column headers */}
                            {tableOrders.length > 0 && (
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1fr auto auto',
                                    padding: '0.5rem 1.25rem',
                                    backgroundColor: '#0f172a',
                                    fontSize: '0.7rem', fontWeight: 700, color: '#64748b',
                                    textTransform: 'uppercase', letterSpacing: '0.05em',
                                }}>
                                    <span>Producto</span>
                                    <span style={{ textAlign: 'center', paddingRight: '1.2rem' }}>Cant.</span>
                                    <span style={{ textAlign: 'right' }}>Total</span>
                                </div>
                            )}

                            {/* Grouped list: identical items combined */}
                            {groupedItemsForModal.map((item, idx) => (
                                <div key={idx} style={{
                                    display: 'grid', gridTemplateColumns: '1fr auto auto',
                                    alignItems: 'center',
                                    padding: '0.65rem 1.25rem',
                                    borderBottom: '1px solid #1e293b',
                                    backgroundColor: idx % 2 === 0 ? 'transparent' : '#ffffff06',
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#f1f5f9' }}>
                                            {item.name}
                                        </div>
                                        {item.notes && (
                                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>{item.notes}</div>
                                        )}
                                    </div>
                                    <span style={{ textAlign: 'center', paddingRight: '1.2rem', fontWeight: 700, color: '#94a3b8', fontSize: '0.85rem' }}>
                                        x{item.quantity}
                                    </span>
                                    <span style={{ textAlign: 'right', fontWeight: 700, color: '#34d399', fontSize: '0.85rem' }}>
                                        ${item.line_total.toFixed(2)}
                                    </span>
                                </div>
                            ))}

                            {/* Contenedor de botones de modificación de orden */}
                            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                                {/* Añadir nueva orden limpia */}
                                <button
                                    onClick={() => navigate(`/restaurant/pos?table=${encodeURIComponent(selectedOrderModal.number)}&restaurantMode=1&newOrder=1`)}
                                    style={{
                                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        padding: '0.8rem', backgroundColor: 'rgba(99,102,241,0.1)',
                                        border: 'none', borderRadius: '10px', cursor: 'pointer', transition: 'background-color 0.15s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.1)'}
                                >
                                    <span style={{ fontSize: '1.2rem', color: '#818cf8', fontWeight: 700 }}>+</span>
                                    <span style={{ fontWeight: 600, color: '#818cf8', fontSize: '0.85rem' }}>Añadir Productos</span>
                                </button>
                                
                                {/* Editar orden existente (lleva los items cargados) */}
                                <button
                                    onClick={() => navigate(`/restaurant/pos?table=${encodeURIComponent(selectedOrderModal.number)}&restaurantMode=1`)}
                                    style={{
                                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        padding: '0.8rem', backgroundColor: 'rgba(245,158,11,0.1)',
                                        border: 'none', borderRadius: '10px', cursor: 'pointer', transition: 'background-color 0.15s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.1)'}
                                >
                                    <i className="bi bi-pencil-square" style={{ color: '#fbbf24' }}></i>
                                    <span style={{ fontWeight: 600, color: '#fbbf24', fontSize: '0.85rem' }}>Editar / Ver Orden</span>
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{
                            backgroundColor: '#0f172a', borderTop: '1px solid #334155',
                            padding: '1.25rem', flexShrink: 0,
                        }}>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                marginBottom: '1rem',
                            }}>
                                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e2e8f0' }}>Total Pendiente (Sin Pagar)</span>
                                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b' }}>
                                    ${tableOrders.reduce((sum, o) => {
                                        const itemsTotal = (o.items || []).reduce((itemSum, item) => itemSum + parseFloat(item.line_total || (parseFloat(item.unit_price || 0) * item.quantity)), 0);
                                        const paid = parseFloat(o.amount_paid || 0);
                                        return sum + (itemsTotal - paid);
                                    }, 0).toFixed(2)}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                <button
                                    onClick={() => {
                                        setPartialAmount('');
                                        setShowPartialPayment(true);
                                    }}
                                    style={{
                                        flex: 1, padding: '0.75rem',
                                        backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '10px',
                                        fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                                    }}
                                >
                                    <i className="bi bi-pie-chart-fill"></i> Pago Parcial
                                </button>
                                <button
                                    onClick={() => {
                                        const initialSel = {};
                                        groupedItemsForModal.forEach(item => {
                                            if (item.product_id) initialSel[item.product_id] = 0;
                                        });
                                        setSplitItemsSelection(initialSel);
                                        setShowSplitItems(true);
                                    }}
                                    style={{
                                        flex: 1, padding: '0.75rem',
                                        backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '10px',
                                        fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                                    }}
                                >
                                    <i className="bi bi-layout-split"></i> Separar Cta
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={async () => {
                                        try {
                                            const lastOrder = tableOrders[tableOrders.length - 1];
                                            if (!lastOrder) return;
                                            
                                            // 1. Cobrar la cuenta (default efectivo para cobro rápido)
                                            await api.post(`/api/restaurant/orders/orders/${lastOrder.order_number || lastOrder.id}/checkout/`, {
                                                payment_method: 'cash',
                                                amount_paid: tableOrders.reduce((sum, o) => {
                                                    const itemsTotal = (o.items || []).reduce((itemSum, item) => itemSum + parseFloat(item.line_total || (parseFloat(item.unit_price || 0) * item.quantity)), 0);
                                                    const paid = parseFloat(o.amount_paid || 0);
                                                    return sum + (itemsTotal - paid);
                                                }, 0)
                                            });

                                            // 2. Imprimir
                                            await printerServiceRestaurant.printReceipt(lastOrder);
                                            
                                            // 3. Refrescar listado
                                            window.location.reload();
                                        } catch (e) {
                                            alert('Error al cobrar: ' + (e.response?.data?.error || e.message || e));
                                        }
                                    }}
                                    style={{
                                        flex: 2, padding: '0.85rem',
                                        backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '10px',
                                        fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        transition: 'background-color 0.15s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                                >
                                    <i className="bi bi-wallet2"></i> Cobrar e Imprimir
                                </button>

                                <button
                                    onClick={async () => {
                                        try {
                                            // Imprimir la última orden activa
                                            const lastOrder = tableOrders[tableOrders.length - 1];
                                            if (lastOrder) await printerServiceRestaurant.printReceipt(lastOrder);
                                        } catch (e) {
                                            alert('Error al imprimir: ' + (e.message || e));
                                        }
                                    }}
                                    style={{
                                        flex: 1, padding: '0.85rem',
                                        backgroundColor: '#4b5563', color: '#fff', border: 'none', borderRadius: '10px',
                                        fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        transition: 'background-color 0.15s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
                                    title="Imprimir Pre-Cuenta sin cobrar"
                                >
                                    <i className="bi bi-printer"></i> Solo Imp.
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Sub-modal Pago Parcial */}
                    {showPartialPayment && (
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
                        }}>
                            <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '12px', width: '90%', maxWidth: '350px' }}>
                                <h4 style={{ color: '#fff', marginBottom: '1rem', fontWeight: 700 }}>Pago Parcial</h4>
                                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                    Ingresa el monto exacto a pagar en esta transacción.
                                </div>
                                <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                                    <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '1.2rem' }}>$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={partialAmount}
                                        onChange={(e) => setPartialAmount(e.target.value)}
                                        style={{
                                            width: '100%', padding: '0.85rem 1rem 0.85rem 2.5rem',
                                            backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px',
                                            color: '#fff', fontSize: '1.2rem', fontWeight: 700
                                        }}
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => setShowPartialPayment(false)} style={{ flex: 1, padding: '0.75rem', backgroundColor: 'transparent', border: '1px solid #475569', color: '#cbd5e1', borderRadius: '8px', cursor: 'pointer' }}>
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!partialAmount || isNaN(partialAmount) || parseFloat(partialAmount) <= 0) return alert('Ingresa un monto válido');
                                            try {
                                                const lastOrder = tableOrders[tableOrders.length - 1];
                                                await api.post(`/api/restaurant/orders/orders/${lastOrder.order_number || lastOrder.id}/partial_checkout/`, {
                                                    amount: parseFloat(partialAmount),
                                                    payment_method: 'cash'
                                                });
                                                
                                                // Descargar ticket pre-cuenta modificado o comprobante
                                                await printerServiceRestaurant.printReceipt(lastOrder);
                                                window.location.reload();
                                            } catch (e) {
                                                alert('Error al realizar pago parcial: ' + (e.response?.data?.error || e.message || e));
                                            }
                                        }}
                                        style={{ flex: 1, padding: '0.75rem', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        Pagar ${parseFloat(partialAmount || 0).toFixed(2)}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sub-modal Separar Cuenta */}
                    {showSplitItems && (
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem'
                        }}>
                            <div style={{
                                backgroundColor: '#1e293b', borderRadius: '12px', width: '100%', maxWidth: '400px',
                                display: 'flex', flexDirection: 'column', maxHeight: '100%'
                            }}>
                                <div style={{ padding: '1.25rem', borderBottom: '1px solid #334155' }}>
                                    <h4 style={{ color: '#fff', margin: 0, fontWeight: 700 }}>Separar Cuenta</h4>
                                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px' }}>
                                        Elige qué productos vas a cobrar.
                                    </div>
                                </div>
                                
                                <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem 0' }}>
                                    {groupedItemsForModal.map(item => {
                                        if (!item.product_id) return null;
                                        const totalQty = item.quantity;
                                        const selQty = splitItemsSelection[item.product_id] || 0;
                                        
                                        return (
                                            <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', borderBottom: '1px solid #ffffff06' }}>
                                                <div>
                                                    <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                                                    <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Disp: {totalQty}</div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#0f172a', padding: '4px', borderRadius: '8px' }}>
                                                    <button onClick={() => setSplitItemsSelection(p => ({...p, [item.product_id]: Math.max(0, selQty - 1)}))} style={{ width: '28px', height: '28px', border: 'none', borderRadius: '6px', backgroundColor: '#334155', color: '#fff', cursor: 'pointer' }}>-</button>
                                                    <span style={{ color: '#fff', fontWeight: 700, width: '20px', textAlign: 'center' }}>{selQty}</span>
                                                    <button onClick={() => setSplitItemsSelection(p => ({...p, [item.product_id]: Math.min(totalQty, selQty + 1)}))} style={{ width: '28px', height: '28px', border: 'none', borderRadius: '6px', backgroundColor: '#8b5cf6', color: '#fff', cursor: 'pointer' }}>+</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                <div style={{ padding: '1.25rem', borderTop: '1px solid #334155', display: 'flex', gap: '10px', backgroundColor: '#0f172a', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                                    <button onClick={() => setShowSplitItems(false)} style={{ flex: 1, padding: '0.75rem', backgroundColor: 'transparent', border: '1px solid #475569', color: '#cbd5e1', borderRadius: '8px', cursor: 'pointer' }}>
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const itemsToSplit = Object.entries(splitItemsSelection)
                                                .filter(([_, qty]) => qty > 0)
                                                .map(([prodId, qty]) => ({ product_id: prodId, quantity: qty }));
                                                
                                            if (itemsToSplit.length === 0) return alert('Debes seleccionar al menos un producto para cobrar');
                                            
                                            try {
                                                const lastOrder = tableOrders[tableOrders.length - 1];
                                                const res = await api.post(`/api/restaurant/orders/orders/${lastOrder.order_number || lastOrder.id}/split_checkout/`, {
                                                    items: itemsToSplit
                                                });
                                                
                                                // res.data.data contiene la nueva orden generada
                                                const newOrderTicket = res.data;
                                                await printerServiceRestaurant.printReceipt(newOrderTicket);
                                                window.location.reload();
                                            } catch (e) {
                                                alert('Error al separar cuenta: ' + (e.response?.data?.error || e.message || e));
                                            }
                                        }}
                                        style={{ flex: 1, padding: '0.75rem', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        Separar y Cobrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Croquis */}
            <div style={{ flex: 1 }}>
                <TableCroquis tables={tables} onSelectTable={handleTableSelect} isEmbedded={true} />
            </div>
        </div>
    );
};

export default PanelRestaurant;
