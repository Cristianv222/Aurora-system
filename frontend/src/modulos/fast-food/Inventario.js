import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';
import Categorias from './Categorias';
import Extras from './Extras';
import Combos from './Combos';
import Tamanos from './Tamanos';

const Inventario = () => {
    const [activeTab, setActiveTab] = useState('products'); // products, categories, extras, combos, sizes

    // Estado para Productos
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Estado del formulario de producto
    const [newProduct, setNewProduct] = useState({
        name: '',
        description: '',
        price: '',
        category: '',
        image: null
    });
    const [editingProduct, setEditingProduct] = useState(null);

    const fetchProducts = async () => {
        try {
            const response = await api.get('/api/menu/products/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            setProducts(response.data.results || response.data || []);
        } catch (err) {
            console.error('Error fetching products:', err);
            setError('Error al cargar el inventario');
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await api.get('/api/menu/categories/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            setCategories(response.data.results || response.data || []);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };

    useEffect(() => {
        if (activeTab === 'products') {
            fetchProducts();
            fetchCategories();
        }
    }, [activeTab]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewProduct(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        setNewProduct(prev => ({ ...prev, image: e.target.files[0] }));
    };

    const handleEditProduct = (product) => {
        setEditingProduct(product);
        setNewProduct({
            name: product.name,
            description: product.description,
            price: product.price,
            category: product.category,
            image: null // Reset image input, keep existing if not changed
        });
        setIsModalOpen(true);
    };

    const handleDeleteProduct = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este producto?')) {
            try {
                await api.delete(`/api/menu/products/${id}/`, {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
                });
                fetchProducts();
            } catch (err) {
                console.error('Error deleting product:', err);
                alert('Error al eliminar el producto');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const slug = newProduct.name.toLowerCase()
            .replace(/ /g, '-')
            .replace(/[^\w-]+/g, '');

        const formData = new FormData();
        formData.append('name', newProduct.name);
        formData.append('slug', slug);
        formData.append('description', newProduct.description);
        formData.append('price', newProduct.price);
        formData.append('category', newProduct.category);
        if (newProduct.image instanceof File) {
            formData.append('image', newProduct.image);
        }

        try {
            if (editingProduct) {
                await api.patch(`/api/menu/products/${editingProduct.id}/`, formData, {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE,
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } else {
                await api.post('/api/menu/products/', formData, {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE,
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            setIsModalOpen(false);
            setNewProduct({ name: '', description: '', price: '', category: '', image: null });
            setEditingProduct(null);
            fetchProducts();
        } catch (err) {
            console.error('Error saving product:', err);
            alert('Error al guardar el producto. Verifique los datos.');
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h2>Inventario (Menú)</h2>
            </div>

            {/* Tabs de Navegación */}
            <div className="tabs" style={{ marginBottom: '20px', borderBottom: '1px solid #ddd', display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
                <button
                    className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('products')}
                >
                    🍔 Productos
                </button>
                <button
                    className={`btn ${activeTab === 'categories' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('categories')}
                >
                    📂 Categorías
                </button>
                <button
                    className={`btn ${activeTab === 'combos' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('combos')}
                >
                    🍟 Combos
                </button>
                <button
                    className={`btn ${activeTab === 'extras' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('extras')}
                >
                    🧀 Extras
                </button>
                <button
                    className={`btn ${activeTab === 'sizes' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('sizes')}
                >
                    📏 Tamaños
                </button>
            </div >

            {/* Contenido de Pestañas */}
            {activeTab === 'categories' && <Categorias />}
            {activeTab === 'extras' && <Extras />}
            {activeTab === 'combos' && <Combos />}
            {activeTab === 'sizes' && <Tamanos />}

            {/* Contenido de Productos */}
            {
                activeTab === 'products' && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                            <button className="btn btn-primary" onClick={() => {
                                setEditingProduct(null);
                                setNewProduct({ name: '', description: '', price: '', category: '', image: null });
                                setIsModalOpen(true);
                            }}>
                                + Nuevo Producto
                            </button>
                        </div>

                        {loading ? <div>Cargando inventario...</div> : error ? <div className="alert alert-error">{error}</div> : (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Imagen</th>
                                            <th>Nombre</th>
                                            <th>Categoría</th>
                                            <th>Precio</th>
                                            <th>Disponible</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.length === 0 ? (
                                            <tr><td colSpan="5">No hay productos registrados</td></tr>
                                        ) : (
                                            products.map(product => (
                                                <tr key={product.id}>
                                                    <td>
                                                        {product.image ? (
                                                            <img
                                                                src={product.image.startsWith('http') ? product.image : `${process.env.REACT_APP_FAST_FOOD_SERVICE}${product.image}`}
                                                                alt={product.name}
                                                                style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '5px' }}
                                                            />
                                                        ) : (
                                                            <span style={{ color: '#888' }}>Sin imagen</span>
                                                        )}
                                                    </td>
                                                    <td>{product.name}</td>
                                                    <td>{product.category_name || product.category}</td>
                                                    <td>${product.price}</td>
                                                    <td>{product.is_available ? 'Sí' : 'No'}</td>
                                                    <td>
                                                        <button
                                                            className="btn btn-sm btn-outline"
                                                            onClick={() => handleEditProduct(product)}
                                                            style={{ marginRight: '5px' }}
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-danger"
                                                            onClick={() => handleDeleteProduct(product.id)}
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
                        )}


                        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProduct ? "Editar Producto" : "Nuevo Producto"}>
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label>Nombre</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={newProduct.name}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Descripción</label>
                                    <textarea
                                        name="description"
                                        value={newProduct.description}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Precio</label>
                                    <input
                                        type="number"
                                        name="price"
                                        value={newProduct.price}
                                        onChange={handleInputChange}
                                        step="0.01"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Categoría</label>
                                    <select
                                        name="category"
                                        value={newProduct.category}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        <option value="">Seleccione una categoría</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Imagen</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        required={!editingProduct}
                                    />
                                </div>
                                <div className="form-actions">
                                    <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                                    <button type="submit" className="btn btn-primary">Guardar</button>
                                </div>
                            </form>
                        </Modal>
                    </>
                )
            }
        </div >
    );
};

export default Inventario;
