import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { User } from '../types';

const UserList: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await api.get('/api/users/');
            console.log('API Response:', response.data);

            let userData: User[] = [];
            if (response.data.results && Array.isArray(response.data.results)) {
                userData = response.data.results;
            } else if (Array.isArray(response.data)) {
                userData = response.data;
            } else {
                console.error('Formato de respuesta inesperado:', response.data);
                userData = [];
            }
            setUsers(userData);
        } catch (err) {
            setError('Error al cargar usuarios');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
            try {
                await api.delete(`/api/users/${id}/`);
                setUsers(users.filter(user => user.id !== id));
            } catch (err) {
                alert('Error al eliminar usuario');
                console.error(err);
            }
        }
    };

    if (loading) return <div className="p-6 text-center text-slate-500">Cargando...</div>;
    if (error) return <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-lg m-6 text-sm">{error}</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <h2 className="text-2xl font-bold text-slate-800">Gestión de Usuarios</h2>
                <Link to="/users/new" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 transition">
                    Nuevo Usuario
                </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                                <th className="px-6 py-3.5">ID</th>
                                <th className="px-6 py-3.5">Usuario</th>
                                <th className="px-6 py-3.5">Email</th>
                                <th className="px-6 py-3.5">Nombre</th>
                                <th className="px-6 py-3.5">Rol</th>
                                <th className="px-6 py-3.5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {users.map(user => (
                                <tr key={user.id} className="hover:bg-slate-50/50 transition">
                                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{user.id}</td>
                                    <td className="px-6 py-4 font-semibold text-slate-800">{user.email.split('@')[0]}</td>
                                    <td className="px-6 py-4">{user.email}</td>
                                    <td className="px-6 py-4">{`${user.first_name || ''} ${user.last_name || ''}`}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                            {user.role?.name || 'Empleado'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <Link to={`/users/${user.id}/edit`} className="px-2.5 py-1.5 border border-slate-200 rounded-md text-xs font-semibold hover:bg-slate-50 transition">
                                            Editar
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(user.id)}
                                            className="px-2.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-xs font-semibold transition"
                                        >
                                            Eliminar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                                        No hay usuarios registrados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UserList;
