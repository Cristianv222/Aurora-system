import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';
import Categorias from './Categorias';
import Extras from './Extras';
import Combos from './Combos';
import Tamanos from './Tamanos';
import { getCleanImageUrl } from '../../utils/image';
import { Product, Category } from '../../types';

const PRODUCTS_PER_PAGE = 10;

interface ProductForm {
    name: string;
    description: string;
    price: string;
    category: string;
    image: File | null;
    is_active: boolean;
    is_available: boolean;
}

type TabKey = 'products' | 'categories' | 'combos' | 'extras' | 'sizes';

const tabs: { key: TabKey; label: string }[] = [
    { key: 'products',   label: 'Productos'   },
    { key: 'categories', label: 'Categorías'  },
    { key: 'combos',     label: 'Combos'      },
    { key: 'extras',     label: 'Extras'      },
    { key: 'sizes',      label: 'Tamaños'     },
];

const Inventario: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabKey>('products');
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterAvailable, setFilterAvailable] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [newProduct, setNewProduct] = useState<ProductForm>({
        name: '', description: '', price: '', category: '',
        image: null, is_active: true, is_available: true
    });
    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/menu/products/', { baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE });
            setProducts(response.data.results || response.data || []);
        } catch {
            setError('Error al cargar el inventario');
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await api.get('/api/menu/categories/', { baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE });
            setCategories(response.data.results || response.data || []);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };

    useEffect(() => {
        if (activeTab === 'products') { fetchProducts(); fetchCategories(); }
    }, [activeTab]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterCategory, filterAvailable]);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const target = e.target as HTMLInputElement;
        const { name, value, type } = target;
        setNewProduct(prev => ({ ...prev, [name]: type === 'checkbox' ? target.checked : value }));
    };

    const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setNewProduct(prev => ({ ...prev, image: e.target.files![0] }));
        }
    };

    const handleEditProduct = (product: any) => {
        setEditingProduct(product);
        setNewProduct({
            name: product.name, description: product.description, price: product.price,
            category: product.category, image: null,
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
            await api.patch(`/api/menu/products/${id}/`, formData, {
                baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE,
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            fetchProducts();
        } catch (err: any) {
            alert(`Error: ${err.response?.data?.detail || 'Error al archivar el producto'}`);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
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
                await api.patch(`/api/menu/products/${editingProduct.id}/`, formData, {
                    baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE,
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } else {
                await api.post('/api/menu/products/', formData, {
                    baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE,
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

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Inventario · Menú</h1>
                <p className="text-sm text-slate-500 mt-1">Gestiona productos, categorías, combos, extras y tamaños</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1.5 overflow-x-auto shadow-sm">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`flex-1 min-w-max px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                            activeTab === t.key
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Sub-módulos */}
            {activeTab === 'categories' && <Categorias />}
            {activeTab === 'extras'     && <Extras />}
            {activeTab === 'combos'     && <Combos />}
            {activeTab === 'sizes'      && <Tamanos />}

            {/* Productos */}
            {activeTab === 'products' && (
                <>
                    {/* Stats */}
                    {!loading && !error && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                { label: 'Total Productos',   value: products.length,    color: 'border-l-slate-700',    text: 'text-slate-800' },
                                { label: 'Disponibles',       value: availableCount,      color: 'border-l-emerald-500', text: 'text-emerald-700' },
                                { label: 'No Disponibles',    value: unavailableCount,    color: 'border-l-red-400',     text: 'text-red-700' },
                                { label: 'Categorías',        value: categories.length,   color: 'border-l-amber-400',   text: 'text-amber-700' },
                            ].map(s => (
                                <div key={s.label} className={`bg-white border border-slate-200 ${s.color} border-l-4 rounded-xl p-4`}>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{s.label}</p>
                                    <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Toolbar */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-3 items-center shadow-sm">
                        <div className="flex-1 min-w-[180px] relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Buscar producto o categoría..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800 transition bg-slate-50"
                            />
                        </div>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800 bg-slate-50 text-slate-700 font-semibold"
                        >
                            <option value="all">Todas las categorías</option>
                            {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                        </select>
                        <select
                            value={filterAvailable}
                            onChange={(e) => setFilterAvailable(e.target.value)}
                            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800 bg-slate-50 text-slate-700 font-semibold"
                        >
                            <option value="all">Disponibilidad</option>
                            <option value="available">Disponibles</option>
                            <option value="unavailable">No disponibles</option>
                        </select>
                        <button
                            onClick={() => { setEditingProduct(null); setNewProduct({ name: '', description: '', price: '', category: '', image: null, is_active: true, is_available: true }); setIsModalOpen(true); }}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center gap-1.5"
                        >
                            + Nuevo Producto
                        </button>
                    </div>

                    {/* Table */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mr-3"></div>
                            <span className="text-slate-500 text-sm font-medium">Cargando inventario...</span>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}</div>
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                                            <th className="px-6 py-3.5 w-20">Imagen</th>
                                            <th className="px-6 py-3.5">Nombre</th>
                                            <th className="px-6 py-3.5">Categoría</th>
                                            <th className="px-6 py-3.5 w-28">Precio</th>
                                            <th className="px-6 py-3.5 w-28 text-center">Disponible</th>
                                            <th className="px-6 py-3.5 w-36 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {paginated.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                                                    {searchTerm ? 'No se encontraron productos' : 'No hay productos registrados'}
                                                </td>
                                            </tr>
                                        ) : paginated.map(product => (
                                            <tr key={product.id} className="hover:bg-slate-50/50 transition">
                                                <td className="px-6 py-3">
                                                    {product.image ? (
                                                        <img
                                                            src={getCleanImageUrl(product.image)}
                                                            alt={product.name}
                                                            className="w-12 h-12 object-cover rounded-xl border border-slate-100 shadow-sm"
                                                            onError={(e) => {
                                                                e.currentTarget.onerror = null;
                                                                e.currentTarget.src = '/logo-aurora.png';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 font-semibold text-slate-800">{product.name}</td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                                        {product.category_name || product.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-semibold text-emerald-700">${product.price}</td>
                                                <td className="px-6 py-4 text-center">
                                                    {product.is_available
                                                        ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Sí</span>
                                                        : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">✗ No</span>
                                                    }
                                                </td>
                                                <td className="px-6 py-4 text-right space-x-2">
                                                    <button className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition text-xs font-semibold" onClick={() => handleEditProduct(product)}>Editar</button>
                                                    <button className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition text-xs font-semibold" onClick={() => handleDeleteProduct(product.id)}>Archivar</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 text-xs text-slate-500 flex-wrap gap-2">
                                    <span>
                                        Mostrando {Math.min((currentPage - 1) * PRODUCTS_PER_PAGE + 1, filtered.length)}–{Math.min(currentPage * PRODUCTS_PER_PAGE, filtered.length)} de {filtered.length} productos
                                    </span>
                                    <div className="flex gap-1">
                                        <button
                                            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >‹</button>
                                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                                            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                            .map((p, i, arr) => (
                                                <React.Fragment key={p}>
                                                    {i > 0 && arr[i - 1] !== p - 1 && <span className="w-8 h-8 flex items-center justify-center text-slate-400">…</span>}
                                                    <button
                                                        className={`w-8 h-8 rounded-lg border flex items-center justify-center font-semibold ${currentPage === p ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 hover:bg-slate-50'}`}
                                                        onClick={() => setCurrentPage(p)}
                                                    >{p}</button>
                                                </React.Fragment>
                                            ))}
                                        <button
                                            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >›</button>
                                    </div>
                                </div>
                            )}
                            {totalPages <= 1 && filtered.length > 0 && (
                                <div className="px-6 py-3.5 border-t border-slate-100 text-xs text-slate-500">{filtered.length} productos en total</div>
                            )}
                        </div>
                    )}

                    {/* Modal */}
                    <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProduct ? 'Editar Producto' : 'Nuevo Producto'}>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nombre *</label>
                                <input type="text" name="name" value={newProduct.name} onChange={handleInputChange} required className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Descripción *</label>
                                <textarea name="description" value={newProduct.description} onChange={handleInputChange} required rows={3} className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition resize-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Precio *</label>
                                    <input type="number" name="price" value={newProduct.price} onChange={handleInputChange} step="0.01" required className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Categoría *</label>
                                    <select name="category" value={newProduct.category} onChange={handleInputChange} required className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 bg-white transition">
                                        <option value="">Seleccionar...</option>
                                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-5">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" name="is_active" checked={newProduct.is_active} onChange={handleInputChange} className="w-4 h-4 rounded" />
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Activo</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" name="is_available" checked={newProduct.is_available} onChange={handleInputChange} className="w-4 h-4 rounded" />
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Disponible</span>
                                </label>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Imagen{!editingProduct && ' *'}</label>
                                <input type="file" accept="image/*" onChange={handleImageChange} required={!editingProduct} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
                                {editingProduct && <p className="text-xs text-slate-400">Deja vacío para mantener la imagen actual</p>}
                            </div>
                            <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                                <button type="button" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                                <button type="submit" disabled={saving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-50">
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </Modal>
                </>
            )}
        </div>
    );
};

export default Inventario;
