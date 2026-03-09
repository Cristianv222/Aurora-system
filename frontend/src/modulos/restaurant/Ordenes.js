import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import printerService from '../../services/printerServiceRestaurant';

const ORDERS_PER_PAGE = 10;

const Ordenes = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState({});
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await api.get('/api/restaurant/orders/orders/');
                setOrders(response.data.results || response.data || []);
            } catch (err) {
                console.error('Error fetching orders:', err);
                setError('Error al cargar las órdenes');
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, []);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && showModal) closeModal();
        };
        if (showModal) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [showModal]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus]);

    const handleStatusChange = async (orderNumber, newStatus, event) => {
        event.stopPropagation();
        setUpdatingStatus(prev => ({ ...prev, [orderNumber]: true }));
        try {
            const response = await api.post(
                `/api/restaurant/orders/orders/${orderNumber}/update_status/`,
                { status: newStatus }
            );
            setOrders(prevOrders =>
                prevOrders.map(order =>
                    order.order_number === orderNumber ? { ...order, ...response.data } : order
                )
            );
        } catch (err) {
            alert(`Error al actualizar el estado: ${err.response?.data?.detail || err.message}`);
        } finally {
            setUpdatingStatus(prev => ({ ...prev, [orderNumber]: false }));
        }
    };

    const handleRowClick = async (order) => {
        setShowModal(true);
        setSelectedOrder({ ...order, loading: true });
        try {
            const response = await api.get(`/api/restaurant/orders/orders/${order.order_number}/`);
            const orderData = response.data;
            setSelectedOrder({
                ...orderData,
                customer_name: orderData.customer_name || order.customer_name
            });
        } catch (err) {
            alert('Error al cargar los detalles de la orden');
            setShowModal(false);
            setSelectedOrder(null);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedOrder(null);
    };

    const handleDeleteOrder = async () => {
        if (!selectedOrder) return;
        if (!window.confirm(`¿Eliminar la Orden ${selectedOrder.order_number}? Esta acción no se puede deshacer.`)) return;
        try {
            await api.delete(`/api/restaurant/orders/orders/${selectedOrder.order_number}/`);
            setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));
            alert('Orden eliminada exitosamente');
            closeModal();
        } catch (err) {
            alert('Error al eliminar la orden');
        }
    };

    const handlePrintTicket = async () => {
        if (!selectedOrder) return;
        try {
            const receiptData = {
                order_number: selectedOrder.order_number,
                customer_name: selectedOrder.customer_name || 'CONSUMIDOR FINAL',
                table_number: selectedOrder.table_number || (selectedOrder.order_type === 'takeout' ? 'PARA LLEVAR' : 'MESA GENÉRICA'),
                items: selectedOrder.items.map(item => ({
                    name: item.product_details?.name || item.product_name || 'Producto',
                    quantity: item.quantity,
                    price: parseFloat(item.unit_price),
                    total: parseFloat(item.line_total || item.subtotal),
                    note: item.notes || ''
                })),
                subtotal: parseFloat(selectedOrder.subtotal),
                discount: parseFloat(selectedOrder.discount_amount || 0),
                tax: parseFloat(selectedOrder.tax_amount || 0),
                total: parseFloat(selectedOrder.total)
            };
            await printerService.printReceipt(receiptData);
            alert('Ticket enviado a la impresora');
        } catch (error) {
            alert('Error al imprimir el ticket. Verifique la conexión con el agente de impresión.');
        }
    };

    const getStatusDisplay = (status) => {
        const statusMap = { 'pending': 'Pendiente', 'completed': 'Completado' };
        return statusMap[status] || status;
    };

    const getStatusKey = (statusDisplay) => {
        const reverseMap = { 'Pendiente': 'pending', 'Completado': 'completed' };
        return reverseMap[statusDisplay] || statusDisplay?.toLowerCase() || 'pending';
    };

    const isOrderCompleted = (order) =>
        ['completado', 'completed'].includes(order.status_display?.toLowerCase()) ||
        ['completed'].includes(order.status?.toLowerCase());

    const sortedAndFilteredOrders = orders
        .filter(order => {
            const matchSearch =
                order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchFilter =
                filterStatus === 'all' ||
                (filterStatus === 'pending' && !isOrderCompleted(order)) ||
                (filterStatus === 'completed' && isOrderCompleted(order));
            return matchSearch && matchFilter;
        })
        .sort((a, b) => {
            const aCompleted = isOrderCompleted(a);
            const bCompleted = isOrderCompleted(b);
            if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
            if (!aCompleted) return new Date(a.created_at) - new Date(b.created_at);
            return new Date(b.created_at) - new Date(a.created_at);
        });

    const totalPages = Math.ceil(sortedAndFilteredOrders.length / ORDERS_PER_PAGE);
    const paginatedOrders = sortedAndFilteredOrders.slice(
        (currentPage - 1) * ORDERS_PER_PAGE,
        currentPage * ORDERS_PER_PAGE
    );

    const pendingCount = orders.filter(o => !isOrderCompleted(o)).length;
    const completedCount = orders.filter(o => isOrderCompleted(o)).length;
    const totalRevenue = orders
        .filter(o => isOrderCompleted(o))
        .reduce((sum, o) => sum + parseFloat(o.total || 0), 0);

    const getPageNumbers = () => {
        const pages = [];
        const delta = 2;
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== '...') {
                pages.push('...');
            }
        }
        return pages;
    };

    // ─── STYLES ──────────────────────────────────────────────────────────────
    const S = {
        page: {
            minHeight: '100vh',
            background: '#f0f4f9',
            padding: '28px 24px',
            fontFamily: "'Sora', sans-serif",
        },
        wrap: { maxWidth: '1280px', margin: '0 auto' },
        header: { marginBottom: '28px' },
        title: { fontSize: '26px', fontWeight: '700', color: '#1a2e4a', margin: '0 0 4px 0' },
        subtitle: { color: '#6b87a8', fontSize: '14px', margin: 0 },

        statsRow: { display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
        statCard: (color) => ({
            flex: '1 1 160px', background: '#fff',
            border: `1px solid #dce8f5`, borderLeft: `4px solid ${color}`,
            borderRadius: '10px', padding: '16px 20px',
        }),
        statLabel: { fontSize: '12px', color: '#6b87a8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px 0' },
        statValue: (color) => ({ fontSize: '24px', fontWeight: '700', color, margin: 0 }),

        toolbar: {
            background: '#fff', border: '1px solid #dce8f5', borderRadius: '12px',
            padding: '16px 20px', marginBottom: '20px',
            display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap',
        },
        searchWrap: { flex: 1, minWidth: '200px', position: 'relative' },
        searchIcon: {
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            color: '#6b87a8', fontSize: '16px', pointerEvents: 'none',
        },
        searchInput: {
            width: '100%', padding: '9px 12px 9px 36px',
            border: '1px solid #dce8f5', borderRadius: '8px',
            outline: 'none', fontSize: '14px', color: '#1a2e4a',
            background: '#f8fbff', boxSizing: 'border-box',
        },
        filterBtn: (active) => ({
            padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
            border: active ? '1.5px solid #3a6ea8' : '1.5px solid #dce8f5',
            background: active ? '#3a6ea8' : '#fff',
            color: active ? '#fff' : '#6b87a8',
            cursor: 'pointer', transition: 'all 0.15s',
        }),

        tableWrap: { background: '#fff', border: '1px solid #dce8f5', borderRadius: '12px', overflow: 'hidden' },
        tableScroll: { overflowX: 'auto' },
        table: { width: '100%', borderCollapse: 'collapse' },
        thead: { background: '#f0f4f9', borderBottom: '1px solid #dce8f5' },
        th: {
            padding: '13px 20px', textAlign: 'left',
            fontSize: '11px', fontWeight: '700', color: '#3a6ea8',
            textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
        },
        tr: (completed) => ({
            borderBottom: '1px solid #f0f4f9',
            opacity: completed ? 0.55 : 1,
            cursor: 'pointer', transition: 'background 0.15s',
        }),
        td: { padding: '14px 20px', whiteSpace: 'nowrap' },
        orderNum: { fontWeight: '700', color: '#2c4f7c', fontSize: '14px' },
        customerName: { color: '#1a2e4a', fontSize: '14px' },
        orderType: { color: '#6b87a8', fontSize: '13px' },
        total: { fontWeight: '700', color: '#1a7a4a', fontSize: '14px' },
        dateText: { color: '#6b87a8', fontSize: '13px' },
        badgePending: {
            display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
            fontSize: '12px', fontWeight: '600',
            background: '#fff8e6', color: '#b45309', border: '1px solid #fde68a',
        },
        badgeCompleted: {
            display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
            fontSize: '12px', fontWeight: '600',
            background: '#e6f7ee', color: '#166534', border: '1px solid #bbf7d0',
        },
        statusSelect: (completed) => ({
            padding: '5px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
            border: completed ? '1px solid #bbf7d0' : '1px solid #fde68a',
            background: completed ? '#e6f7ee' : '#fff8e6',
            color: completed ? '#166534' : '#b45309',
            cursor: 'pointer', outline: 'none',
        }),
        emptyRow: { padding: '48px 24px', textAlign: 'center', color: '#6b87a8', fontSize: '15px' },

        pagination: {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderTop: '1px solid #f0f4f9', flexWrap: 'wrap', gap: '12px',
        },
        pageInfo: { fontSize: '13px', color: '#6b87a8' },
        pageButtons: { display: 'flex', gap: '6px', alignItems: 'center' },
        pageBtn: (active, disabled) => ({
            minWidth: '36px', height: '36px', borderRadius: '8px',
            border: active ? '1.5px solid #3a6ea8' : '1px solid #dce8f5',
            background: active ? '#3a6ea8' : disabled ? '#f8fbff' : '#fff',
            color: active ? '#fff' : disabled ? '#c5d5e8' : '#3a6ea8',
            fontWeight: '600', fontSize: '13px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }),

        overlay: {
            position: 'fixed', inset: 0, background: 'rgba(26,46,74,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px',
        },
        modal: {
            background: '#fff', borderRadius: '16px',
            maxWidth: '600px', width: '100%', maxHeight: '90vh',
            overflow: 'auto', boxShadow: '0 24px 48px rgba(26,46,74,0.18)',
        },
        modalHeader: { padding: '24px 24px 16px', borderBottom: '1px solid #f0f4f9' },
        modalTitle: { fontSize: '22px', fontWeight: '700', color: '#1a2e4a', margin: '0 0 4px 0' },
        modalDate: { color: '#6b87a8', fontSize: '13px', margin: 0 },
        modalHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' },
        closeBtn: {
            background: '#f0f4f9', border: 'none', borderRadius: '8px',
            width: '34px', height: '34px', fontSize: '20px', cursor: 'pointer',
            color: '#6b87a8', display: 'flex', alignItems: 'center', justifyContent: 'center',
        },
        printBtn: {
            background: '#1a7a4a', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '8px 16px', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600', marginLeft: '8px',
        },
        customerBox: {
            background: '#f0f4f9', padding: '12px 16px', borderRadius: '10px',
            border: '1px solid #dce8f5', display: 'flex', alignItems: 'center', gap: '12px',
        },
        customerAvatar: {
            width: '40px', height: '40px', borderRadius: '50%',
            background: '#2c4f7c', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '700', fontSize: '16px', flexShrink: 0,
        },
        customerLabel: { fontSize: '11px', color: '#6b87a8', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 2px 0' },
        customerValue: { fontSize: '15px', fontWeight: '700', color: '#1a2e4a', margin: 0 },
        modalBody: { padding: '24px' },
        sectionTitle: { fontSize: '14px', fontWeight: '700', color: '#3a6ea8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' },
        infoBox: { background: '#f8fbff', padding: '14px 16px', borderRadius: '10px', border: '1px solid #dce8f5', marginBottom: '20px' },
        infoRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px', color: '#1a2e4a' },
        itemsBox: { border: '1px solid #dce8f5', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' },
        itemRow: (last) => ({
            padding: '12px 16px',
            borderBottom: last ? 'none' : '1px solid #f0f4f9',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }),
        itemName: { fontWeight: '600', color: '#1a2e4a', fontSize: '14px', margin: '0 0 2px 0' },
        itemQty: { fontSize: '13px', color: '#6b87a8', margin: 0 },
        itemNote: {
            fontSize: '12px', color: '#b45309', fontStyle: 'italic',
            background: '#fff8e6', padding: '2px 8px', borderRadius: '4px',
            display: 'inline-block', marginTop: '4px',
        },
        itemTotal: { fontWeight: '700', color: '#1a7a4a', fontSize: '14px' },
        summaryBox: { background: '#f8fbff', padding: '16px', borderRadius: '10px', border: '1px solid #dce8f5' },
        summaryRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#6b87a8' },
        summaryTotal: {
            borderTop: '1px solid #dce8f5', paddingTop: '10px', marginTop: '4px',
            display: 'flex', justifyContent: 'space-between',
        },
        summaryTotalLabel: { fontSize: '16px', fontWeight: '700', color: '#1a2e4a' },
        summaryTotalValue: { fontSize: '18px', fontWeight: '800', color: '#1a7a4a' },
        modalFooter: {
            padding: '16px 24px', borderTop: '1px solid #f0f4f9',
            display: 'flex', gap: '10px', justifyContent: 'flex-end',
        },
        deleteBtn: {
            padding: '9px 18px', background: '#fff0f0', color: '#b91c1c',
            border: '1px solid #fca5a5', borderRadius: '8px',
            fontWeight: '600', cursor: 'pointer', fontSize: '13px', marginRight: 'auto',
        },
        cancelBtn: {
            padding: '9px 18px', background: '#f0f4f9', color: '#3a6ea8',
            border: 'none', borderRadius: '8px',
            fontWeight: '600', cursor: 'pointer', fontSize: '13px',
        },
    };

    if (loading) return (
        <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    border: '4px solid #dce8f5', borderTopColor: '#3a6ea8',
                    animation: 'spin 0.8s linear infinite', margin: '0 auto',
                }} />
                <p style={{ marginTop: '16px', color: '#6b87a8', fontWeight: '600' }}>Cargando órdenes...</p>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (error) return (
        <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff0f0', borderLeft: '4px solid #ef4444', padding: '24px', borderRadius: '10px', maxWidth: '400px' }}>
                <p style={{ color: '#991b1b', fontWeight: '600', margin: 0 }}>{error}</p>
            </div>
        </div>
    );

    return (
        <div style={S.page}>
            <div style={S.wrap}>

                {/* Header */}
                <div style={S.header}>
                    <h1 style={S.title}>Órdenes · Restaurante</h1>
                    <p style={S.subtitle}>Gestiona y visualiza todas las órdenes del restaurante</p>
                </div>

                {/* Stats */}
                <div style={S.statsRow}>
                    <div style={S.statCard('#3a6ea8')}>
                        <p style={S.statLabel}>Total Órdenes</p>
                        <p style={S.statValue('#1a2e4a')}>{orders.length}</p>
                    </div>
                    <div style={S.statCard('#f59e0b')}>
                        <p style={S.statLabel}>Pendientes</p>
                        <p style={S.statValue('#b45309')}>{pendingCount}</p>
                    </div>
                    <div style={S.statCard('#10b981')}>
                        <p style={S.statLabel}>Completadas</p>
                        <p style={S.statValue('#166534')}>{completedCount}</p>
                    </div>
                    <div style={S.statCard('#2c4f7c')}>
                        <p style={S.statLabel}>Ingresos</p>
                        <p style={S.statValue('#1a2e4a')}>${totalRevenue.toFixed(2)}</p>
                    </div>
                </div>

                {/* Toolbar */}
                <div style={S.toolbar}>
                    <div style={S.searchWrap}>
                        <i className="bi bi-search" style={S.searchIcon} />
                        <input
                            type="text"
                            placeholder="Buscar por N° orden o cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={S.searchInput}
                            onFocus={(e) => e.target.style.borderColor = '#3a6ea8'}
                            onBlur={(e) => e.target.style.borderColor = '#dce8f5'}
                        />
                    </div>
                    <button style={S.filterBtn(filterStatus === 'all')} onClick={() => setFilterStatus('all')}>Todas</button>
                    <button style={S.filterBtn(filterStatus === 'pending')} onClick={() => setFilterStatus('pending')}>Pendientes</button>
                    <button style={S.filterBtn(filterStatus === 'completed')} onClick={() => setFilterStatus('completed')}>Completadas</button>
                </div>

                {/* Table */}
                <div style={S.tableWrap}>
                    <div style={S.tableScroll}>
                        <table style={S.table}>
                            <thead style={S.thead}>
                                <tr>
                                    {['N° Orden', 'Cliente', 'Tipo', 'Total', 'Estado', 'Fecha'].map(h => (
                                        <th key={h} style={S.th}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={S.emptyRow}>
                                            <i className="bi bi-inbox" style={{ fontSize: '28px', display: 'block', marginBottom: '8px', color: '#c5d5e8' }} />
                                            {searchTerm ? 'No se encontraron órdenes' : 'No hay órdenes registradas'}
                                        </td>
                                    </tr>
                                ) : paginatedOrders.map(order => {
                                    const completed = isOrderCompleted(order);
                                    return (
                                        <tr
                                            key={order.id}
                                            onClick={() => handleRowClick(order)}
                                            style={S.tr(completed)}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fbff'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={S.td}>
                                                <span style={S.orderNum}>#{order.order_number}</span>
                                            </td>
                                            <td style={S.td}>
                                                <span style={S.customerName}>{order.customer_name || 'Consumidor Final'}</span>
                                            </td>
                                            <td style={S.td}>
                                                <span style={S.orderType}>{order.order_type_display}</span>
                                            </td>
                                            <td style={S.td}>
                                                <span style={S.total}>${order.total}</span>
                                            </td>
                                            <td style={S.td} onClick={(e) => e.stopPropagation()}>
                                                <select
                                                    value={getStatusKey(order.status_display) || order.status}
                                                    onChange={(e) => handleStatusChange(order.order_number, e.target.value, e)}
                                                    disabled={updatingStatus[order.order_number]}
                                                    style={S.statusSelect(completed)}
                                                >
                                                    <option value="pending">Pendiente</option>
                                                    <option value="completed">Completado</option>
                                                </select>
                                            </td>
                                            <td style={S.td}>
                                                <span style={S.dateText}>
                                                    {new Date(order.created_at).toLocaleString('es-ES', {
                                                        day: '2-digit', month: '2-digit', year: 'numeric',
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginación */}
                    {totalPages > 1 && (
                        <div style={S.pagination}>
                            <span style={S.pageInfo}>
                                Mostrando {Math.min((currentPage - 1) * ORDERS_PER_PAGE + 1, sortedAndFilteredOrders.length)}–{Math.min(currentPage * ORDERS_PER_PAGE, sortedAndFilteredOrders.length)} de {sortedAndFilteredOrders.length} órdenes
                            </span>
                            <div style={S.pageButtons}>
                                <button
                                    style={S.pageBtn(false, currentPage === 1)}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <i className="bi bi-chevron-left" />
                                </button>
                                {getPageNumbers().map((page, idx) =>
                                    page === '...'
                                        ? <span key={idx} style={{ padding: '0 4px', color: '#6b87a8' }}>…</span>
                                        : <button
                                            key={idx}
                                            style={S.pageBtn(currentPage === page, false)}
                                            onClick={() => setCurrentPage(page)}
                                        >
                                            {page}
                                        </button>
                                )}
                                <button
                                    style={S.pageBtn(false, currentPage === totalPages)}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    <i className="bi bi-chevron-right" />
                                </button>
                            </div>
                        </div>
                    )}

                    {totalPages <= 1 && sortedAndFilteredOrders.length > 0 && (
                        <div style={{ padding: '14px 20px', borderTop: '1px solid #f0f4f9' }}>
                            <span style={S.pageInfo}>{sortedAndFilteredOrders.length} órdenes en total</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && selectedOrder && (
                <div style={S.overlay} onClick={closeModal}>
                    <div style={S.modal} onClick={(e) => e.stopPropagation()}>

                        <div style={S.modalHeader}>
                            <div style={S.modalHeaderRow}>
                                <div>
                                    <h2 style={S.modalTitle}>Orden #{selectedOrder.order_number}</h2>
                                    <p style={S.modalDate}>
                                        {selectedOrder.created_at && new Date(selectedOrder.created_at).toLocaleString('es-ES', {
                                            day: '2-digit', month: 'long', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <button style={S.printBtn} onClick={handlePrintTicket}>
                                        <i className="bi bi-printer" /> Imprimir
                                    </button>
                                    <button style={{ ...S.closeBtn, marginLeft: '8px' }} onClick={closeModal}>×</button>
                                </div>
                            </div>
                            <div style={S.customerBox}>
                                <div style={S.customerAvatar}>
                                    {(selectedOrder.customer_name || 'C')[0].toUpperCase()}
                                </div>
                                <div>
                                    <p style={S.customerLabel}>Cliente</p>
                                    <p style={S.customerValue}>{selectedOrder.customer_name || 'Consumidor Final'}</p>
                                </div>
                            </div>
                        </div>

                        <div style={S.modalBody}>
                            <p style={S.sectionTitle}>Información</p>
                            <div style={S.infoBox}>
                                <div style={S.infoRow}>
                                    <span style={{ color: '#6b87a8' }}>Tipo de orden</span>
                                    <span style={{ fontWeight: '600' }}>{selectedOrder.order_type_display}</span>
                                </div>
                                <div style={{ ...S.infoRow, marginBottom: 0 }}>
                                    <span style={{ color: '#6b87a8' }}>Estado</span>
                                    <span style={isOrderCompleted(selectedOrder) ? S.badgeCompleted : S.badgePending}>
                                        {selectedOrder.status_display || getStatusDisplay(selectedOrder.status)}
                                    </span>
                                </div>
                                {selectedOrder.table_number && (
                                    <div style={{ ...S.infoRow, marginTop: '6px', marginBottom: 0 }}>
                                        <span style={{ color: '#6b87a8' }}>Mesa</span>
                                        <span style={{ fontWeight: '600' }}>{selectedOrder.table_number}</span>
                                    </div>
                                )}
                            </div>

                            <p style={S.sectionTitle}>Productos</p>
                            <div style={S.itemsBox}>
                                {selectedOrder.loading ? (
                                    <div style={{ padding: '32px', textAlign: 'center', color: '#6b87a8' }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '50%',
                                            border: '3px solid #dce8f5', borderTopColor: '#3a6ea8',
                                            animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
                                        }} />
                                        Cargando productos...
                                    </div>
                                ) : selectedOrder.items?.length > 0 ? selectedOrder.items.map((item, idx) => (
                                    <div key={idx} style={S.itemRow(idx === selectedOrder.items.length - 1)}>
                                        <div>
                                            <p style={S.itemName}>{item.product_details?.name || item.product_name || 'Producto'}</p>
                                            <p style={S.itemQty}>{item.quantity} × ${item.unit_price}</p>
                                            {item.notes && <span style={S.itemNote}>📝 {item.notes}</span>}
                                        </div>
                                        <span style={S.itemTotal}>${item.line_total || item.subtotal}</span>
                                    </div>
                                )) : (
                                    <p style={{ padding: '20px', textAlign: 'center', color: '#6b87a8', margin: 0 }}>
                                        No hay productos en esta orden
                                    </p>
                                )}
                            </div>

                            <div style={S.summaryBox}>
                                <div style={S.summaryRow}>
                                    <span>Subtotal</span>
                                    <span style={{ color: '#1a2e4a', fontWeight: '500' }}>${selectedOrder.subtotal}</span>
                                </div>
                                {selectedOrder.tax_amount > 0 && (
                                    <div style={S.summaryRow}>
                                        <span>Impuestos</span>
                                        <span style={{ color: '#1a2e4a', fontWeight: '500' }}>${selectedOrder.tax_amount}</span>
                                    </div>
                                )}
                                {selectedOrder.discount_amount > 0 && (
                                    <div style={S.summaryRow}>
                                        <span>Descuento</span>
                                        <span style={{ color: '#b91c1c', fontWeight: '500' }}>-${selectedOrder.discount_amount}</span>
                                    </div>
                                )}
                                <div style={S.summaryTotal}>
                                    <span style={S.summaryTotalLabel}>Total</span>
                                    <span style={S.summaryTotalValue}>${selectedOrder.total}</span>
                                </div>
                            </div>

                            {selectedOrder.notes && (
                                <div style={{ marginTop: '20px', background: '#fff8e6', padding: '14px 16px', borderRadius: '10px', border: '1px solid #fde68a' }}>
                                    <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '700', color: '#b45309', textTransform: 'uppercase' }}>Notas</p>
                                    <p style={{ margin: 0, color: '#92400e', fontSize: '14px' }}>{selectedOrder.notes}</p>
                                </div>
                            )}
                        </div>

                        <div style={S.modalFooter}>
                            <button style={S.deleteBtn} onClick={handleDeleteOrder}>
                                <i className="bi bi-trash" /> Eliminar Orden
                            </button>
                            <button style={S.cancelBtn} onClick={closeModal}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
            `}</style>
        </div>
    );
};

export default Ordenes;