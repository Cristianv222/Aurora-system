import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';
import FormularioUsuario from './FormularioUsuario';

const ListaUsuarios = () => {
    const [users, setUsers]           = useState([]);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null); // id a eliminar
    const [search, setSearch]         = useState('');

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/users/');
            let userData = [];
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

    const handleDelete = async (id) => {
        try {
            await api.delete(`/api/users/${id}/`);
            setUsers(users.filter(u => u.id !== id));
            setDeleteConfirm(null);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreate = () => { setCurrentUser(null); setIsModalOpen(true); };
    const handleEdit   = (user) => { setCurrentUser(user); setIsModalOpen(true); };
    const handleClose  = () => { setIsModalOpen(false); setCurrentUser(null); };
    const handleSave   = () => { handleClose(); fetchUsers(); };

    const filtered = users.filter(u =>
        `${u.username} ${u.email} ${u.first_name} ${u.last_name}`
            .toLowerCase().includes(search.toLowerCase())
    );

    const getInitials = (u) => {
        const f = u.first_name?.charAt(0) || '';
        const l = u.last_name?.charAt(0)  || '';
        return (f + l).toUpperCase() || u.username?.charAt(0).toUpperCase() || '?';
    };

    const avatarColors = [
        '#1a2e4a','#2c4f7c','#3a6ea8','#5b8fc9',
        '#243b5e','#1e3a5f','#2d5986','#4a7fb5',
    ];
    const getColor = (id) => avatarColors[id % avatarColors.length];

    return (
        <>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
            <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

            <style>{`
                *, *::before, *::after { box-sizing: border-box; }

                .lu-page {
                    font-family: 'Sora', sans-serif;
                    padding: 28px;
                    max-width: 1100px;
                }

                /* HEADER */
                .lu-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 16px;
                    margin-bottom: 24px;
                }
                .lu-header-left h2 {
                    font-size: 1.4rem;
                    font-weight: 700;
                    color: #1a2e4a;
                    margin: 0 0 4px;
                    letter-spacing: -0.02em;
                }
                .lu-header-left p {
                    font-size: 0.78rem;
                    color: #6b87a8;
                    margin: 0;
                }
                .lu-btn-new {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    background: linear-gradient(135deg, #1a2e4a 0%, #2c4f7c 100%);
                    color: #fff;
                    border: none;
                    border-radius: 10px;
                    font-family: 'Sora', sans-serif;
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: opacity .2s, transform .15s, box-shadow .2s;
                    box-shadow: 0 4px 14px rgba(26,46,74,0.22);
                    white-space: nowrap;
                }
                .lu-btn-new:hover { opacity: .9; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(26,46,74,0.28); }

                /* STATS */
                .lu-stats {
                    display: flex;
                    gap: 14px;
                    margin-bottom: 22px;
                    flex-wrap: wrap;
                }
                .lu-stat {
                    flex: 1;
                    min-width: 130px;
                    background: #fff;
                    border: 1.5px solid #dce8f5;
                    border-radius: 14px;
                    padding: 16px 18px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }
                .lu-stat-icon {
                    width: 42px; height: 42px;
                    border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.1rem;
                    flex-shrink: 0;
                }
                .lu-stat-icon.navy  { background: #eef3fa; color: #1a2e4a; }
                .lu-stat-icon.blue  { background: #e8f0fb; color: #2c4f7c; }
                .lu-stat-icon.light { background: #e4effa; color: #3a6ea8; }
                .lu-stat-val {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #1a2e4a;
                    line-height: 1;
                }
                .lu-stat-label {
                    font-size: 0.7rem;
                    color: #6b87a8;
                    margin-top: 2px;
                    font-weight: 500;
                }

                /* TOOLBAR */
                .lu-toolbar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                }
                .lu-search-wrap {
                    position: relative;
                    flex: 1;
                    min-width: 200px;
                }
                .lu-search-wrap i {
                    position: absolute;
                    left: 12px; top: 50%;
                    transform: translateY(-50%);
                    color: #6b87a8;
                    font-size: 0.9rem;
                    pointer-events: none;
                }
                .lu-search-wrap input {
                    width: 100%;
                    padding: 9px 14px 9px 36px;
                    border: 1.5px solid #dce8f5;
                    border-radius: 10px;
                    font-family: 'Sora', sans-serif;
                    font-size: 0.8rem;
                    color: #1a2e4a;
                    background: #fff;
                    outline: none;
                    transition: border-color .2s, box-shadow .2s;
                }
                .lu-search-wrap input:focus {
                    border-color: #2c4f7c;
                    box-shadow: 0 0 0 3px rgba(44,79,124,0.1);
                }
                .lu-search-wrap input::placeholder { color: #a0b4c8; }
                .lu-count-badge {
                    font-size: 0.72rem;
                    font-weight: 600;
                    color: #6b87a8;
                    background: #eef3fa;
                    border-radius: 20px;
                    padding: 4px 12px;
                    white-space: nowrap;
                }

                /* TABLA */
                .lu-card {
                    background: #fff;
                    border: 1.5px solid #dce8f5;
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 2px 16px rgba(26,46,74,0.06);
                }
                .lu-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.8rem;
                }
                .lu-table thead tr {
                    background: #f4f8fd;
                    border-bottom: 1.5px solid #dce8f5;
                }
                .lu-table thead th {
                    padding: 12px 16px;
                    text-align: left;
                    font-size: 0.68rem;
                    font-weight: 600;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: #6b87a8;
                    white-space: nowrap;
                }
                .lu-table tbody tr {
                    border-bottom: 1px solid #f0f5fb;
                    transition: background .15s;
                }
                .lu-table tbody tr:last-child { border-bottom: none; }
                .lu-table tbody tr:hover { background: #f8fafd; }
                .lu-table td { padding: 12px 16px; color: #1a2e4a; vertical-align: middle; }

                /* Avatar */
                .lu-avatar {
                    width: 34px; height: 34px;
                    border-radius: 50%;
                    color: #fff;
                    font-weight: 700;
                    font-size: 0.78rem;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                }
                .lu-user-cell {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .lu-user-name  { font-weight: 600; color: #1a2e4a; }
                .lu-user-email { font-size: 0.72rem; color: #6b87a8; margin-top: 1px; }

                /* Rol badge */
                .lu-role-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    background: #eef3fa;
                    color: #2c4f7c;
                    border: 1px solid #dce8f5;
                }

                /* Acciones */
                .lu-actions { display: flex; gap: 6px; }
                .lu-btn-edit, .lu-btn-del {
                    display: flex; align-items: center; gap: 5px;
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-family: 'Sora', sans-serif;
                    font-size: 0.73rem;
                    font-weight: 600;
                    cursor: pointer;
                    border: 1.5px solid;
                    transition: all .15s;
                    white-space: nowrap;
                }
                .lu-btn-edit {
                    background: #eef3fa; color: #2c4f7c;
                    border-color: #dce8f5;
                }
                .lu-btn-edit:hover { background: #dce8f5; border-color: #b8d0ea; }
                .lu-btn-del {
                    background: #fef2f2; color: #dc2626;
                    border-color: #fee2e2;
                }
                .lu-btn-del:hover { background: #fee2e2; border-color: #fca5a5; }

                /* Empty */
                .lu-empty {
                    text-align: center;
                    padding: 48px 24px;
                    color: #6b87a8;
                }
                .lu-empty i { font-size: 2.5rem; opacity: .35; display: block; margin-bottom: 12px; }
                .lu-empty p { font-size: 0.82rem; margin: 0; }

                /* Loading / Error */
                .lu-loading {
                    display: flex; align-items: center; justify-content: center;
                    gap: 12px; padding: 48px;
                    color: #6b87a8; font-size: 0.85rem;
                }
                .lu-spin {
                    width: 20px; height: 20px;
                    border: 2px solid #dce8f5;
                    border-top-color: #2c4f7c;
                    border-radius: 50%;
                    animation: luspin .7s linear infinite;
                }
                @keyframes luspin { to { transform: rotate(360deg); } }

                .lu-error {
                    display: flex; align-items: center; gap: 10px;
                    background: #fef2f2; border: 1.5px solid #fecaca;
                    border-radius: 12px; padding: 14px 18px;
                    color: #dc2626; font-size: 0.82rem; font-weight: 500;
                    margin-bottom: 20px;
                }

                /* CONFIRM MODAL */
                .lu-confirm-overlay {
                    position: fixed; inset: 0;
                    background: rgba(26,46,74,.45);
                    backdrop-filter: blur(3px);
                    z-index: 2000;
                    display: flex; align-items: center; justify-content: center;
                    padding: 20px;
                }
                .lu-confirm-box {
                    background: #fff;
                    border-radius: 16px;
                    padding: 32px 28px;
                    max-width: 380px;
                    width: 100%;
                    box-shadow: 0 20px 60px rgba(26,46,74,0.2);
                    border: 1.5px solid #dce8f5;
                    text-align: center;
                }
                .lu-confirm-icon {
                    width: 56px; height: 56px;
                    border-radius: 50%;
                    background: #fef2f2;
                    border: 2px solid #fee2e2;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.4rem; color: #dc2626;
                    margin: 0 auto 16px;
                }
                .lu-confirm-box h3 {
                    font-size: 1rem; font-weight: 700;
                    color: #1a2e4a; margin: 0 0 8px;
                }
                .lu-confirm-box p {
                    font-size: 0.8rem; color: #6b87a8; margin: 0 0 24px;
                    line-height: 1.5;
                }
                .lu-confirm-actions { display: flex; gap: 10px; justify-content: center; }
                .lu-btn-cancel {
                    flex: 1; padding: 10px;
                    border-radius: 9px;
                    border: 1.5px solid #dce8f5;
                    background: #f4f8fd;
                    color: #6b87a8;
                    font-family: 'Sora', sans-serif;
                    font-size: 0.8rem; font-weight: 600;
                    cursor: pointer; transition: all .15s;
                }
                .lu-btn-cancel:hover { background: #dce8f5; }
                .lu-btn-confirm-del {
                    flex: 1; padding: 10px;
                    border-radius: 9px;
                    border: none;
                    background: linear-gradient(135deg, #dc2626, #b91c1c);
                    color: #fff;
                    font-family: 'Sora', sans-serif;
                    font-size: 0.8rem; font-weight: 600;
                    cursor: pointer; transition: opacity .15s;
                    box-shadow: 0 4px 12px rgba(220,38,38,0.25);
                }
                .lu-btn-confirm-del:hover { opacity: .9; }

                /* RESPONSIVE */
                @media (max-width: 640px) {
                    .lu-page { padding: 16px; }
                    .lu-table thead th:nth-child(1),
                    .lu-table td:nth-child(1) { display: none; }
                    .lu-btn-edit span, .lu-btn-del span { display: none; }
                    .lu-btn-edit, .lu-btn-del { padding: 7px; }
                }
            `}</style>

            <div className="lu-page">

                {/* Header */}
                <div className="lu-header">
                    <div className="lu-header-left">
                        <h2><i className="bi bi-people" style={{marginRight: 8}}></i>Gestión de Usuarios</h2>
                        <p>Administra los usuarios y sus roles en el sistema</p>
                    </div>
                    <button className="lu-btn-new" onClick={handleCreate}>
                        <i className="bi bi-person-plus-fill"></i>
                        Nuevo Usuario
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="lu-error">
                        <i className="bi bi-exclamation-circle-fill"></i>
                        {error}
                    </div>
                )}

                {/* Stats */}
                {!loading && (
                    <div className="lu-stats">
                        <div className="lu-stat">
                            <div className="lu-stat-icon navy"><i className="bi bi-people-fill"></i></div>
                            <div>
                                <div className="lu-stat-val">{users.length}</div>
                                <div className="lu-stat-label">Total usuarios</div>
                            </div>
                        </div>
                        <div className="lu-stat">
                            <div className="lu-stat-icon blue"><i className="bi bi-person-check-fill"></i></div>
                            <div>
                                <div className="lu-stat-val">{users.filter(u => u.is_active !== false).length}</div>
                                <div className="lu-stat-label">Activos</div>
                            </div>
                        </div>
                        <div className="lu-stat">
                            <div className="lu-stat-icon light"><i className="bi bi-shield-fill"></i></div>
                            <div>
                                <div className="lu-stat-val">{[...new Set(users.map(u => u.role))].length}</div>
                                <div className="lu-stat-label">Roles distintos</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Toolbar */}
                <div className="lu-toolbar">
                    <div className="lu-search-wrap">
                        <i className="bi bi-search"></i>
                        <input
                            type="text"
                            placeholder="Buscar por nombre, usuario o email..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <span className="lu-count-badge">
                        {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Tabla */}
                <div className="lu-card">
                    {loading ? (
                        <div className="lu-loading">
                            <div className="lu-spin"></div>
                            Cargando usuarios...
                        </div>
                    ) : (
                        <table className="lu-table">
                            <thead>
                                <tr>
                                    <th><i className="bi bi-hash"></i></th>
                                    <th>Usuario</th>
                                    <th>Rol</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={4}>
                                            <div className="lu-empty">
                                                <i className="bi bi-person-x"></i>
                                                <p>{search ? 'No se encontraron resultados para tu búsqueda.' : 'No hay usuarios registrados.'}</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filtered.map(user => (
                                    <tr key={user.id}>
                                        <td style={{color:'#a0b4c8', fontWeight:600, fontSize:'0.75rem'}}>
                                            #{user.id}
                                        </td>
                                        <td>
                                            <div className="lu-user-cell">
                                                <div
                                                    className="lu-avatar"
                                                    style={{ background: getColor(user.id) }}
                                                >
                                                    {getInitials(user)}
                                                </div>
                                                <div>
                                                    <div className="lu-user-name">
                                                        {user.first_name || user.last_name
                                                            ? `${user.first_name} ${user.last_name}`.trim()
                                                            : user.username}
                                                    </div>
                                                    <div className="lu-user-email">
                                                        <i className="bi bi-envelope" style={{marginRight:4, fontSize:'0.65rem'}}></i>
                                                        {user.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="lu-role-badge">
                                                <i className="bi bi-shield-check"></i>
                                                {user.role_details ? user.role_details.description : `Rol ${user.role}`}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="lu-actions">
                                                <button className="lu-btn-edit" onClick={() => handleEdit(user)}>
                                                    <i className="bi bi-pencil"></i>
                                                    <span>Editar</span>
                                                </button>
                                                <button className="lu-btn-del" onClick={() => setDeleteConfirm(user.id)}>
                                                    <i className="bi bi-trash3"></i>
                                                    <span>Eliminar</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal confirmación eliminar */}
            {deleteConfirm && (
                <div className="lu-confirm-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="lu-confirm-box" onClick={e => e.stopPropagation()}>
                        <div className="lu-confirm-icon">
                            <i className="bi bi-trash3-fill"></i>
                        </div>
                        <h3>Eliminar usuario</h3>
                        <p>¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.</p>
                        <div className="lu-confirm-actions">
                            <button className="lu-btn-cancel" onClick={() => setDeleteConfirm(null)}>
                                Cancelar
                            </button>
                            <button className="lu-btn-confirm-del" onClick={() => handleDelete(deleteConfirm)}>
                                <i className="bi bi-trash3" style={{marginRight:6}}></i>
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