import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import printerService from '../../services/printerServiceRestaurant';

const ORDERS_PER_PAGE = 10;

interface OrderItem {
    product_name?: string;
    product_details?: {
        name: string;
        [key: string]: any;
    };
    quantity: number;
    unit_price: string | number;
    line_total?: string | number;
    subtotal?: string | number;
    notes?: string;
}

interface Order {
    id: string;
    order_number: string;
    customer_name?: string;
    order_type: string;
    order_type_display: string;
    total: string | number;
    subtotal: string | number;
    tax_amount?: string | number;
    discount_amount?: string | number;
    status: string;
    status_display: string;
    created_at: string;
    table_number?: string;
    items?: OrderItem[];
    loading?: boolean;
    notes?: string;
}

const Ordenes: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showModal, setShowModal] = useState<boolean>(false);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await api.get('/api/restaurant/orders/orders/');
                setOrders(response.data.results || response.data || []);
            } catch (err: any) {
                console.error('Error fetching orders:', err);
                setError('Error al cargar las órdenes');
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, []);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
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

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus]);

    const handleStatusChange = async (orderNumber: string, newStatus: string, event: React.ChangeEvent<HTMLSelectElement>) => {
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
        } catch (err: any) {
            alert(`Error al actualizar el estado: ${err.response?.data?.detail || err.message}`);
        } finally {
            setUpdatingStatus(prev => ({ ...prev, [orderNumber]: false }));
        }
    };

    const handleRowClick = async (order: Order) => {
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
                items: (selectedOrder.items || []).map(item => ({
                    name: item.product_details?.name || item.product_name || 'Producto',
                    quantity: item.quantity,
                    price: parseFloat(String(item.unit_price)),
                    total: parseFloat(String(item.line_total || item.subtotal)),
                    note: item.notes || ''
                })),
                subtotal: parseFloat(String(selectedOrder.subtotal)),
                discount: parseFloat(String(selectedOrder.discount_amount || 0)),
                tax: parseFloat(String(selectedOrder.tax_amount || 0)),
                total: parseFloat(String(selectedOrder.total))
            };
            await printerService.printReceipt(receiptData);
            alert('Ticket enviado a la impresora');
        } catch (error) {
            alert('Error al imprimir el ticket. Verifique la conexión con el agente de impresión.');
        }
    };

    const getStatusDisplay = (status: string) => {
        const statusMap: Record<string, string> = { 'pending': 'Pendiente', 'completed': 'Completado' };
        return statusMap[status] || status;
    };

    const getStatusKey = (statusDisplay: string) => {
        const reverseMap: Record<string, string> = { 'Pendiente': 'pending', 'Completado': 'completed' };
        return reverseMap[statusDisplay] || statusDisplay?.toLowerCase() || 'pending';
    };

    const isOrderCompleted = (order: Order) =>
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
            if (!aCompleted) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
        .reduce((sum, o) => sum + parseFloat(String(o.total || 0)), 0);

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
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

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f0f4f9] py-7 px-6 font-sans flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-slate-700 animate-spin mx-auto" />
                    <p className="mt-4 text-slate-400 font-semibold">Cargando órdenes...</p>
                </div>
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
                `}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#f0f4f9] py-7 px-6 font-sans flex items-center justify-center">
                <div className="bg-rose-50 border-l-4 border-rose-550 p-6 rounded-xl max-w-md shadow-sm">
                    <p className="color-rose-700 font-semibold m-0">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f0f4f9] py-7 px-6 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-7">
                    <h1 className="text-2xl font-bold text-slate-800 m-0 mb-1">Órdenes · Restaurante</h1>
                    <p className="text-slate-400 text-sm m-0">Gestiona y visualiza todas las órdenes del restaurante</p>
                </div>

                {/* Stats */}
                <div className="flex gap-4 mb-6 flex-wrap">
                    <div className="flex-1 min-w-[160px] bg-white border border-slate-200 border-l-4 border-l-[#3a6ea8] rounded-xl p-4 shadow-sm">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 m-0">Total Órdenes</p>
                        <p className="text-2xl font-bold text-slate-800 m-0">{orders.length}</p>
                    </div>
                    <div className="flex-1 min-w-[160px] bg-white border border-slate-200 border-l-4 border-l-[#f59e0b] rounded-xl p-4 shadow-sm">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 m-0">Pendientes</p>
                        <p className="text-2xl font-bold text-amber-700 m-0">{pendingCount}</p>
                    </div>
                    <div className="flex-1 min-w-[160px] bg-white border border-slate-200 border-l-4 border-l-[#10b981] rounded-xl p-4 shadow-sm">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 m-0">Completadas</p>
                        <p className="text-2xl font-bold text-emerald-700 m-0">{completedCount}</p>
                    </div>
                    <div className="flex-1 min-w-[160px] bg-white border border-slate-200 border-l-4 border-l-[#2c4f7c] rounded-xl p-4 shadow-sm">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 m-0">Ingresos</p>
                        <p className="text-2xl font-bold text-slate-800 m-0">${totalRevenue.toFixed(2)}</p>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-5 flex gap-3 items-center flex-wrap shadow-sm">
                    <div className="flex-1 min-w-[200px] relative">
                        <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar por N° orden o cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg outline-none text-sm text-slate-800 bg-slate-50/50 transition-all focus:border-slate-400"
                        />
                    </div>
                    <button
                        className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            filterStatus === 'all'
                                ? 'border-slate-500 bg-slate-500 text-white'
                                : 'border-slate-200 bg-white text-slate-400 hover:text-slate-650'
                        }`}
                        onClick={() => setFilterStatus('all')}
                    >
                        Todas
                    </button>
                    <button
                        className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            filterStatus === 'pending'
                                ? 'border-slate-500 bg-slate-500 text-white'
                                : 'border-slate-200 bg-white text-slate-400 hover:text-slate-650'
                        }`}
                        onClick={() => setFilterStatus('pending')}
                    >
                        Pendientes
                    </button>
                    <button
                        className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            filterStatus === 'completed'
                                ? 'border-slate-500 bg-slate-500 text-white'
                                : 'border-slate-200 bg-white text-slate-400 hover:text-slate-650'
                        }`}
                        onClick={() => setFilterStatus('completed')}
                    >
                        Completadas
                    </button>
                </div>

                {/* Table */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    {['N° Orden', 'Cliente', 'Tipo', 'Total', 'Estado', 'Fecha'].map(h => (
                                        <th key={h} className="px-5 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                                            <i className="bi bi-inbox text-3xl block mb-2 text-slate-300" />
                                            {searchTerm ? 'No se encontraron órdenes' : 'No hay órdenes registradas'}
                                        </td>
                                    </tr>
                                ) : paginatedOrders.map(order => {
                                    const completed = isOrderCompleted(order);
                                    return (
                                        <tr
                                            key={order.id}
                                            onClick={() => handleRowClick(order)}
                                            className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer ${
                                                completed ? 'opacity-60' : 'opacity-100'
                                            }`}
                                        >
                                            <td className="px-5 py-3.5 whitespace-nowrap text-sm">
                                                <span className="font-bold text-slate-700 text-sm">#{order.order_number}</span>
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap text-sm">
                                                <span className="text-slate-800 text-sm">{order.customer_name || 'Consumidor Final'}</span>
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap text-sm">
                                                <span className="text-slate-400 text-xs">{order.order_type_display}</span>
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap text-sm">
                                                <span className="font-bold text-emerald-600 text-sm">${order.total}</span>
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                                                <select
                                                    value={getStatusKey(order.status_display) || order.status}
                                                    onChange={(e) => handleStatusChange(order.order_number, e.target.value, e)}
                                                    disabled={updatingStatus[order.order_number]}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer outline-none border ${
                                                        completed
                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                            : 'border-amber-200 bg-amber-50 text-amber-700'
                                                    }`}
                                                >
                                                    <option value="pending">Pendiente</option>
                                                    <option value="completed">Completado</option>
                                                </select>
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap text-sm">
                                                <span className="text-slate-400 text-xs">
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
                        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 flex-wrap gap-3">
                            <span className="text-xs text-slate-400">
                                Mostrando {Math.min((currentPage - 1) * ORDERS_PER_PAGE + 1, sortedAndFilteredOrders.length)}–{Math.min(currentPage * ORDERS_PER_PAGE, sortedAndFilteredOrders.length)} de {sortedAndFilteredOrders.length} órdenes
                            </span>
                            <div className="flex gap-1.5 items-center">
                                <button
                                    className={`min-w-[34px] h-8 rounded-lg border flex items-center justify-center font-semibold text-xs transition-all cursor-pointer bg-white text-slate-650 hover:bg-slate-50 border-slate-200 ${
                                        currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <i className="bi bi-chevron-left" />
                                </button>
                                {getPageNumbers().map((page, idx) =>
                                    page === '...' ? (
                                        <span key={idx} className="px-1 text-slate-400">…</span>
                                    ) : (
                                        <button
                                            key={idx}
                                            className={`min-w-[34px] h-8 rounded-lg border flex items-center justify-center font-semibold text-xs transition-all cursor-pointer ${
                                                currentPage === page
                                                    ? 'border-slate-500 bg-slate-500 text-white'
                                                    : 'border-slate-200 bg-white text-slate-650 hover:bg-slate-50'
                                            }`}
                                            onClick={() => setCurrentPage(Number(page))}
                                        >
                                            {page}
                                        </button>
                                    )
                                )}
                                <button
                                    className={`min-w-[34px] h-8 rounded-lg border flex items-center justify-center font-semibold text-xs transition-all cursor-pointer bg-white text-slate-650 hover:bg-slate-50 border-slate-200 ${
                                        currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    <i className="bi bi-chevron-right" />
                                </button>
                            </div>
                        </div>
                    )}

                    {totalPages <= 1 && sortedAndFilteredOrders.length > 0 && (
                        <div className="px-5 py-3.5 border-t border-slate-100 text-xs text-slate-400">
                            <span>{sortedAndFilteredOrders.length} órdenes en total</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && selectedOrder && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-5" onClick={closeModal}>
                    <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 pb-4 border-b border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 m-0 mb-1">Orden #{selectedOrder.order_number}</h2>
                                    <p className="text-slate-400 text-xs m-0">
                                        {selectedOrder.created_at && new Date(selectedOrder.created_at).toLocaleString('es-ES', {
                                            day: '2-digit', month: 'long', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handlePrintTicket}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-lg px-4 py-2 cursor-pointer text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                                    >
                                        <i className="bi bi-printer" /> Imprimir
                                    </button>
                                    <button
                                        onClick={closeModal}
                                        className="bg-slate-100 border-none rounded-lg w-8 h-8 text-xl cursor-pointer text-slate-400 hover:text-slate-600 flex items-center justify-center"
                                    >
                                        &times;
                                    </button>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-base shrink-0">
                                    {(selectedOrder.customer_name || 'C')[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider m-0 mb-0.5">Cliente</p>
                                    <p className="text-sm font-bold text-slate-800 m-0">{selectedOrder.customer_name || 'Consumidor Final'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Información</p>
                            <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-200 mb-5">
                                <div className="flex justify-between mb-1.5 text-sm text-slate-800">
                                    <span className="text-slate-400">Tipo de orden</span>
                                    <span className="font-semibold">{selectedOrder.order_type_display}</span>
                                </div>
                                <div className="flex justify-between mb-1.5 text-sm text-slate-800 items-center">
                                    <span className="text-slate-400">Estado</span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                        isOrderCompleted(selectedOrder)
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                            : 'bg-amber-50 border-amber-200 text-amber-700'
                                    }`}>
                                        {selectedOrder.status_display || getStatusDisplay(selectedOrder.status)}
                                    </span>
                                </div>
                                {selectedOrder.table_number && (
                                    <div className="flex justify-between text-sm text-slate-800 mt-1.5">
                                        <span className="text-slate-400">Mesa</span>
                                        <span className="font-semibold">{selectedOrder.table_number}</span>
                                    </div>
                                )}
                            </div>

                            <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Productos</p>
                            <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
                                {selectedOrder.loading ? (
                                    <div className="py-8 text-center text-slate-400">
                                        <div className="w-8 h-8 rounded-full border-3 border-slate-200 border-t-slate-700 animate-spin mx-auto mb-2.5" />
                                        Cargando productos...
                                    </div>
                                ) : selectedOrder.items && selectedOrder.items.length > 0 ? (
                                    selectedOrder.items.map((item, idx) => (
                                        <div key={idx} className="p-3 px-4 border-b border-slate-100 last:border-b-0 flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold text-slate-800 text-sm m-0 mb-0.5">
                                                    {item.product_details?.name || item.product_name || 'Producto'}
                                                </p>
                                                <p className="text-slate-400 text-xs m-0">
                                                    {item.quantity} &times; ${item.unit_price}
                                                </p>
                                                {item.notes && (
                                                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded inline-block mt-1 font-medium">
                                                        📝 {item.notes}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="font-bold text-emerald-600 text-sm">${item.line_total || item.subtotal}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="p-5 text-center text-slate-400 margin-0">
                                        No hay productos en esta orden
                                    </p>
                                )}
                            </div>

                            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                                <div className="flex justify-between mb-2 text-sm text-slate-500">
                                    <span>Subtotal</span>
                                    <span className="text-slate-800 font-medium">${selectedOrder.subtotal}</span>
                                </div>
                                {Number(selectedOrder.tax_amount || 0) > 0 && (
                                    <div className="flex justify-between mb-2 text-sm text-slate-500">
                                        <span>Impuestos</span>
                                        <span className="text-slate-800 font-medium">${selectedOrder.tax_amount}</span>
                                    </div>
                                )}
                                {Number(selectedOrder.discount_amount || 0) > 0 && (
                                    <div className="flex justify-between mb-2 text-sm text-slate-500">
                                        <span>Descuento</span>
                                        <span className="text-rose-600 font-medium">-${selectedOrder.discount_amount}</span>
                                    </div>
                                )}
                                <div className="border-t border-slate-200 pt-2.5 mt-1.5 flex justify-between items-center">
                                    <span className="text-base font-bold text-slate-800">Total</span>
                                    <span className="text-lg font-extrabold text-emerald-600">${selectedOrder.total}</span>
                                </div>
                            </div>

                            {selectedOrder.notes && (
                                <div className="mt-5 bg-amber-50/50 p-3.5 rounded-xl border border-amber-200">
                                    <p className="margin-0 mb-1 text-[10px] font-bold text-amber-700 uppercase tracking-wider">Notas</p>
                                    <p className="margin-0 text-slate-800 text-sm">{selectedOrder.notes}</p>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex gap-2.5 justify-end">
                            <button
                                onClick={handleDeleteOrder}
                                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-250 text-rose-700 rounded-lg font-semibold text-sm cursor-pointer mr-auto transition-colors"
                            >
                                <i className="bi bi-trash" /> Eliminar Orden
                            </button>
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border-none rounded-lg font-semibold text-sm cursor-pointer transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
            `}</style>
        </div>
    );
};

export default Ordenes;
