import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const Ordenes = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState({});
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await api.get('/api/orders/orders/', {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
                });
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

    const handleStatusChange = async (orderNumber, newStatus, event) => {
        event.stopPropagation(); // Prevent row click when changing status
        setUpdatingStatus(prev => ({ ...prev, [orderNumber]: true }));
        try {
            const response = await api.post(
                `/api/orders/orders/${orderNumber}/update_status/`,
                { status: newStatus },
                { baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE }
            );

            console.log('Status update successful:', response.data);

            // Use the response data to update local state
            setOrders(prevOrders =>
                prevOrders.map(order =>
                    order.order_number === orderNumber
                        ? { ...order, ...response.data }
                        : order
                )
            );
        } catch (err) {
            console.error('Error updating status:', err);
            console.error('Error details:', err.response?.data);
            alert(`Error al actualizar el estado: ${err.response?.data?.detail || err.message}`);
        } finally {
            setUpdatingStatus(prev => ({ ...prev, [orderNumber]: false }));
        }
    };

    const handleRowClick = async (order) => {
        setShowModal(true);
        setSelectedOrder({ ...order, loading: true }); // Show modal with loading state

        try {
            // Fetch full order details including items
            const response = await api.get(
                `/api/orders/orders/${order.order_number}/`,
                { baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE }
            );
            setSelectedOrder(response.data);
        } catch (err) {
            console.error('Error fetching order details:', err);
            alert('Error al cargar los detalles de la orden');
            setShowModal(false);
            setSelectedOrder(null);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedOrder(null);
    };

    const getStatusDisplay = (status) => {
        const statusMap = {
            'pending': 'Pendiente',
            'completed': 'Completado'
        };
        return statusMap[status] || status;
    };

    const getStatusColor = (status) => {
        const statusColors = {
            'completado': 'bg-green-100 text-green-700 border-green-200',
            'completed': 'bg-green-100 text-green-700 border-green-200',
            'pendiente': 'bg-yellow-100 text-yellow-700 border-yellow-200',
            'pending': 'bg-yellow-100 text-yellow-700 border-yellow-200'
        };
        return statusColors[status.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    const getStatusKey = (statusDisplay) => {
        const reverseMap = {
            'Pendiente': 'pending',
            'Completado': 'completed'
        };
        return reverseMap[statusDisplay] || statusDisplay.toLowerCase();
    };

    // Smart sorting: pending orders first (oldest first - FIFO), then completed orders (newest first)
    const sortedAndFilteredOrders = orders
        .filter(order =>
            order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .sort((a, b) => {
            // Consider 'completado' and 'completed' as completed statuses
            const aCompleted = ['completado', 'completed'].includes(a.status_display?.toLowerCase()) ||
                ['completed'].includes(a.status?.toLowerCase());
            const bCompleted = ['completado', 'completed'].includes(b.status_display?.toLowerCase()) ||
                ['completed'].includes(b.status?.toLowerCase());

            // If one is completed and the other isn't, non-completed comes first
            if (aCompleted !== bCompleted) {
                return aCompleted ? 1 : -1;
            }

            // For pending orders: oldest first (FIFO)
            // For completed orders: newest first
            if (!aCompleted) {
                return new Date(a.created_at) - new Date(b.created_at); // Oldest first
            } else {
                return new Date(b.created_at) - new Date(a.created_at); // Newest first
            }
        });

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        display: 'inline-block',
                        width: '48px',
                        height: '48px',
                        border: '4px solid #e5e7eb',
                        borderTopColor: '#2563eb',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }}></div>
                    <p style={{ marginTop: '16px', color: '#4b5563', fontWeight: '500' }}>Cargando órdenes...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
                <div style={{ backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', maxWidth: '448px' }}>
                    <p style={{ color: '#991b1b', fontWeight: '500' }}>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #f9fafb, #f3f4f6)', padding: '24px' }}>
            <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>Órdenes</h1>
                    <p style={{ color: '#6b7280' }}>Gestiona y visualiza todas las órdenes del restaurante</p>
                </div>

                {/* Search Bar */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', padding: '16px', marginBottom: '24px' }}>
                    <input
                        type="text"
                        placeholder="Buscar por número de orden o cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 16px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            outline: 'none',
                            fontSize: '14px',
                            transition: 'all 0.2s'
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = '#3b82f6';
                            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#d1d5db';
                            e.target.style.boxShadow = 'none';
                        }}
                    />
                </div>

                {/* Orders Table */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: 'linear-gradient(to right, #f9fafb, #f3f4f6)', borderBottom: '1px solid #e5e7eb' }}>
                                <tr>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        N° Orden
                                    </th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Cliente
                                    </th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Tipo
                                    </th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Total
                                    </th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Estado
                                    </th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Fecha
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedAndFilteredOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '48px 24px', textAlign: 'center' }}>
                                            <p style={{ color: '#6b7280', fontWeight: '500', fontSize: '16px' }}>
                                                {searchTerm ? 'No se encontraron órdenes' : 'No hay órdenes registradas'}
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    sortedAndFilteredOrders.map(order => {
                                        const isCompleted = ['completado', 'completed'].includes(order.status_display?.toLowerCase()) ||
                                            ['completed'].includes(order.status?.toLowerCase());
                                        return (
                                            <tr
                                                key={order.id}
                                                onClick={() => handleRowClick(order)}
                                                style={{
                                                    borderBottom: '1px solid #e5e7eb',
                                                    transition: 'background-color 0.2s',
                                                    opacity: isCompleted ? 0.6 : 1,
                                                    cursor: 'pointer'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                    <span style={{ fontWeight: '600', color: '#2563eb' }}>
                                                        {order.order_number}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                    <span style={{ color: '#374151' }}>
                                                        {order.customer_name || 'Cliente Casual'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                    <span style={{ color: '#4b5563' }}>
                                                        {order.order_type_display}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                    <span style={{ fontWeight: '600', color: '#059669' }}>
                                                        ${order.total}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                    <select
                                                        value={getStatusKey(order.status_display)}
                                                        onChange={(e) => handleStatusChange(order.order_number, e.target.value, e)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        disabled={updatingStatus[order.order_number]}
                                                        className={getStatusColor(order.status_display)}
                                                        style={{
                                                            padding: '6px 12px',
                                                            borderRadius: '9999px',
                                                            fontSize: '12px',
                                                            fontWeight: '500',
                                                            border: '1px solid',
                                                            cursor: updatingStatus[order.order_number] ? 'wait' : 'pointer',
                                                            outline: 'none'
                                                        }}
                                                    >
                                                        <option value="pending">Pendiente</option>
                                                        <option value="completed">Completado</option>
                                                    </select>
                                                </td>
                                                <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                    <span style={{ fontSize: '14px', color: '#4b5563' }}>
                                                        {new Date(order.created_at).toLocaleString('es-ES', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Stats */}
                {sortedAndFilteredOrders.length > 0 && (
                    <div style={{ marginTop: '24px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', padding: '16px' }}>
                        <p style={{ fontSize: '14px', color: '#4b5563' }}>
                            Mostrando <span style={{ fontWeight: '600', color: '#1f2937' }}>{sortedAndFilteredOrders.length}</span> de{' '}
                            <span style={{ fontWeight: '600', color: '#1f2937' }}>{orders.length}</span> órdenes
                        </p>
                    </div>
                )}
            </div>

            {/* Order Details Modal */}
            {showModal && selectedOrder && (
                <div
                    onClick={closeModal}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '20px'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            maxWidth: '600px',
                            width: '100%',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                        }}
                    >
                        {/* Modal Header */}
                        <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
                                    Orden {selectedOrder.order_number}
                                </h2>
                                <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
                                    {new Date(selectedOrder.created_at).toLocaleString('es-ES', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                            </div>
                            <button
                                onClick={closeModal}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#6b7280',
                                    padding: '4px 8px'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '24px' }}>
                            {/* Customer Info */}
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                                    Información del Cliente
                                </h3>
                                <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
                                    <p style={{ margin: '0 0 8px 0', color: '#1f2937' }}>
                                        <strong>Nombre:</strong> {selectedOrder.customer_name || 'Cliente Casual'}
                                    </p>
                                    <p style={{ margin: '0 0 8px 0', color: '#1f2937' }}>
                                        <strong>Tipo de Orden:</strong> {selectedOrder.order_type_display}
                                    </p>
                                    {selectedOrder.table_number && (
                                        <p style={{ margin: '0', color: '#1f2937' }}>
                                            <strong>Mesa:</strong> {selectedOrder.table_number}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Order Items */}
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                                    Productos
                                </h3>
                                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                                        selectedOrder.items.map((item, index) => (
                                            <div
                                                key={index}
                                                style={{
                                                    padding: '12px 16px',
                                                    borderBottom: index < selectedOrder.items.length - 1 ? '1px solid #e5e7eb' : 'none',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <div>
                                                    <p style={{ margin: 0, fontWeight: '500', color: '#1f2937' }}>
                                                        {item.product_details?.name || 'Producto'}
                                                    </p>
                                                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
                                                        Cantidad: {item.quantity} × ${item.unit_price}
                                                    </p>
                                                </div>
                                                <p style={{ margin: 0, fontWeight: '600', color: '#059669' }}>
                                                    ${item.line_total || item.subtotal}
                                                </p>
                                            </div>
                                        ))
                                    ) : (
                                        <p style={{ padding: '16px', margin: 0, color: '#6b7280', textAlign: 'center' }}>
                                            No hay productos en esta orden
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Order Summary */}
                            <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: '#6b7280' }}>Subtotal:</span>
                                    <span style={{ fontWeight: '500', color: '#1f2937' }}>${selectedOrder.subtotal}</span>
                                </div>
                                {selectedOrder.tax_amount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ color: '#6b7280' }}>Impuestos:</span>
                                        <span style={{ fontWeight: '500', color: '#1f2937' }}>${selectedOrder.tax_amount}</span>
                                    </div>
                                )}
                                {selectedOrder.discount_amount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ color: '#6b7280' }}>Descuento:</span>
                                        <span style={{ fontWeight: '500', color: '#ef4444' }}>-${selectedOrder.discount_amount}</span>
                                    </div>
                                )}
                                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>Total:</span>
                                    <span style={{ fontSize: '18px', fontWeight: '700', color: '#059669' }}>${selectedOrder.total}</span>
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedOrder.notes && (
                                <div style={{ marginTop: '24px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                                        Notas
                                    </h3>
                                    <p style={{ backgroundColor: '#fef3c7', padding: '12px', borderRadius: '8px', margin: 0, color: '#92400e' }}>
                                        {selectedOrder.notes}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default Ordenes;