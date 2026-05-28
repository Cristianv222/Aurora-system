import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';
import Categorias from './Categorias';
import Extras from './Extras';
import Combos from './Combos';
import Tamanos from './Tamanos';
import { getCleanImageUrl } from '../../utils/image';
import { Product as BaseProduct, Category } from '../../types';

const PRODUCTS_PER_PAGE = 10;

interface Product extends Omit<BaseProduct, 'price' | 'category'> {
    price: string | number;
    category: string | number;
    category_name?: string;
    is_active?: boolean;
}

interface NewProductInput {
    name: string;
    description: string;
    price: string;
    category: string;
    image: File | null;
    is_active: boolean;
    is_available: boolean;
}

const Inventario: React.FC = () => {
    const [activeTab, setActiveTab] = useState<string>('products');

    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterAvailable, setFilterAvailable] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState<number>(1);

    const [newProduct, setNewProduct] = useState<NewProductInput>({
        name: '',
        description: '',
        price: '',
        category: '',
        image: null,
        is_active: true,
        is_available: true
    });
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/restaurant/menu/products/');
            setProducts(response.data.results || response.data || []);
        } catch (err: any) {
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
        } catch (err: any) {
            console.error('Error fetching categories:', err);
        }
    };

    useEffect(() => {
        if (activeTab === 'products') {
            fetchProducts();
            fetchCategories();
        }
    }, [activeTab]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterCategory, filterAvailable]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setNewProduct(prev => ({ ...prev, [name]: val }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            setNewProduct(prev => ({ ...prev, image: files[0] }));
        }
    };

    const handleEditProduct = (product: Product) => {
        setEditingProduct(product);
        setNewProduct({
            name: product.name,
            description: product.description || '',
            price: String(product.price),
            category: String(product.category),
            image: null,
            is_active: product.is_active !== undefined ? product.is_active : true,
            is_available: product.is_available !== undefined ? product.is_available : true
        });
        setIsModalOpen(true);
    };

    const handleDeleteProduct = async (id: string) => {
        if (!window.confirm('¿Archivar este producto? Se desactivará para no afectar reportes históricos.')) return;
        try {
            const formData = new FormData();
            formData.append('is_active', 'false');
            formData.append('is_available', 'false');
            await api.patch(`/api/restaurant/menu/products/${id}/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            fetchProducts();
        } catch (err: any) {
            alert(`Error: ${err.response?.data?.detail || 'Error al eliminar el producto'}`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const formData = new FormData();
        formData.append('name', newProduct.name);
        formData.append('description', newProduct.description);
        formData.append('price', newProduct.price);
        formData.append('category', newProduct.category);
        formData.append('is_active', newProduct.is_active ? 'true' : 'false');
        formData.append('is_available', newProduct.is_available ? 'true' : 'false');
        if (newProduct.image) {
            formData.append('image', newProduct.image);
        }
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
        } catch (err: any) {
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
        const pages: (number | string)[] = [];
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

    return (
        <div className="min-h-screen bg-[#f0f4f9] py-7 px-6 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800 m-0 mb-1">Inventario · Restaurante</h1>
                    <p className="text-slate-500 text-sm m-0">Gestiona productos, categorías, combos, extras y tamaños</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-5 bg-white border border-slate-200 rounded-2xl p-1.5 overflow-x-auto shadow-sm">
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border-none cursor-pointer text-xs font-semibold whitespace-nowrap transition-all ${
                                activeTab === t.key
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-transparent text-slate-400 hover:text-slate-650 hover:bg-slate-50'
                            }`}
                            onClick={() => setActiveTab(t.key)}
                        >
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
                            <div className="flex gap-4 mb-6 flex-wrap">
                                <div className="flex-1 min-w-[140px] bg-white border border-slate-200 border-l-4 border-l-[#3a6ea8] rounded-xl p-3.5 shadow-sm">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 m-0">Total Productos</p>
                                    <p className="text-2xl font-extrabold text-slate-800 m-0">{products.length}</p>
                                </div>
                                <div className="flex-1 min-w-[140px] bg-white border border-slate-200 border-l-4 border-l-[#10b981] rounded-xl p-3.5 shadow-sm">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 m-0">Disponibles</p>
                                    <p className="text-2xl font-extrabold text-emerald-700 m-0">{availableCount}</p>
                                </div>
                                <div className="flex-1 min-w-[140px] bg-white border border-slate-200 border-l-4 border-l-[#ef4444] rounded-xl p-3.5 shadow-sm">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 m-0">No Disponibles</p>
                                    <p className="text-2xl font-extrabold text-rose-700 m-0">{unavailableCount}</p>
                                </div>
                                <div className="flex-1 min-w-[140px] bg-white border border-slate-200 border-l-4 border-l-[#f59e0b] rounded-xl p-3.5 shadow-sm">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 m-0">Categorías</p>
                                    <p className="text-2xl font-extrabold text-amber-700 m-0">{categories.length}</p>
                                </div>
                            </div>
                        )}

                        {/* Toolbar */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 mb-4 flex gap-2.5 items-center flex-wrap shadow-sm">
                            <div className="flex-1 min-w-[180px] relative">
                                <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Buscar producto o categoría..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-xl outline-none text-xs text-slate-800 bg-slate-50/50 transition-all focus:border-slate-400"
                                />
                            </div>
                            <select
                                className="px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 font-semibold bg-slate-50/50 outline-none cursor-pointer focus:border-slate-400"
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                            >
                                <option value="all">Todas las categorías</option>
                                {categories.map(c => (
                                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                                ))}
                            </select>
                            <select
                                className="px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 font-semibold bg-slate-50/50 outline-none cursor-pointer focus:border-slate-400"
                                value={filterAvailable}
                                onChange={(e) => setFilterAvailable(e.target.value)}
                            >
                                <option value="all">Disponibilidad</option>
                                <option value="available">Disponibles</option>
                                <option value="unavailable">No disponibles</option>
                            </select>
                            <button
                                className="px-4.5 py-2 bg-slate-700 hover:bg-slate-800 text-white border-none rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 whitespace-nowrap shadow-sm transition-colors ml-auto"
                                onClick={() => {
                                    setEditingProduct(null);
                                    setNewProduct({ name: '', description: '', price: '', category: '', image: null, is_active: true, is_available: true });
                                    setIsModalOpen(true);
                                }}
                            >
                                <i className="bi bi-plus-lg" /> Nuevo Producto
                            </button>
                        </div>

                        {/* Table */}
                        {loading ? (
                            <div className="text-center py-16 text-slate-500">
                                <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-700 rounded-full animate-spin mx-auto mb-3" />
                                Cargando inventario...
                            </div>
                        ) : error ? (
                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 font-semibold">
                                {error}
                            </div>
                        ) : (
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse min-w-[640px] text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-4.5 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Imagen</th>
                                                <th className="px-4.5 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nombre</th>
                                                <th className="px-4.5 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Categoría</th>
                                                <th className="px-4.5 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Precio</th>
                                                <th className="px-4.5 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Disponible</th>
                                                <th className="px-4.5 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {paginated.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                                        <i className="bi bi-box-seam text-3xl block mb-2 text-slate-350" />
                                                        {searchTerm ? 'No se encontraron productos' : 'No hay productos registrados'}
                                                    </td>
                                                </tr>
                                            ) : paginated.map(product => (
                                                <tr
                                                    key={product.id}
                                                    className="hover:bg-slate-50/50 transition-colors"
                                                >
                                                    <td className="px-4.5 py-3">
                                                        {product.image ? (
                                                            <img
                                                                src={getCleanImageUrl(product.image)}
                                                                alt={product.name}
                                                                className="w-12 h-12 object-cover rounded-lg border border-slate-200 shadow-sm"
                                                                onError={(e) => {
                                                                    e.currentTarget.onerror = null;
                                                                    e.currentTarget.src = '/logo-aurora.png';
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300 text-lg">
                                                                <i className="bi bi-image" />
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4.5 py-3">
                                                        <span className="font-semibold text-slate-800 text-sm">{product.name}</span>
                                                    </td>
                                                    <td className="px-4.5 py-3">
                                                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-750 border border-blue-150">
                                                            {product.category_name || product.category}
                                                        </span>
                                                    </td>
                                                    <td className="px-4.5 py-3">
                                                        <span className="font-extrabold text-emerald-600 text-sm">${product.price}</span>
                                                    </td>
                                                    <td className="px-4.5 py-3">
                                                        {product.is_available ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-250">
                                                                <i className="bi bi-check-circle-fill" /> Sí
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-250">
                                                                <i className="bi bi-x-circle-fill" /> No
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4.5 py-3 space-x-2">
                                                        <button
                                                            className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition cursor-pointer text-xs font-semibold inline-flex items-center gap-1 bg-white"
                                                            onClick={() => handleEditProduct(product)}
                                                        >
                                                            <i className="bi bi-pencil" /> Editar
                                                        </button>
                                                        <button
                                                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg transition cursor-pointer text-xs font-semibold inline-flex items-center gap-1"
                                                            onClick={() => handleDeleteProduct(product.id)}
                                                        >
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
                                    <div className="flex items-center justify-between px-4.5 py-3.5 border-t border-slate-100 flex-wrap gap-2.5">
                                        <span className="text-xs text-slate-400">
                                            Mostrando {Math.min((currentPage - 1) * PRODUCTS_PER_PAGE + 1, filtered.length)}–{Math.min(currentPage * PRODUCTS_PER_PAGE, filtered.length)} de {filtered.length} productos
                                        </span>
                                        <div className="flex gap-1 items-center">
                                            <button
                                                className={`min-w-[32px] h-8 rounded-lg border flex items-center justify-center font-semibold text-xs transition-all cursor-pointer bg-white text-slate-650 hover:bg-slate-50 border-slate-200 ${
                                                    currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''
                                                }`}
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                <i className="bi bi-chevron-left" />
                                            </button>
                                            {getPageNumbers().map((page, idx) =>
                                                page === '...' ? (
                                                    <span key={idx} className="px-1 text-slate-400">…</span>
                                                ) : (
                                                    <button
                                                        key={idx}
                                                        className={`min-w-[32px] h-8 rounded-lg border flex items-center justify-center font-semibold text-xs transition-all cursor-pointer ${
                                                            currentPage === page
                                                                ? 'border-slate-700 bg-slate-700 text-white'
                                                                : 'border-slate-200 bg-white text-slate-650 hover:bg-slate-50'
                                                        }`}
                                                        onClick={() => setCurrentPage(Number(page))}
                                                    >
                                                        {page}
                                                    </button>
                                                )
                                            )}
                                            <button
                                                className={`min-w-[32px] h-8 rounded-lg border flex items-center justify-center font-semibold text-xs transition-all cursor-pointer bg-white text-slate-650 hover:bg-slate-50 border-slate-200 ${
                                                    currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''
                                                }`}
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                            >
                                                <i className="bi bi-chevron-right" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {totalPages <= 1 && filtered.length > 0 && (
                                    <div className="px-4.5 py-3.5 border-t border-slate-100 text-xs text-slate-400">
                                        <span>{filtered.length} productos en total</span>
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
                            <form onSubmit={handleSubmit} className="p-1">
                                <div className="mb-4">
                                    <label className="block mb-1.5 font-semibold text-slate-700 text-xs uppercase tracking-wider">Nombre *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={newProduct.name}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50/50 outline-none focus:border-slate-400"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-1.5 font-semibold text-slate-700 text-xs uppercase tracking-wider">Descripción *</label>
                                    <textarea
                                        name="description"
                                        value={newProduct.description}
                                        onChange={handleInputChange}
                                        required
                                        rows={3}
                                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50/50 outline-none focus:border-slate-400 resize-y min-h-[80px]"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div>
                                        <label className="block mb-1.5 font-semibold text-slate-700 text-xs uppercase tracking-wider">Precio *</label>
                                        <input
                                            type="number"
                                            name="price"
                                            value={newProduct.price}
                                            onChange={handleInputChange}
                                            step="0.01"
                                            required
                                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50/50 outline-none focus:border-slate-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="block mb-1.5 font-semibold text-slate-700 text-xs uppercase tracking-wider">Categoría *</label>
                                        <select
                                            name="category"
                                            value={newProduct.category}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50/50 outline-none cursor-pointer focus:border-slate-400"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-6 mb-4">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            name="is_active"
                                            checked={newProduct.is_active}
                                            onChange={handleInputChange}
                                            className="w-4 h-4 text-slate-700 bg-slate-50 border-slate-250 rounded focus:ring-slate-500"
                                        />
                                        <span className="font-semibold text-slate-700 text-sm">Activo</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            name="is_available"
                                            checked={newProduct.is_available}
                                            onChange={handleInputChange}
                                            className="w-4 h-4 text-slate-700 bg-slate-50 border-slate-250 rounded focus:ring-slate-500"
                                        />
                                        <span className="font-semibold text-slate-700 text-sm">Disponible</span>
                                    </label>
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-1.5 font-semibold text-slate-700 text-xs uppercase tracking-wider">Imagen {!editingProduct && '*'}</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        required={!editingProduct}
                                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-105 file:text-slate-700 hover:file:bg-slate-200 transition"
                                    />
                                    {editingProduct && <p className="m-0 mt-1 text-xs text-slate-400 font-medium">Deja vacío para mantener la imagen actual</p>}
                                </div>
                                <div className="flex justify-end gap-3 mt-5 border-t border-slate-100 pt-4">
                                    <button
                                        type="button"
                                        className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer bg-white"
                                        onClick={() => setIsModalOpen(false)}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-450 text-white border-none rounded-xl font-semibold text-sm cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
                                        disabled={saving}
                                    >
                                        {saving ? (
                                            <>
                                                <i className="bi bi-hourglass-split animate-spin" /> Guardando...
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-check-lg" /> Guardar
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </Modal>
                    </>
                )}
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
            `}</style>
        </div>
    );
};

export default Inventario;
