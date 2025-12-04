import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';

const Combos = () => {
    const [combos, setCombos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [newCombo, setNewCombo] = useState({
        name: '',
        description: '',
        price: '',
        image: null
    });
    const [editingCombo, setEditingCombo] = useState(null);

    const fetchCombos = async () => {
        try {
            const response = await api.get('/api/menu/combos/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            setCombos(response.data.results || response.data || []);
        } catch (err) {
            console.error('Error fetching combos:', err);
            setError('Error al cargar los combos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCombos();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewCombo(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        setNewCombo(prev => ({ ...prev, image: e.target.files[0] }));
    };

    const handleEditCombo = (combo) => {
        setEditingCombo(combo);
        setNewCombo({
            name: combo.name,
            description: combo.description,
            price: combo.price,
            image: null // Reset image input
        });
        setIsModalOpen(true);
    };

    const handleDeleteCombo = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este combo?')) {
            try {
                await api.delete(`/api/menu/combos/${id}/`, {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
                });
                fetchCombos();
            } catch (err) {
                console.error('Error deleting combo:', err);
                alert('Error al eliminar el combo');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const slug = newCombo.name.toLowerCase()
            .replace(/ /g, '-')
            .replace(/[^\w-]+/g, '');

        const formData = new FormData();
        formData.append('name', newCombo.name);
        formData.append('slug', slug);
        formData.append('description', newCombo.description);
        formData.append('price', newCombo.price);
        if (newCombo.image instanceof File) {
            formData.append('image', newCombo.image);
        }

        try {
            if (editingCombo) {
                await api.patch(`/api/menu/combos/${editingCombo.id}/`, formData, {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE,
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } else {
                await api.post('/api/menu/combos/', formData, {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE,
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            setIsModalOpen(false);
            setNewCombo({ name: '', description: '', price: '', image: null });
            setEditingCombo(null);
            fetchCombos();
        } catch (err) {
            console.error('Error saving combo:', err);
            alert('Error al guardar el combo. Verifique los datos.');
        }
    };

    if (loading) return <div>Cargando combos...</div>;
    if (error) return <div className="alert alert-error">{error}</div>;

    return (
        <div>
            <div className="page-header" style={{ marginTop: '1rem' }}>
                <h3>Gestión de Combos</h3>
                <button className="btn btn-primary" onClick={() => {
                    setEditingCombo(null);
                    setNewCombo({ name: '', description: '', price: '', image: null });
                    setIsModalOpen(true);
                }}>
                    + Nuevo Combo
                </button>
            </div>

            <div className="table-responsive">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Imagen</th>
                            <th>Nombre</th>
                            <th>Descripción</th>
                            <th>Precio</th>
                            <th>Productos</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {combos.length === 0 ? (
                            <tr><td colSpan="5">No hay combos registrados</td></tr>
                        ) : (
                            combos.map(combo => (
                                <tr key={combo.id}>
                                    <td>
                                        {combo.image ? (
                                            <img
                                                src={combo.image.startsWith('http') ? combo.image : `${process.env.REACT_APP_FAST_FOOD_SERVICE}${combo.image}`}
                                                alt={combo.name}
                                                style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '5px' }}
                                            />
                                        ) : (
                                            <span style={{ color: '#888' }}>Sin imagen</span>
                                        )}
                                    </td>
                                    <td>{combo.name}</td>
                                    <td>{combo.description}</td>
                                    <td>${combo.price}</td>
                                    <td>{combo.products_count || 0}</td>
                                    <td>
                                        <button
                                            className="btn btn-sm btn-outline"
                                            onClick={() => handleEditCombo(combo)}
                                            style={{ marginRight: '5px' }}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="btn btn-sm btn-danger"
                                            onClick={() => handleDeleteCombo(combo.id)}
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCombo ? "Editar Combo" : "Nuevo Combo"}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nombre</label>
                        <input
                            type="text"
                            name="name"
                            value={newCombo.name}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Descripción</label>
                        <textarea
                            name="description"
                            value={newCombo.description}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Precio</label>
                        <input
                            type="number"
                            name="price"
                            value={newCombo.price}
                            onChange={handleInputChange}
                            step="0.01"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Imagen</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            required={!editingCombo}
                        />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-primary">Guardar</button>
                    </div>
                </form>
            </Modal>
        </div >
    );
};

export default Combos;
