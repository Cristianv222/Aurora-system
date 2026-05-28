import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';
import FormularioUsuario from './FormularioUsuario';
import { User } from '../../types';

const ListaUsuarios: React.FC = () => {
    const [users, setUsers]           = useState<User[]>([]);
    const [loading, setLoading]       = useState<boolean>(true);
    const [error, setError]           = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null); // id a eliminar
    const [search, setSearch]         = useState<string>('');

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/users/');
            let userData: User[] = [];
            if (response.data.results && Array.isArray(response.data.results)) {
                userData = response.data.results;
            } else if (Array.isArray(response.data)) {
                userData = response.data;
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
        try {
            await api.delete(`/api/users/${id}/`);
            setUsers(users.filter(u => u.id !== id));
            setDeleteConfirm(null);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreate = () => { setCurrentUser(null); setIsModalOpen(true); };
    const handleEdit   = (user: User) => { setCurrentUser(user); setIsModalOpen(true); };
    const handleClose  = () => { setIsModalOpen(false); setCurrentUser(null); };
    const handleSave   = () => { handleClose(); fetchUsers(); };

    const filtered = users.filter(u =>
        `${u.email} ${u.first_name} ${u.last_name}`
            .toLowerCase().includes(search.toLowerCase())
    );

    const getInitials = (u: User) => {
        const f = u.first_name?.charAt(0) || '';
        const l = u.last_name?.charAt(0)  || '';
        return (f + l).toUpperCase() || u.email?.charAt(0).toUpperCase() || '?';
    };

    const avatarColors = [
        '#1a2e4a','#2c4f7c','#3a6ea8','#5b8fc9',
        '#243b5e','#1e3a5f','#2d5986','#4a7fb5',
    ];
    const getColor = (id: number) => avatarColors[id % avatarColors.length];

    return (
        <>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
            <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

            <div className="p-6 max-w-6xl mx-auto space-y-6 font-sans">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-200 pb-5">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <i className="bi bi-people text-slate-700"></i>
                            <span>Gestión de Usuarios</span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">Administra los usuarios y sus roles en el sistema</p>
                    </div>
                    <button 
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 shadow-md shadow-slate-900/10 active:scale-[0.98] transition-all"
                        onClick={handleCreate}
                    >
                        <i className="bi bi-person-plus-fill text-base"></i>
                        <span>Nuevo Usuario</span>
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3.5 rounded-xl text-sm flex items-center gap-2 font-semibold">
                        <i className="bi bi-exclamation-circle-fill"></i>
                        <span>{error}</span>
                    </div>
                )}

                {/* Stats */}
                {!loading && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center text-lg flex-shrink-0">
                                <i className="bi bi-people-fill"></i>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-slate-800">{users.length}</div>
                                <div className="text-xxs text-slate-500 font-semibold uppercase tracking-wider">Total usuarios</div>
                            </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center text-lg flex-shrink-0">
                                <i className="bi bi-person-check-fill"></i>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-slate-800">{users.filter(u => u.is_active !== false).length}</div>
                                <div className="text-xxs text-slate-500 font-semibold uppercase tracking-wider">Activos</div>
                            </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center text-lg flex-shrink-0">
                                <i className="bi bi-shield-fill"></i>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-slate-800">{[...new Set(users.map(u => u.role?.name || ''))].filter(Boolean).length}</div>
                                <div className="text-xxs text-slate-500 font-semibold uppercase tracking-wider">Roles distintos</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="relative flex-1">
                        <i className="bi bi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                        <input
                            type="text"
                            placeholder="Buscar por nombre, usuario o email..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-800 transition"
                        />
                    </div>
                    <span className="self-start sm:self-auto px-3.5 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
                        {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Tabla */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500 text-sm">
                            <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
                            <span>Cargando usuarios...</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                                        <th className="px-6 py-3.5 w-20">ID</th>
                                        <th className="px-6 py-3.5">Usuario</th>
                                        <th className="px-6 py-3.5">Rol</th>
                                        <th className="px-6 py-3.5 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                                <i className="bi bi-person-x text-3xl block mb-2 opacity-50"></i>
                                                <p className="text-sm">{search ? 'No se encontraron resultados para tu búsqueda.' : 'No hay usuarios registrados.'}</p>
                                            </td>
                                        </tr>
                                    ) : filtered.map((user, idx) => (
                                        <tr key={user.id} className="hover:bg-slate-50/50 transition">
                                            <td className="px-6 py-4 font-semibold text-slate-400 text-xs">
                                                #{String(user.id).substring(0, 8)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-9 h-9 rounded-full text-white font-bold text-xs flex items-center justify-center flex-shrink-0"
                                                        style={{ background: getColor(idx) }}
                                                    >
                                                        {getInitials(user)}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-800">
                                                            {user.first_name || user.last_name
                                                                ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                                                                : user.email.split('@')[0]}
                                                        </div>
                                                        <div className="text-xxs text-slate-400 flex items-center gap-1 mt-0.5">
                                                            <i className="bi bi-envelope text-[10px]"></i>
                                                            <span>{user.email}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xxs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                                    <i className="bi bi-shield-check text-[10px]"></i>
                                                    <span>{user.role?.name || 'Empleado'}</span>
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right space-x-2">
                                                <button 
                                                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 transition" 
                                                    onClick={() => handleEdit(user)}
                                                >
                                                    <i className="bi bi-pencil mr-1"></i>
                                                    <span>Editar</span>
                                                </button>
                                                <button 
                                                    className="px-2.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-semibold transition" 
                                                    onClick={() => setDeleteConfirm(user.id)}
                                                >
                                                    <i className="bi bi-trash3 mr-1"></i>
                                                    <span>Eliminar</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal confirmación eliminar */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-[2000] p-4" onClick={() => setDeleteConfirm(null)}>
                    <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-100 text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-14 h-14 rounded-full bg-red-50 border-2 border-red-100 flex items-center justify-center text-xl text-red-600 mx-auto mb-4">
                            <i className="bi bi-trash3-fill"></i>
                        </div>
                        <h3 className="text-base font-bold text-slate-800 mb-2">Eliminar usuario</h3>
                        <p className="text-xs text-slate-500 mb-6 leading-relaxed">¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.</p>
                        <div className="flex gap-3 justify-center">
                            <button 
                                className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 transition" 
                                onClick={() => setDeleteConfirm(null)}
                            >
                                Cancelar
                            </button>
                            <button 
                                className="flex-1 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:opacity-95 text-white rounded-xl text-xs font-semibold shadow-md shadow-red-600/25 transition" 
                                onClick={() => handleDelete(deleteConfirm)}
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal crear/editar */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleClose}
                title={currentUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            >
                <FormularioUsuario
                    userToEdit={currentUser}
                    onSave={handleSave}
                    onCancel={handleClose}
                />
            </Modal>
        </>
    );
};

export default ListaUsuarios;
