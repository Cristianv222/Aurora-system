import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Customer } from '../../types';

interface NewCustomerInput {
    email: string;
    password?: string;
    password_confirmation?: string;
    first_name: string;
    last_name: string;
    phone: string;
    address: string;
    city: string;
}

const Clientes: React.FC = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [showModal, setShowModal] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [newCustomer, setNewCustomer] = useState<NewCustomerInput>({
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
        const handleEscape = (e: KeyboardEvent) => {
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
            const response = await api.get('/api/restaurant/customers/admin/list/', {
                baseURL: import.meta.env.VITE_RESTAURANT_SERVICE,
                params
            });
            setCustomers(response.data?.data?.customers || []);
        } catch (err: any) {
            console.error('Error fetching customers:', err);
            setError('Error al cargar clientes: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchCustomers(searchTerm);
    };

    const handleCreateCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/api/restaurant/customers/register/', newCustomer);

            showNotification('Cliente creado exitosamente', 'success');
            closeModal();
            fetchCustomers();
        } catch (err: any) {
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const showNotification = (message: string, type: 'success' | 'error') => {
        alert(message);
    };

    const getCustomerTypeColor = (type?: string) => {
        const colors: Record<string, string> = {
            'regular': 'bg-blue-100 text-blue-700 border-blue-200',
            'premium': 'bg-purple-100 text-purple-700 border-purple-200',
            'vip': 'bg-amber-100 text-amber-700 border-amber-200'
        };
        return colors[type?.toLowerCase() || ''] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    if (loading && customers.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="inline-block w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="mt-4 text-gray-600 font-medium">Cargando clientes...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex justify-between items-start flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Gestión de Clientes</h1>
                        <p className="text-gray-500">Administra la base de datos de clientes del restaurante</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium text-sm flex items-center gap-2 transition-all shadow-sm hover:-translate-y-0.5 hover:shadow-md cursor-pointer border-none"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Nuevo Cliente
                    </button>
                </div>

                {/* Search Bar */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                    <form onSubmit={handleSearch} className="flex gap-3 items-center">
                        <div className="flex-1 relative">
                            <svg
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
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
                                className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg outline-none text-sm transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-gray-500 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-all cursor-pointer border-none"
                        >
                            Buscar
                        </button>
                    </form>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-red-800 text-sm">{error}</span>
                    </div>
                )}

                {/* Customers Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Cliente
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Contacto
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Ciudad
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Tipo
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Registro
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <svg
                                                className="w-12 h-12 mx-auto mb-4 text-gray-300"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            <p className="text-gray-500 font-medium text-lg m-0">
                                                {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                                            </p>
                                            {searchTerm && (
                                                <p className="text-gray-400 text-sm mt-2">
                                                    Intenta con otros términos de búsqueda
                                                </p>
                                            )}
                                        </td>
                                    </tr>
                                ) : (
                                    customers.map(customer => (
                                        <tr
                                            key={customer.id}
                                            className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center font-semibold text-blue-600 text-sm">
                                                        {customer.first_name?.charAt(0)}{customer.last_name?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="m-0 font-semibold text-gray-900">
                                                            {customer.first_name} {customer.last_name}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-gray-500">
                                                            {customer.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                    </svg>
                                                    <span className="text-gray-700 text-sm">
                                                        {customer.phone || 'Sin teléfono'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-gray-600 text-sm">
                                                    {customer.city || '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`${getCustomerTypeColor(customer.customer_type)} px-3 py-1 rounded-full text-xs font-medium border inline-block`}
                                                >
                                                    {customer.customer_type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-gray-600">
                                                    {customer.created_at ? new Date(customer.created_at).toLocaleDateString('es-ES', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    }) : '-'}
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
                    <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <p className="text-sm text-gray-600 m-0">
                            Mostrando <span className="font-semibold text-gray-900">{customers.length}</span> cliente{customers.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                )}
            </div>

            {/* Create Customer Modal */}
            {showModal && (
                <div
                    onClick={closeModal}
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 m-0">
                                    Nuevo Cliente
                                </h2>
                                <p className="text-gray-500 text-sm mt-1 mb-0">
                                    Completa la información del cliente
                                </p>
                            </div>
                            <button
                                onClick={closeModal}
                                className="bg-transparent border-none text-2xl cursor-pointer text-gray-500 hover:text-gray-700 px-2 py-1 leading-none"
                                aria-label="Cerrar modal"
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleCreateCustomer}>
                            <div className="p-6">
                                {/* Email */}
                                <div className="mb-5">
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={newCustomer.email}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none text-sm transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                                    />
                                </div>

                                {/* Nombre y Apellido */}
                                <div className="flex gap-4 mb-5">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Nombre *
                                        </label>
                                        <input
                                            type="text"
                                            name="first_name"
                                            value={newCustomer.first_name}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none text-sm transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Apellido *
                                        </label>
                                        <input
                                            type="text"
                                            name="last_name"
                                            value={newCustomer.last_name}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none text-sm transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                                        />
                                    </div>
                                </div>

                                {/* Teléfono */}
                                <div className="mb-5">
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Teléfono
                                    </label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={newCustomer.phone}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none text-sm transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                                    />
                                </div>

                                {/* Ciudad */}
                                <div className="mb-5">
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Ciudad
                                    </label>
                                    <input
                                        type="text"
                                        name="city"
                                        value={newCustomer.city}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none text-sm transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                                    />
                                </div>

                                {/* Info Note */}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 mb-5">
                                    <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    <p className="m-0 text-xs text-blue-800 leading-relaxed">
                                        Se asignará automáticamente la contraseña predeterminada: <strong>Password123!</strong>
                                    </p>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={submitting}
                                    className="bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 px-5 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 disabled:cursor-not-allowed border-none"
                                >
                                    {submitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        </div>
    );
};

export default Clientes;
