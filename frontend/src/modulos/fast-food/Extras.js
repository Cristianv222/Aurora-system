import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';

const Extras = () => {
    const [extras, setExtras] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [newExtra, setNewExtra] = useState({
        name: '',
        description: '',
        price: '',
        image: null
    });

    const fetchExtras = async () => {
        try {
            const response = await api.get('/api/menu/extras/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            setExtras(response.data.results || response.data || []);
        } catch (err) {
            console.error('Error fetching extras:', err);
            setError('Error al cargar los extras');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExtras();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewExtra(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        setNewExtra(prev => ({ ...prev, image: e.target.files[0] }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('name', newExtra.name);
        formData.append('description', newExtra.description);
        formData.append('price', newExtra.price);
        if (newExtra.image) {
            formData.append('image', newExtra.image);
        }

        try {
            await api.post('/api/menu/extras/', formData, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            setIsModalOpen(false);
            setNewExtra({ name: '', description: '', price: '', image: null });
            fetchExtras();
        } catch (err) {
            console.error('Error creating extra:', err);
            alert('Error al crear el extra. Verifique los datos.');
        }
    };

    if (loading) return <div>Cargando extras...</div>;
    if (error) return <div className="alert alert-error">{error}</div>;

    return (
        <div>
            <div className="page-header" style={{ marginTop: '1rem' }}>
                <h3>Gestión de Extras/Adicionales</h3>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    + Nuevo Extra
                </button>
            </div>

            <div className="table-responsive">
                <table className="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nombre</th>
                            <th>Descripción</th>
                            <th>Precio</th>
                        </tr>
                    </thead>
                    <tbody>
                        {extras.length === 0 ? (
                            <tr><td colSpan="4">No hay extras registrados</td></tr>
                        ) : (
                            extras.map(extra => (
                                <tr key={extra.id}>
                                    <td>{extra.id}</td>
                                    <td>{extra.name}</td>
                                    <td>{extra.description}</td>
                                    <td>${extra.price}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nuevo Extra">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nombre</label>
                        <input
                            type="text"
                            name="name"
                            value={newExtra.name}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Descripción</label>
                        <textarea
                            name="description"
                            value={newExtra.description}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label>Precio</label>
                        <input
                            type="number"
                            name="price"
                            value={newExtra.price}
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
                        />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-primary">Guardar</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Extras;
