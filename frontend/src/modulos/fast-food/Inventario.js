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
        image: null,
        is_active: true,
        is_available: true
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
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;
        setNewProduct(prev => ({ ...prev, [name]: newValue }));
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
            image: null, // Reset image input, keep existing if not changed
            is_active: product.is_active !== undefined ? product.is_active : true,
            is_available: product.is_available !== undefined ? product.is_available : true
        });
        setIsModalOpen(true);
    };

    const handleDeleteProduct = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este producto? (Se archivará para no afectar reportes históricos)')) {
            try {
                // "Soft Delete": Desactivar en lugar de borrar físicamente para mantener integridad referencial
                const formData = new FormData();
                formData.append('is_active', 'false');
                formData.append('is_available', 'false');

                // Backend usa lookup_field = 'pk' (UUID), así que usamos el ID.
                await api.patch(`/api/menu/products/${id}/`, formData, {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE,
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                fetchProducts();
            } catch (err) {
                console.error('Error deleting product:', err);
                const msg = err.response?.data?.detail || 'Error al eliminar el producto';
                alert(`Error: ${msg}`);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('name', newProduct.name);
        formData.append('description', newProduct.description);
        formData.append('price', newProduct.price);
        formData.append('category', newProduct.category);
        formData.append('is_active', newProduct.is_active ? 'true' : 'false');
        formData.append('is_available', newProduct.is_available ? 'true' : 'false');
        if (newProduct.image instanceof File) {
            formData.append('image', newProduct.image);
        }

        // Solo generar SLUG si es un producto nuevo.
        if (!editingProduct) {
            const slug = newProduct.name.toLowerCase()
                .replace(/ /g, '-')
                .replace(/[^\w-]+/g, '');
            formData.append('slug', slug);
        }

        try {
            if (editingProduct) {
                // Usar ID para el PATCH ya que el backend espera PK
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
            setNewProduct({ name: '', description: '', price: '', category: '', image: null, is_active: true, is_available: true });
            setEditingProduct(null);
            fetchProducts();
        } catch (err) {
            console.error('Error saving product:', err);
            const msg = err.response?.data?.detail || err.response?.data?.name || 'Error al guardar el producto. Verifique los datos.';
            alert(`Error: ${msg}`);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h2>Inventario (Menú)</h2>
            </div>

            {/* Tabs de Navegación */}
            <div className="tabs" style={{ marginBottom: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
                <button
                    className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('products')}
                >
                    Productos
                </button>
                <button
                    className={`btn ${activeTab === 'categories' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('categories')}
                >
                    Categorías
                </button>
                <button
                    className={`btn ${activeTab === 'combos' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('combos')}
                >
                    Combos
                </button>
                <button
                    className={`btn ${activeTab === 'extras' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('extras')}
                >
                    Extras
                </button>
                <button
                    className={`btn ${activeTab === 'sizes' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('sizes')}
                >
                    Tamaños
                </button>
            </div>

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
                                Nuevo Producto
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
                                                            className="btn btn-secondary"
                                                            onClick={() => handleEditProduct(product)}
                                                            style={{ marginRight: '5px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                                        >
                                                            Editar
                                                        </button>
                                                        <button
                                                            className="btn btn-danger"
                                                            onClick={() => handleDeleteProduct(product.id)}
                                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                                        >
                                                            Eliminar
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
                                        className="form-control"
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
                                    <label>
                                        <input
                                            type="checkbox"
                                            name="is_active"
                                            checked={newProduct.is_active}
                                            onChange={handleInputChange}
                                            style={{ marginRight: '8px' }}
                                        />
                                        Activo
                                    </label>
                                </div>
                                <div className="form-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            name="is_available"
                                            checked={newProduct.is_available}
                                            onChange={handleInputChange}
                                            style={{ marginRight: '8px' }}
                                        />
                                        Disponible
                                    </label>
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

const styles = `
    .page-container {
        padding: 20px;
        max-width: 1600px;
        margin: 0 auto;
    }
    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    .page-header h2 {
        margin: 0;
        color: #1f2937;
    }
    
    /* Tabs */
    .tabs {
        display: flex;
        gap: 10px;
        border-bottom: 1px solid #e2e8f0;
        margin-bottom: 20px;
        overflow-x: auto;
        padding-bottom: 5px;
        white-space: nowrap;
        -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
    }
    .tabs::-webkit-scrollbar {
        height: 4px;
    }
    .tabs::-webkit-scrollbar-thumb {
        background-color: #ccc;
        border-radius: 4px;
    }

    .btn {
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid transparent;
    }
    .btn-primary {
        background-color: #3b82f6;
        color: white;
        border-color: #3b82f6;
    }
    .btn-primary:hover {
        background-color: #2563eb;
    }
    .btn-secondary {
        background-color: #f3f4f6;
        color: #374151;
        border-color: #d1d5db;
    }
    .btn-secondary:hover {
        background-color: #e5e7eb;
    }
    .btn-danger {
        background-color: #fee2e2;
        color: #dc2626;
        border-color: #fca5a5;
    }
    .btn-danger:hover {
        background-color: #fecaca;
    }

    /* Table */
    .table-responsive {
        width: 100%;
        overflow-x: auto;
        overflow-y: auto; /* Scroll vertical */
        max-height: 70vh; /* Altura máxima para permitir scroll */
        -webkit-overflow-scrolling: touch;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        border: 1px solid #e5e7eb;
        position: relative; /* Para sticky header */
    }
    .table {
        width: 100%;
        border-collapse: collapse;
        background-color: white;
        min-width: 600px; 
    }
    .table th, .table td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
    }
    .table th {
        background-color: #f9fafb;
        font-weight: 600;
        color: #374151;
        font-size: 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        position: sticky; /* Header fijo */
        top: 0;
        z-index: 10;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .table td {
        font-size: 0.875rem;
        color: #4b5563;
    }
    .table tr:last-child td {
        border-bottom: none;
    }

    /* Form */
    .form-group {
        margin-bottom: 1rem;
    }
    .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: #374151;
    }
    .form-control, input[type="text"], input[type="number"], textarea, select {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-size: 1rem;
    }
    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
        margin-top: 1.5rem;
    }

    /* Alerts */
    .alert {
        padding: 1rem;
        margin-bottom: 1rem;
        border-radius: 0.375rem;
    }
    .alert-error {
        background-color: #fee2e2;
        color: #991b1b;
        border: 1px solid #fecaca;
    }

    /* Responsive Media Queries */
    @media (max-width: 768px) {
        .page-container {
            padding: 10px;
        }
        .page-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
        }
        .page-header h2 {
            font-size: 1.5rem;
        }
        .tabs {
            padding-bottom: 10px;
        }
        .btn {
            padding: 0.4rem 0.8rem;
            font-size: 0.9rem;
        }
    }
`;

// Inject styles
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

