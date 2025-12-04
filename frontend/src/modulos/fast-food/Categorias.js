import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';

const Categorias = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Estado del formulario
    const [newCategory, setNewCategory] = useState({
        name: '',
        description: '',
        image: null
    });

    const fetchCategories = async () => {
        try {
            const response = await api.get('/api/menu/categories/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            setCategories(response.data.results || response.data || []);
        } catch (err) {
            console.error('Error fetching categories:', err);
            setError('Error al cargar las categorías');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewCategory(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        setNewCategory(prev => ({ ...prev, image: e.target.files[0] }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Generar slug simple
        const slug = newCategory.name.toLowerCase()
            .replace(/ /g, '-')
            .replace(/[^\w-]+/g, '');

        const formData = new FormData();
        formData.append('name', newCategory.name);
        formData.append('slug', slug);
        formData.append('description', newCategory.description);
        if (newCategory.image) {
            formData.append('image', newCategory.image);
        }

        try {
            await api.post('/api/menu/categories/', formData, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            setIsModalOpen(false);
            setNewCategory({ name: '', description: '', image: null });
            fetchCategories(); // Recargar lista
        } catch (err) {
            console.error('Error creating category:', err);
            alert('Error al crear la categoría. Verifique los datos.');
        }
    };

    if (loading) return <div>Cargando categorías...</div>;
    if (error) return <div className="alert alert-error">{error}</div>;

    return (
        <div>
            <div className="page-header" style={{ marginTop: '1rem' }}>
                <h3>Gestión de Categorías</h3>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    + Nueva Categoría
                </button>
            </div>

            <div className="table-responsive">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Imagen</th>
                            <th>Nombre</th>
                            <th>Descripción</th>
                            <th>Productos Activos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.length === 0 ? (
                            <tr><td colSpan="4">No hay categorías registradas</td></tr>
                        ) : (
                            categories.map(cat => (
                                <tr key={cat.id}>
                                    <td>
                                        {cat.image ? (
                                            <img
                                                src={cat.image.startsWith('http') ? cat.image : `${process.env.REACT_APP_FAST_FOOD_SERVICE}${cat.image}`}
                                                alt={cat.name}
                                                style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '5px' }}
                                            />
                                        ) : (
                                            <span style={{ color: '#888' }}>Sin imagen</span>
                                        )}
                                    </td>
                                    <td>{cat.name}</td>
                                    <td>{cat.description}</td>
                                    <td>{cat.products_count || 0}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nueva Categoría">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nombre</label>
                        <input
                            type="text"
                            name="name"
                            value={newCategory.name}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Descripción</label>
                        <textarea
                            name="description"
                            value={newCategory.description}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label>Imagen</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
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

export default Categorias;
