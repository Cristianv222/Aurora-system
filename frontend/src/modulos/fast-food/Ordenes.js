import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const Ordenes = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                // Endpoint correcto basado en urls.py: /api/orders/orders/
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

    if (loading) return <div>Cargando órdenes...</div>;
    if (error) return <div className="alert alert-error">{error}</div>;

    return (
        <div className="page-container">
            <div className="page-header">
                <h2>Órdenes</h2>
            </div>

            <div className="table-responsive">
                <table className="table">
                    <thead>
                        <tr>
                            <th>N° Orden</th>
                            <th>Cliente</th>
                            <th>Tipo</th>
                            <th>Total</th>
                            <th>Estado</th>
                            <th>Fecha</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.length === 0 ? (
                            <tr><td colSpan="6">No hay órdenes registradas</td></tr>
                        ) : (
                            orders.map(order => (
                                <tr key={order.id}>
                                    <td>{order.order_number}</td>
                                    <td>{order.customer_name || 'Cliente Casual'}</td>
                                    <td>{order.order_type_display}</td>
                                    <td>${order.total}</td>
                                    <td>{order.status_display}</td>
                                    <td>{new Date(order.created_at).toLocaleString()}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Ordenes;
