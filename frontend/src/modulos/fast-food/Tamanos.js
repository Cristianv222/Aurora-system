import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';

const Tamanos = () => {
    const [sizes, setSizes] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [newSize, setNewSize] = useState({
        product: '',
        name: '',
        price_adjustment: 0,
        is_default: false
    });

    const fetchSizes = async () => {
        try {
            const response = await api.get('/api/menu/sizes/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            setSizes(response.data.results || response.data || []);
        } catch (err) {
            console.error('Error fetching sizes:', err);
            setError('Error al cargar los tamaños');
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const response = await api.get('/api/menu/products/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            setProducts(response.data.results || response.data || []);
        } catch (err) {
            console.error('Error fetching products:', err);
        }
    };

    useEffect(() => {
        fetchSizes();
        fetchProducts();
    }, []);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewSize(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            await api.post('/api/menu/sizes/', newSize, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            setIsModalOpen(false);
            setNewSize({ product: '', name: '', price_adjustment: 0, is_default: false });
            fetchSizes();
        } catch (err) {
            console.error('Error creating size:', err);
            alert('Error al crear el tamaño. Verifique los datos.');
        }
    };

    if (loading) return <div>Cargando tamaños...</div>;
    if (error) return <div className="alert alert-error">{error}</div>;

    return (
        <div>
            <div className="page-header" style={{ marginTop: '1rem' }}>
                <h3>Gestión de Tamaños</h3>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    + Nuevo Tamaño
                </button>
            </div>

            <div className="table-responsive">
                <table className="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Producto</th>
                            <th>Nombre</th>
                            <th>Ajuste de Precio</th>
                            <th>Por Defecto</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sizes.length === 0 ? (
                            <tr><td colSpan="5">No hay tamaños registrados</td></tr>
                        ) : (
                            sizes.map(size => (
                                <tr key={size.id}>
                                    <td>{size.id}</td>
                                    <td>{size.product_name || (products.find(p => p.id === size.product)?.name) || size.product}</td>
                                    <td>{size.name}</td>
                                    <td>${size.price_adjustment}</td>
                                    <td>{size.is_default ? 'Sí' : 'No'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nuevo Tamaño">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Producto</label>
                        <select
                            name="product"
                            value={newSize.product}
                            onChange={handleInputChange}
                            required
                        >
                            <option value="">Seleccione un producto</option>
                            {products.map(prod => (
                                <option key={prod.id} value={prod.id}>{prod.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Nombre (ej: Grande, Mediano)</label>
                        <input
                            type="text"
                            name="name"
                            value={newSize.name}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Ajuste de Precio (Adicional al base)</label>
                        <input
                            type="number"
                            name="price_adjustment"
                            value={newSize.price_adjustment}
                            onChange={handleInputChange}
                            step="0.01"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>
                            <input
                                type="checkbox"
                                name="is_default"
                                checked={newSize.is_default}
                                onChange={handleInputChange}
                            />
                            {' '}Es el tamaño por defecto
                        </label>
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

export default Tamanos;
