import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const Clientes = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [newCustomer, setNewCustomer] = useState({
        email: '',
        password: 'Password123!', // Default password for POS created customers
        password_confirmation: 'Password123!',
        first_name: '',
        last_name: '',
        phone: '',
        address: '',
        city: ''
    });

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async (search = '') => {
        setLoading(true);
        try {
            const params = search ? { search } : {};
            const response = await api.get('/api/customers/admin/list/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE,
                params
            });
            setCustomers(response.data.data.customers || []);
        } catch (err) {
            console.error('Error fetching customers:', err);
            setError('Error al cargar clientes: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchCustomers(searchTerm);
    };

    const handleCreateCustomer = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/customers/register/', newCustomer, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            alert('Cliente creado exitosamente');
            setShowModal(false);
            setNewCustomer({
                email: '',
                password: 'Password123!',
                password_confirmation: 'Password123!',
                first_name: '',
                last_name: '',
                phone: '',
                address: '',
                city: ''
            });
            fetchCustomers();
        } catch (err) {
            console.error('Error creating customer:', err);
            const errorData = err.response?.data;
            let errorMessage = 'Error al crear cliente';

            if (errorData?.errors) {
                errorMessage += ':\n' + Object.entries(errorData.errors)
                    .map(([key, val]) => `- ${key}: ${val}`)
                    .join('\n');
            } else if (errorData?.message) {
                errorMessage += ': ' + errorData.message;
            } else {
                errorMessage += ': ' + err.message;
            }

            alert(errorMessage);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewCustomer(prev => ({
            ...prev,
            [name]: value
        }));
    };

    if (loading && customers.length === 0) return <div>Cargando clientes...</div>;

    return (
        <div className="page-container">
            <div className="page-header">
                <h2>Gestión de Clientes</h2>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    Nuevo Cliente
                </button>
            </div>

            <div className="form-group">
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem' }}>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Buscar por nombre, email o teléfono..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ maxWidth: '400px' }}
                    />
                    <button type="submit" className="btn btn-secondary">Buscar</button>
                </form>
            </div>

            {error && <div style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>{error}</div>}

            <div className="table-responsive">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Email</th>
                            <th>Teléfono</th>
                            <th>Ciudad</th>
                            <th>Tipo</th>
                            <th>Registro</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No hay clientes registrados</td></tr>
                        ) : (
                            customers.map(customer => (
                                <tr key={customer.id}>
                                    <td>{customer.first_name} {customer.last_name}</td>
                                    <td>{customer.email}</td>
                                    <td>{customer.phone || '-'}</td>
                                    <td>{customer.city || '-'}</td>
                                    <td>{customer.customer_type}</td>
                                    <td>{new Date(customer.created_at).toLocaleDateString()}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal Crear Cliente */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Nuevo Cliente</h3>
                        <form onSubmit={handleCreateCustomer}>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={newCustomer.email}
                                    onChange={handleInputChange}
                                    required
                                    className="form-control"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Nombre</label>
                                    <input
                                        type="text"
                                        name="first_name"
                                        value={newCustomer.first_name}
                                        onChange={handleInputChange}
                                        required
                                        className="form-control"
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Apellido</label>
                                    <input
                                        type="text"
                                        name="last_name"
                                        value={newCustomer.last_name}
                                        onChange={handleInputChange}
                                        required
                                        className="form-control"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Teléfono</label>
                                <input
                                    type="text"
                                    name="phone"
                                    value={newCustomer.phone}
                                    onChange={handleInputChange}
                                    className="form-control"
                                />
                            </div>
                            <div className="form-group">
                                <label>Ciudad</label>
                                <input
                                    type="text"
                                    name="city"
                                    value={newCustomer.city}
                                    onChange={handleInputChange}
                                    className="form-control"
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Clientes;
