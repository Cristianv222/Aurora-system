import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';
import FormularioUsuario from './FormularioUsuario';

const ListaUsuarios = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Estado para el Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await api.get('/api/users/');
            console.log('API Response:', response.data);

            let userData = [];
            if (response.data.results && Array.isArray(response.data.results)) {
                userData = response.data.results;
            } else if (Array.isArray(response.data)) {
                userData = response.data;
            } else {
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

    const handleDelete = async (id) => {
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

    const handleCreate = () => {
        setCurrentUser(null);
        setIsModalOpen(true);
    };

    const handleEdit = (user) => {
        setCurrentUser(user);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentUser(null);
    };

    const handleSave = () => {
        handleCloseModal();
        fetchUsers(); // Recargar lista
    };

    if (loading) return <div>Cargando...</div>;
    if (error) return <div className="alert alert-error">{error}</div>;

    return (
        <div className="page-container">
            <div className="page-header">
                <h2>Gestión de Usuarios</h2>
                <button onClick={handleCreate} className="btn btn-primary">
                    Nuevo Usuario
                </button>
            </div>

            <div className="table-responsive">
                <table className="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Usuario</th>
                            <th>Email</th>
                            <th>Nombre</th>
                            <th>Rol</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.isArray(users) && users.map(user => (
                            <tr key={user.id}>
                                <td>{user.id}</td>
                                <td>{user.username}</td>
                                <td>{user.email}</td>
                                <td>{`${user.first_name} ${user.last_name}`}</td>
                                <td>{user.role_details ? user.role_details.description : `ID: ${user.role}`}</td>
                                <td>
                                    <button
                                        onClick={() => handleEdit(user)}
                                        className="btn btn-sm btn-secondary"
                                    >
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => handleDelete(user.id)}
                                        className="btn btn-sm btn-danger"
                                        style={{ marginLeft: '5px' }}
                                    >
                                        Eliminar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={currentUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            >
                <FormularioUsuario
                    userToEdit={currentUser}
                    onSave={handleSave}
                    onCancel={handleCloseModal}
                />
            </Modal>
        </div>
    );
};

export default ListaUsuarios;
