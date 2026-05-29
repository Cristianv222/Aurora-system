import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';
import { Customer } from '../../types';

const Clientes: React.FC = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [showModal, setShowModal] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);
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

    const fetchCustomers = async (search = '') => {
        setLoading(true);
        setError('');
        try {
            const params = search ? { search } : {};
            const response = await api.get('/api/customers/admin/list/', {
                baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE,
                params
            });
            setCustomers(response.data.data.customers || []);
        } catch (err: any) {
            console.error('Error fetching customers:', err);
            setError('Error al cargar clientes: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    const handleSearch = (e: FormEvent) => {
        e.preventDefault();
        fetchCustomers(searchTerm);
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
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

    const handleCreateCustomer = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/api/customers/register/', newCustomer, {
                baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE
            });

            alert('Cliente creado exitosamente');
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

    const getCustomerTypeColor = (type?: string) => {
        const colors: Record<string, string> = {
            'regular': 'bg-blue-50 text-blue-700 border-blue-200',
            'premium': 'bg-purple-50 text-purple-700 border-purple-200',
            'vip': 'bg-amber-50 text-amber-700 border-amber-200'
        };
        return colors[type?.toLowerCase() || ''] || 'bg-slate-50 text-slate-700 border-slate-200';
    };

    if (loading && customers.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
                    <p className="mt-3 text-slate-550 font-medium text-sm">Cargando clientes...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Gestión de Clientes</h3>
                    <p className="text-xs text-slate-500 mt-1">Administra la base de datos de clientes de Fast Food</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider rounded-xl transition"
                >
                    + Nuevo Cliente
                </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <form onSubmit={handleSearch} className="flex gap-3 items-center">
                    <div className="flex-1 relative">
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
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
                            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800 transition"
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition"
                    >
                        Buscar
                    </button>
                </form>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{error}</span>
                </div>
            )}

            {/* Customers Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                                <th className="px-6 py-3.5">Cliente</th>
                                <th className="px-6 py-3.5">Contacto</th>
                                <th className="px-6 py-3.5">Ciudad</th>
                                <th className="px-6 py-3.5 w-32">Tipo</th>
                                <th className="px-6 py-3.5 w-40">Registro</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {customers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-slate-450">
                                        <div className="flex flex-col items-center justify-center">
                                            <svg
                                                className="w-10 h-10 text-slate-300 mb-2"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            <span className="font-semibold text-slate-800">
                                                {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                                            </span>
                                            {searchTerm && (
                                                <span className="text-xs text-slate-450 mt-1">
                                                    Intenta con otros términos de búsqueda
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                customers.map(customer => (
                                    <tr key={customer.id} className="hover:bg-slate-50/50 transition">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-800 border border-slate-200/50">
                                                    {customer.first_name?.charAt(0)}{customer.last_name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-800">
                                                        {customer.first_name} {customer.last_name}
                                                    </p>
                                                    <p className="text-xs text-slate-450 mt-0.5">
                                                        {customer.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                                <span>{customer.phone || 'Sin teléfono'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                            {customer.city || '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getCustomerTypeColor(customer.customer_type)}`}
                                            >
                                                {customer.customer_type || 'regular'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                            {customer.created_at ? new Date(customer.created_at).toLocaleDateString('es-ES', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric'
                                            }) : '—'}
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
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-semibold text-slate-600 text-right">
                    Mostrando {customers.length} cliente{customers.length !== 1 ? 's' : ''}
                </div>
            )}

            {/* Create Customer Modal */}
            <Modal isOpen={showModal} onClose={closeModal} title="Nuevo Cliente">
                <form onSubmit={handleCreateCustomer} className="space-y-4">
                    {/* Email */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Email *</label>
                        <input
                            type="email"
                            name="email"
                            value={newCustomer.email}
                            onChange={handleInputChange}
                            required
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition"
                        />
                    </div>

                    {/* Nombre y Apellido */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nombre *</label>
                            <input
                                type="text"
                                name="first_name"
                                value={newCustomer.first_name}
                                onChange={handleInputChange}
                                required
                                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Apellido *</label>
                            <input
                                type="text"
                                name="last_name"
                                value={newCustomer.last_name}
                                onChange={handleInputChange}
                                required
                                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition"
                            />
                        </div>
                    </div>

                    {/* Teléfono */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Teléfono</label>
                        <input
                            type="text"
                            name="phone"
                            value={newCustomer.phone}
                            onChange={handleInputChange}
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition"
                        />
                    </div>

                    {/* Ciudad */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ciudad</label>
                        <input
                            type="text"
                            name="city"
                            value={newCustomer.city}
                            onChange={handleInputChange}
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition"
                        />
                    </div>

                    {/* Info Note */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex gap-2.5 items-start">
                        <svg className="w-5 h-5 text-slate-650 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs text-slate-600 leading-normal">
                            Se asignará automáticamente la contraseña predeterminada: <strong className="font-bold text-slate-800">Password123!</strong>
                        </p>
                    </div>

                    {/* Modal Actions */}
                    <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={closeModal}
                            disabled={submitting}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {submitting ? 'Guardando...' : 'Guardar Cliente'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Clientes;
