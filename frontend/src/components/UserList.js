import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const UserList = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
                console.error('Formato de respuesta inesperado:', response.data);
                // Fallback para evitar crash
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

    if (loading) return <div>Cargando...</div>;
    if (error) return <div className="alert alert-error">{error}</div>;

    return (
        <div className="page-container">
            <div className="page-header">
                <h2>Gestión de Usuarios</h2>
                <Link to="/users/new" className="btn btn-primary">
                    Nuevo Usuario
                </Link>
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
                                <td>{user.role}</td>
                                <td>
                                    <Link to={`/users/${user.id}/edit`} className="btn btn-sm btn-secondary">
                                        Editar
                                    </Link>
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
        </div>
    );
};

export default UserList;
