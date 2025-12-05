import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const Clientes = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [newCustomer, setNewCustomer] = useState({
        email: '',
        password: 'Password123!',
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

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && showModal) {
                closeModal();
            }
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

    const fetchCustomers = async (search = '') => {
        setLoading(true);
        setError('');
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
        setSubmitting(true);
        try {
            await api.post('/api/customers/register/', newCustomer, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });

            // Success notification
            showNotification('Cliente creado exitosamente', 'success');
            closeModal();
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
        } finally {
            setSubmitting(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewCustomer(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const closeModal = () => {
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
    };

    const showNotification = (message, type) => {
        // Simple notification - you can replace with a toast library
        alert(message);
    };

    const getCustomerTypeColor = (type) => {
        const colors = {
            'regular': 'bg-blue-100 text-blue-700 border-blue-200',
            'premium': 'bg-purple-100 text-purple-700 border-purple-200',
            'vip': 'bg-amber-100 text-amber-700 border-amber-200'
        };
        return colors[type?.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    if (loading && customers.length === 0) {
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
                    <p style={{ marginTop: '16px', color: '#4b5563', fontWeight: '500' }}>Cargando clientes...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #f9fafb, #f3f4f6)', padding: '24px' }}>
            <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>Gestión de Clientes</h1>
                        <p style={{ color: '#6b7280' }}>Administra la base de datos de clientes del restaurante</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        style={{
                            backgroundColor: '#2563eb',
                            color: 'white',
                            padding: '12px 24px',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: '500',
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#1d4ed8';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.15)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#2563eb';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                        }}
                    >
                        <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Nuevo Cliente
                    </button>
                </div>

                {/* Search Bar */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', padding: '16px', marginBottom: '24px' }}>
                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <svg
                                style={{
                                    position: 'absolute',
                                    left: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '20px',
                                    height: '20px',
                                    color: '#9ca3af'
                                }}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Buscar por nombre, email o teléfono..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 16px 10px 44px',
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
                        <button
                            type="submit"
                            style={{
                                backgroundColor: '#6b7280',
                                color: 'white',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: 'none',
                                fontWeight: '500',
                                cursor: 'pointer',
                                fontSize: '14px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6b7280'}
                        >
                            Buscar
                        </button>
                    </form>
                </div>

                {/* Error Message */}
                {error && (
                    <div style={{
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <svg style={{ width: '20px', height: '20px', color: '#ef4444' }} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span style={{ color: '#991b1b', fontSize: '14px' }}>{error}</span>
                    </div>
                )}

                {/* Customers Table */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: 'linear-gradient(to right, #f9fafb, #f3f4f6)', borderBottom: '1px solid #e5e7eb' }}>
                                <tr>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Cliente
                                    </th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Contacto
                                    </th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Ciudad
                                    </th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Tipo
                                    </th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Registro
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '48px 24px', textAlign: 'center' }}>
                                            <svg
                                                style={{ width: '48px', height: '48px', margin: '0 auto 16px', color: '#d1d5db' }}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            <p style={{ color: '#6b7280', fontWeight: '500', fontSize: '16px', margin: 0 }}>
                                                {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                                            </p>
                                            {searchTerm && (
                                                <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '8px' }}>
                                                    Intenta con otros términos de búsqueda
                                                </p>
                                            )}
                                        </td>
                                    </tr>
                                ) : (
                                    customers.map(customer => (
                                        <tr
                                            key={customer.id}
                                            style={{
                                                borderBottom: '1px solid #e5e7eb',
                                                transition: 'background-color 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <td style={{ padding: '16px 24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '40px',
                                                        height: '40px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#eff6ff',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontWeight: '600',
                                                        color: '#2563eb',
                                                        fontSize: '14px'
                                                    }}>
                                                        {customer.first_name?.charAt(0)}{customer.last_name?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p style={{ margin: 0, fontWeight: '600', color: '#1f2937' }}>
                                                            {customer.first_name} {customer.last_name}
                                                        </p>
                                                        <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                                                            {customer.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <svg style={{ width: '16px', height: '16px', color: '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                    </svg>
                                                    <span style={{ color: '#374151', fontSize: '14px' }}>
                                                        {customer.phone || 'Sin teléfono'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                <span style={{ color: '#4b5563', fontSize: '14px' }}>
                                                    {customer.city || '-'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                <span
                                                    className={getCustomerTypeColor(customer.customer_type)}
                                                    style={{
                                                        padding: '4px 12px',
                                                        borderRadius: '9999px',
                                                        fontSize: '12px',
                                                        fontWeight: '500',
                                                        border: '1px solid',
                                                        display: 'inline-block'
                                                    }}
                                                >
                                                    {customer.customer_type}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                <span style={{ fontSize: '14px', color: '#4b5563' }}>
                                                    {new Date(customer.created_at).toLocaleDateString('es-ES', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    })}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Stats */}
                {customers.length > 0 && (
                    <div style={{ marginTop: '24px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', padding: '16px' }}>
                        <p style={{ fontSize: '14px', color: '#4b5563', margin: 0 }}>
                            Mostrando <span style={{ fontWeight: '600', color: '#1f2937' }}>{customers.length}</span> cliente{customers.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                )}
            </div>

            {/* Create Customer Modal */}
            {showModal && (
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
                                    Nuevo Cliente
                                </h2>
                                <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px', marginBottom: 0 }}>
                                    Completa la información del cliente
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
                                    padding: '4px 8px',
                                    lineHeight: 1
                                }}
                                aria-label="Cerrar modal"
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleCreateCustomer}>
                            <div style={{ padding: '24px' }}>
                                {/* Email */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={newCustomer.email}
                                        onChange={handleInputChange}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
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

                                {/* Nombre y Apellido */}
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                                            Nombre *
                                        </label>
                                        <input
                                            type="text"
                                            name="first_name"
                                            value={newCustomer.first_name}
                                            onChange={handleInputChange}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
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
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                                            Apellido *
                                        </label>
                                        <input
                                            type="text"
                                            name="last_name"
                                            value={newCustomer.last_name}
                                            onChange={handleInputChange}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
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
                                </div>

                                {/* Teléfono */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                                        Teléfono
                                    </label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={newCustomer.phone}
                                        onChange={handleInputChange}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
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

                                {/* Ciudad */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                                        Ciudad
                                    </label>
                                    <input
                                        type="text"
                                        name="city"
                                        value={newCustomer.city}
                                        onChange={handleInputChange}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
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

                                {/* Info Note */}
                                <div style={{
                                    backgroundColor: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    display: 'flex',
                                    gap: '8px',
                                    marginBottom: '20px'
                                }}>
                                    <svg style={{ width: '20px', height: '20px', color: '#2563eb', flexShrink: 0, marginTop: '2px' }} fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#1e40af', lineHeight: '1.5' }}>
                                        Se asignará automáticamente la contraseña predeterminada: <strong>Password123!</strong>
                                    </p>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div style={{
                                padding: '16px 24px',
                                borderTop: '1px solid #e5e7eb',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '12px',
                                backgroundColor: '#f9fafb'
                            }}>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={submitting}
                                    style={{
                                        backgroundColor: 'white',
                                        color: '#374151',
                                        padding: '10px 20px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        fontWeight: '500',
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        fontSize: '14px',
                                        transition: 'all 0.2s',
                                        opacity: submitting ? 0.5 : 1
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!submitting) {
                                            e.currentTarget.style.backgroundColor = '#f9fafb';
                                            e.currentTarget.style.borderColor = '#9ca3af';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'white';
                                        e.currentTarget.style.borderColor = '#d1d5db';
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        backgroundColor: submitting ? '#93c5fd' : '#2563eb',
                                        color: 'white',
                                        padding: '10px 24px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontWeight: '500',
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        fontSize: '14px',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!submitting) {
                                            e.currentTarget.style.backgroundColor = '#1d4ed8';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!submitting) {
                                            e.currentTarget.style.backgroundColor = '#2563eb';
                                        }
                                    }}
                                >
                                    {submitting ? (
                                        <>
                                            <div style={{
                                                width: '16px',
                                                height: '16px',
                                                border: '2px solid white',
                                                borderTopColor: 'transparent',
                                                borderRadius: '50%',
                                                animation: 'spin 0.6s linear infinite'
                                            }}></div>
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Guardar Cliente
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
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

export default Clientes;