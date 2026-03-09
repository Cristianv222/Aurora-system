import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';
import Categorias from './Categorias';
import Extras from './Extras';
import Combos from './Combos';
import Tamanos from './Tamanos';

const PRODUCTS_PER_PAGE = 10;

const Inventario = () => {
    const [activeTab, setActiveTab] = useState('products');

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterAvailable, setFilterAvailable] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);

    const [newProduct, setNewProduct] = useState({
        name: '', description: '', price: '', category: '',
        image: null, is_active: true, is_available: true
    });
    const [editingProduct, setEditingProduct] = useState(null);
    const [saving, setSaving] = useState(false);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/restaurant/menu/products/');
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
            const response = await api.get('/api/restaurant/menu/categories/');
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

    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterCategory, filterAvailable]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewProduct(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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
            image: null,
            is_active: product.is_active !== undefined ? product.is_active : true,
            is_available: product.is_available !== undefined ? product.is_available : true
        });
        setIsModalOpen(true);
    };

    const handleDeleteProduct = async (id) => {
        if (!window.confirm('¿Archivar este producto? Se desactivará para no afectar reportes históricos.')) return;
        try {
            const formData = new FormData();
            formData.append('is_active', 'false');
            formData.append('is_available', 'false');
            await api.patch(`/api/restaurant/menu/products/${id}/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            fetchProducts();
        } catch (err) {
            alert(`Error: ${err.response?.data?.detail || 'Error al eliminar el producto'}`);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        const formData = new FormData();
        formData.append('name', newProduct.name);
        formData.append('description', newProduct.description);
        formData.append('price', newProduct.price);
        formData.append('category', newProduct.category);
        formData.append('is_active', newProduct.is_active ? 'true' : 'false');
        formData.append('is_available', newProduct.is_available ? 'true' : 'false');
        if (newProduct.image instanceof File) formData.append('image', newProduct.image);
        if (!editingProduct) {
            const slug = newProduct.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
            formData.append('slug', slug);
        }
        try {
            if (editingProduct) {
                await api.patch(`/api/restaurant/menu/products/${editingProduct.id}/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } else {
                await api.post('/api/restaurant/menu/products/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            setIsModalOpen(false);
            setNewProduct({ name: '', description: '', price: '', category: '', image: null, is_active: true, is_available: true });
            setEditingProduct(null);
            fetchProducts();
        } catch (err) {
            alert(`Error: ${err.response?.data?.detail || err.response?.data?.name || 'Error al guardar el producto.'}`);
        } finally {
            setSaving(false);
        }
    };

    // Filtrado
    const filtered = products.filter(p => {
        const matchSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.category_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchCat = filterCategory === 'all' || String(p.category) === filterCategory;
        const matchAvail = filterAvailable === 'all' ||
            (filterAvailable === 'available' && p.is_available) ||
            (filterAvailable === 'unavailable' && !p.is_available);
        return matchSearch && matchCat && matchAvail;
    });

    const totalPages = Math.ceil(filtered.length / PRODUCTS_PER_PAGE);
    const paginated = filtered.slice((currentPage - 1) * PRODUCTS_PER_PAGE, currentPage * PRODUCTS_PER_PAGE);

    const availableCount = products.filter(p => p.is_available).length;
    const unavailableCount = products.filter(p => !p.is_available).length;

    const getPageNumbers = () => {
        const pages = [];
        const delta = 2;
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== '...') {
                pages.push('...');
            }
        }
        return pages;
    };

    const tabs = [
        { key: 'products', label: 'Productos', icon: 'bi-box-seam' },
        { key: 'categories', label: 'Categorías', icon: 'bi-tag' },
        { key: 'combos', label: 'Combos', icon: 'bi-collection' },
        { key: 'extras', label: 'Extras', icon: 'bi-plus-circle' },
        { key: 'sizes', label: 'Tamaños', icon: 'bi-rulers' },
    ];

    // ─── STYLES ──────────────────────────────────────────────────────────────
    const S = {
        page: {
            minHeight: '100vh',
            background: '#f0f4f9',
            padding: '28px 24px',
            fontFamily: "'Sora', sans-serif",
        },
        wrap: { maxWidth: '1280px', margin: '0 auto' },
        header: { marginBottom: '24px' },
        title: { fontSize: '26px', fontWeight: '700', color: '#1a2e4a', margin: '0 0 4px 0' },
        subtitle: { color: '#6b87a8', fontSize: '14px', margin: 0 },

        statsRow: { display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
        statCard: (color) => ({
            flex: '1 1 140px', background: '#fff',
            border: `1px solid #dce8f5`, borderLeft: `4px solid ${color}`,
            borderRadius: '10px', padding: '14px 18px',
        }),
        statLabel: { fontSize: '11px', color: '#6b87a8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 5px 0' },
        statValue: (color) => ({ fontSize: '22px', fontWeight: '700', color, margin: 0 }),

        tabsWrap: {
            display: 'flex', gap: '4px', marginBottom: '20px',
            background: '#fff', border: '1px solid #dce8f5', borderRadius: '12px',
            padding: '6px', overflowX: 'auto',
        },
        tab: (active) => ({
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '8px',
            border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
            whiteSpace: 'nowrap', transition: 'all 0.15s',
            background: active ? '#2c4f7c' : 'transparent',
            color: active ? '#fff' : '#6b87a8',
        }),

        toolbar: {
            background: '#fff', border: '1px solid #dce8f5', borderRadius: '12px',
            padding: '14px 18px', marginBottom: '16px',
            display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap',
        },
        searchWrap: { flex: 1, minWidth: '180px', position: 'relative' },
        searchIcon: {
            position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)',
            color: '#6b87a8', fontSize: '15px', pointerEvents: 'none',
        },
        searchInput: {
            width: '100%', padding: '8px 10px 8px 34px',
            border: '1px solid #dce8f5', borderRadius: '8px',
            outline: 'none', fontSize: '13px', color: '#1a2e4a',
            background: '#f8fbff', boxSizing: 'border-box',
        },
        filterSelect: {
            padding: '8px 12px', border: '1px solid #dce8f5', borderRadius: '8px',
            fontSize: '13px', color: '#3a6ea8', fontWeight: '600',
            background: '#f8fbff', outline: 'none', cursor: 'pointer',
        },
        newBtn: {
            padding: '8px 18px', background: '#2c4f7c', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            whiteSpace: 'nowrap',
        },

        tableWrap: { background: '#fff', border: '1px solid #dce8f5', borderRadius: '12px', overflow: 'hidden' },
        tableScroll: { overflowX: 'auto' },
        table: { width: '100%', borderCollapse: 'collapse', minWidth: '640px' },
        thead: { background: '#f0f4f9', borderBottom: '1px solid #dce8f5' },
        th: {
            padding: '12px 18px', textAlign: 'left',
            fontSize: '11px', fontWeight: '700', color: '#3a6ea8',
            textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
        },
        td: { padding: '13px 18px' },
        trHover: { borderBottom: '1px solid #f0f4f9', transition: 'background 0.15s' },
        productImg: { width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #dce8f5' },
        noImg: {
            width: '48px', height: '48px', borderRadius: '8px',
            background: '#f0f4f9', border: '1px solid #dce8f5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#c5d5e8', fontSize: '20px',
        },
        productName: { fontWeight: '600', color: '#1a2e4a', fontSize: '14px' },
        catBadge: {
            display: 'inline-block', padding: '2px 10px', borderRadius: '20px',
            fontSize: '12px', fontWeight: '600',
            background: '#eef4ff', color: '#2c4f7c', border: '1px solid #dce8f5',
        },
        price: { fontWeight: '700', color: '#1a7a4a', fontSize: '14px' },
        badgeYes: {
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
            background: '#e6f7ee', color: '#166534', border: '1px solid #bbf7d0',
        },
        badgeNo: {
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
            background: '#fff0f0', color: '#b91c1c', border: '1px solid #fca5a5',
        },
        editBtn: {
            padding: '5px 12px', background: '#f0f4f9', color: '#2c4f7c',
            border: '1px solid #dce8f5', borderRadius: '7px', cursor: 'pointer',
            fontSize: '12px', fontWeight: '600', marginRight: '6px',
            display: 'inline-flex', alignItems: 'center', gap: '4px',
        },
        deleteBtn: {
            padding: '5px 12px', background: '#fff0f0', color: '#b91c1c',
            border: '1px solid #fca5a5', borderRadius: '7px', cursor: 'pointer',
            fontSize: '12px', fontWeight: '600',
            display: 'inline-flex', alignItems: 'center', gap: '4px',
        },
        emptyCell: { padding: '48px 24px', textAlign: 'center', color: '#6b87a8' },

        pagination: {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', borderTop: '1px solid #f0f4f9', flexWrap: 'wrap', gap: '10px',
        },
        pageInfo: { fontSize: '13px', color: '#6b87a8' },
        pageButtons: { display: 'flex', gap: '5px', alignItems: 'center' },
        pageBtn: (active, disabled) => ({
            minWidth: '34px', height: '34px', borderRadius: '7px',
            border: active ? '1.5px solid #2c4f7c' : '1px solid #dce8f5',
            background: active ? '#2c4f7c' : disabled ? '#f8fbff' : '#fff',
            color: active ? '#fff' : disabled ? '#c5d5e8' : '#3a6ea8',
            fontWeight: '600', fontSize: '13px', cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }),

        formGroup: { marginBottom: '16px' },
        label: { display: 'block', marginBottom: '6px', fontWeight: '600', color: '#1a2e4a', fontSize: '13px' },
        input: {
            width: '100%', padding: '9px 12px', border: '1px solid #dce8f5',
            borderRadius: '8px', fontSize: '14px', color: '#1a2e4a',
            background: '#f8fbff', outline: 'none', boxSizing: 'border-box',
        },
        textarea: {
            width: '100%', padding: '9px 12px', border: '1px solid #dce8f5',
            borderRadius: '8px', fontSize: '14px', color: '#1a2e4a',
            background: '#f8fbff', outline: 'none', resize: 'vertical',
            minHeight: '80px', boxSizing: 'border-box', fontFamily: 'inherit',
        },
        select: {
            width: '100%', padding: '9px 12px', border: '1px solid #dce8f5',
            borderRadius: '8px', fontSize: '14px', color: '#1a2e4a',
            background: '#f8fbff', outline: 'none', cursor: 'pointer',
        },
        checkRow: { display: 'flex', alignItems: 'center', gap: '8px' },
        checkLabel: { fontWeight: '600', color: '#1a2e4a', fontSize: '14px', cursor: 'pointer' },
        formRow: { display: 'flex', gap: '12px' },
        formActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid #f0f4f9', paddingTop: '16px' },
        cancelBtn: {
            padding: '9px 18px', background: '#f0f4f9', color: '#3a6ea8',
            border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px',
        },
        saveBtn: (saving) => ({
            padding: '9px 20px', background: saving ? '#6b87a8' : '#2c4f7c', color: '#fff',
            border: 'none', borderRadius: '8px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
        }),
    };

    return (
        <div style={S.page}>
            <div style={S.wrap}>

                {/* Header */}
                <div style={S.header}>
                    <h1 style={S.title}>Inventario · Restaurante</h1>
                    <p style={S.subtitle}>Gestiona productos, categorías, combos, extras y tamaños</p>
                </div>

                {/* Tabs */}
                <div style={S.tabsWrap}>
                    {tabs.map(t => (
                        <button key={t.key} style={S.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
                            <i className={`bi ${t.icon}`} />
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Sub-módulos */}
                {activeTab === 'categories' && <Categorias />}
                {activeTab === 'extras' && <Extras />}
                {activeTab === 'combos' && <Combos />}
                {activeTab === 'sizes' && <Tamanos />}

                {/* Productos */}
                {activeTab === 'products' && (
                    <>
                        {/* Stats */}
                        {!loading && !error && (
                            <div style={S.statsRow}>
                                <div style={S.statCard('#3a6ea8')}>
                                    <p style={S.statLabel}>Total Productos</p>
                                    <p style={S.statValue('#1a2e4a')}>{products.length}</p>
                                </div>
                                <div style={S.statCard('#10b981')}>
                                    <p style={S.statLabel}>Disponibles</p>
                                    <p style={S.statValue('#166534')}>{availableCount}</p>
                                </div>
                                <div style={S.statCard('#ef4444')}>
                                    <p style={S.statLabel}>No Disponibles</p>
                                    <p style={S.statValue('#b91c1c')}>{unavailableCount}</p>
                                </div>
                                <div style={S.statCard('#f59e0b')}>
                                    <p style={S.statLabel}>Categorías</p>
                                    <p style={S.statValue('#b45309')}>{categories.length}</p>
                                </div>
                            </div>
                        )}

                        {/* Toolbar */}
                        <div style={S.toolbar}>
                            <div style={S.searchWrap}>
                                <i className="bi bi-search" style={S.searchIcon} />
                                <input
                                    type="text"
                                    placeholder="Buscar producto o categoría..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={S.searchInput}
                                    onFocus={(e) => e.target.style.borderColor = '#3a6ea8'}
                                    onBlur={(e) => e.target.style.borderColor = '#dce8f5'}
                                />
                            </div>
                            <select style={S.filterSelect} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                                <option value="all">Todas las categorías</option>
                                {categories.map(c => (
                                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                                ))}
                            </select>
                            <select style={S.filterSelect} value={filterAvailable} onChange={(e) => setFilterAvailable(e.target.value)}>
                                <option value="all">Disponibilidad</option>
                                <option value="available">Disponibles</option>
                                <option value="unavailable">No disponibles</option>
                            </select>
                            <button style={S.newBtn} onClick={() => {
                                setEditingProduct(null);
                                setNewProduct({ name: '', description: '', price: '', category: '', image: null, is_active: true, is_available: true });
                                setIsModalOpen(true);
                            }}>
                                <i className="bi bi-plus-lg" /> Nuevo Producto
                            </button>
                        </div>

                        {/* Table */}
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '60px', color: '#6b87a8' }}>
                                <div style={{
                                    width: '40px', height: '40px', margin: '0 auto 14px',
                                    border: '4px solid #dce8f5', borderTopColor: '#3a6ea8',
                                    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                                }} />
                                Cargando inventario...
                            </div>
                        ) : error ? (
                            <div style={{ background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: '10px', padding: '16px', color: '#b91c1c', fontWeight: '600' }}>
                                {error}
                            </div>
                        ) : (
                            <div style={S.tableWrap}>
                                <div style={S.tableScroll}>
                                    <table style={S.table}>
                                        <thead style={S.thead}>
                                            <tr>
                                                {['Imagen', 'Nombre', 'Categoría', 'Precio', 'Disponible', 'Acciones'].map(h => (
                                                    <th key={h} style={S.th}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginated.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" style={S.emptyCell}>
                                                        <i className="bi bi-box-seam" style={{ fontSize: '28px', display: 'block', marginBottom: '8px', color: '#c5d5e8' }} />
                                                        {searchTerm ? 'No se encontraron productos' : 'No hay productos registrados'}
                                                    </td>
                                                </tr>
                                            ) : paginated.map(product => (
                                                <tr
                                                    key={product.id}
                                                    style={S.trHover}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fbff'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <td style={S.td}>
                                                        {product.image ? (
                                                            <img
                                                                src={product.image.startsWith('http') ? product.image : `${process.env.REACT_APP_RESTAURANT_SERVICE}${product.image}`}
                                                                alt={product.name}
                                                                style={S.productImg}
                                                            />
                                                        ) : (
                                                            <div style={S.noImg}>
                                                                <i className="bi bi-image" />
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={S.td}>
                                                        <span style={S.productName}>{product.name}</span>
                                                    </td>
                                                    <td style={S.td}>
                                                        <span style={S.catBadge}>{product.category_name || product.category}</span>
                                                    </td>
                                                    <td style={S.td}>
                                                        <span style={S.price}>${product.price}</span>
                                                    </td>
                                                    <td style={S.td}>
                                                        {product.is_available
                                                            ? <span style={S.badgeYes}><i className="bi bi-check-circle-fill" /> Sí</span>
                                                            : <span style={S.badgeNo}><i className="bi bi-x-circle-fill" /> No</span>
                                                        }
                                                    </td>
                                                    <td style={S.td}>
                                                        <button style={S.editBtn} onClick={() => handleEditProduct(product)}>
                                                            <i className="bi bi-pencil" /> Editar
                                                        </button>
                                                        <button style={S.deleteBtn} onClick={() => handleDeleteProduct(product.id)}>
                                                            <i className="bi bi-archive" /> Archivar
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Paginación */}
                                {totalPages > 1 && (
                                    <div style={S.pagination}>
                                        <span style={S.pageInfo}>
                                            Mostrando {Math.min((currentPage - 1) * PRODUCTS_PER_PAGE + 1, filtered.length)}–{Math.min(currentPage * PRODUCTS_PER_PAGE, filtered.length)} de {filtered.length} productos
                                        </span>
                                        <div style={S.pageButtons}>
                                            <button
                                                style={S.pageBtn(false, currentPage === 1)}
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                <i className="bi bi-chevron-left" />
                                            </button>
                                            {getPageNumbers().map((page, idx) =>
                                                page === '...'
                                                    ? <span key={idx} style={{ padding: '0 4px', color: '#6b87a8' }}>…</span>
                                                    : <button
                                                        key={idx}
                                                        style={S.pageBtn(currentPage === page, false)}
                                                        onClick={() => setCurrentPage(page)}
                                                    >
                                                        {page}
                                                    </button>
                                            )}
                                            <button
                                                style={S.pageBtn(false, currentPage === totalPages)}
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                            >
                                                <i className="bi bi-chevron-right" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {totalPages <= 1 && filtered.length > 0 && (
                                    <div style={{ padding: '12px 18px', borderTop: '1px solid #f0f4f9' }}>
                                        <span style={S.pageInfo}>{filtered.length} productos en total</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Modal */}
                        <Modal
                            isOpen={isModalOpen}
                            onClose={() => setIsModalOpen(false)}
                            title={editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                        >
                            <form onSubmit={handleSubmit}>
                                <div style={S.formGroup}>
                                    <label style={S.label}>Nombre *</label>
                                    <input style={S.input} type="text" name="name" value={newProduct.name} onChange={handleInputChange} required
                                        onFocus={(e) => e.target.style.borderColor = '#3a6ea8'}
                                        onBlur={(e) => e.target.style.borderColor = '#dce8f5'} />
                                </div>
                                <div style={S.formGroup}>
                                    <label style={S.label}>Descripción *</label>
                                    <textarea style={S.textarea} name="description" value={newProduct.description} onChange={handleInputChange} required
                                        onFocus={(e) => e.target.style.borderColor = '#3a6ea8'}
                                        onBlur={(e) => e.target.style.borderColor = '#dce8f5'} />
                                </div>
                                <div style={{ ...S.formGroup, ...S.formRow }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={S.label}>Precio *</label>
                                        <input style={S.input} type="number" name="price" value={newProduct.price} onChange={handleInputChange} step="0.01" required
                                            onFocus={(e) => e.target.style.borderColor = '#3a6ea8'}
                                            onBlur={(e) => e.target.style.borderColor = '#dce8f5'} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={S.label}>Categoría *</label>
                                        <select style={S.select} name="category" value={newProduct.category} onChange={handleInputChange} required>
                                            <option value="">Seleccionar...</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ ...S.formGroup, display: 'flex', gap: '24px' }}>
                                    <label style={S.checkRow}>
                                        <input type="checkbox" name="is_active" checked={newProduct.is_active} onChange={handleInputChange} />
                                        <span style={S.checkLabel}>Activo</span>
                                    </label>
                                    <label style={S.checkRow}>
                                        <input type="checkbox" name="is_available" checked={newProduct.is_available} onChange={handleInputChange} />
                                        <span style={S.checkLabel}>Disponible</span>
                                    </label>
                                </div>
                                <div style={S.formGroup}>
                                    <label style={S.label}>Imagen {!editingProduct && '*'}</label>
                                    <input style={{ ...S.input, padding: '7px 12px' }} type="file" accept="image/*" onChange={handleImageChange} required={!editingProduct} />
                                    {editingProduct && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b87a8' }}>Deja vacío para mantener la imagen actual</p>}
                                </div>
                                <div style={S.formActions}>
                                    <button type="button" style={S.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancelar</button>
                                    <button type="submit" style={S.saveBtn(saving)} disabled={saving}>
                                        {saving ? <><i className="bi bi-hourglass-split" /> Guardando...</> : <><i className="bi bi-check-lg" /> Guardar</>}
                                    </button>
                                </div>
                            </form>
                        </Modal>
                    </>
                )}
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
            `}</style>
        </div>
    );
};

export default Inventario;