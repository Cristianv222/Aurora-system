import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';
import { Product } from '../../types';

interface ProductSize {
    id: string;
    product: string;
    product_name?: string;
    name: string;
    price_adjustment: number;
    is_default: boolean;
}

interface SizeForm {
    product: string;
    name: string;
    price_adjustment: number;
    is_default: boolean;
}

const Tamanos: React.FC = () => {
    const [sizes, setSizes] = useState<ProductSize[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [newSize, setNewSize] = useState<SizeForm>({ product: '', name: '', price_adjustment: 0, is_default: false });
    const [editingSize, setEditingSize] = useState<ProductSize | null>(null);

    const fetchSizes = async () => {
        try {
            const response = await api.get('/api/menu/sizes/', { baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE });
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
            const response = await api.get('/api/menu/products/', { baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE });
            setProducts(response.data.results || response.data || []);
        } catch (err) {
            console.error('Error fetching products:', err);
        }
    };

    useEffect(() => {
        fetchSizes();
        fetchProducts();
    }, []);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target as HTMLInputElement;
        const { name, value, type } = target;
        setNewSize(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? target.checked : (type === 'number' ? Number(value) : value)
        }));
    };

    const handleEditSize = (size: ProductSize) => {
        setEditingSize(size);
        setNewSize({ product: size.product, name: size.name, price_adjustment: size.price_adjustment, is_default: size.is_default });
        setIsModalOpen(true);
    };

    const handleDeleteSize = async (id: string) => {
        if (!window.confirm('¿Estás seguro de eliminar este tamaño?')) return;
        try {
            await api.delete(`/api/menu/sizes/${id}/`, { baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE });
            fetchSizes();
        } catch (err) {
            console.error('Error deleting size:', err);
            alert('Error al eliminar el tamaño');
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            if (editingSize) {
                await api.patch(`/api/menu/sizes/${editingSize.id}/`, newSize, { baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE });
            } else {
                await api.post('/api/menu/sizes/', newSize, { baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE });
            }
            setIsModalOpen(false);
            setNewSize({ product: '', name: '', price_adjustment: 0, is_default: false });
            setEditingSize(null);
            fetchSizes();
        } catch (err) {
            console.error('Error saving size:', err);
            alert('Error al guardar el tamaño. Verifique los datos.');
        }
    };

    if (loading) return <div className="p-6 text-center text-slate-500 font-semibold text-sm">Cargando tamaños...</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <h3 className="text-xl font-bold text-slate-800">Gestión de Tamaños</h3>
                <button
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider rounded-xl transition"
                    onClick={() => { setEditingSize(null); setNewSize({ product: '', name: '', price_adjustment: 0, is_default: false }); setIsModalOpen(true); }}
                >
                    + Nuevo Tamaño
                </button>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                                <th className="px-6 py-3.5">Producto</th>
                                <th className="px-6 py-3.5">Tamaño</th>
                                <th className="px-6 py-3.5 w-36">Ajuste de Precio</th>
                                <th className="px-6 py-3.5 w-28 text-center">Por Defecto</th>
                                <th className="px-6 py-3.5 w-32 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {sizes.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">No hay tamaños registrados</td>
                                </tr>
                            ) : (
                                sizes.map(size => (
                                    <tr key={size.id} className="hover:bg-slate-50/50 transition">
                                        <td className="px-6 py-4 font-semibold text-slate-800">
                                            {size.product_name || products.find(p => p.id === size.product)?.name || size.product}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">{size.name}</td>
                                        <td className="px-6 py-4 font-semibold text-emerald-700">+${Number(size.price_adjustment).toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center">
                                            {size.is_default ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Sí</span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-200">No</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition" onClick={() => handleEditSize(size)}>✏️</button>
                                            <button className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition" onClick={() => handleDeleteSize(size.id)}>🗑️</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSize ? 'Editar Tamaño' : 'Nuevo Tamaño'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Producto</label>
                        <select name="product" value={newSize.product} onChange={handleInputChange} required className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition bg-white">
                            <option value="">Seleccione un producto</option>
                            {products.map(prod => (
                                <option key={prod.id} value={prod.id}>{prod.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nombre (ej: Grande, Mediano)</label>
                        <input type="text" name="name" value={newSize.name} onChange={handleInputChange} required className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ajuste de Precio (adicional al base)</label>
                        <input type="number" name="price_adjustment" value={newSize.price_adjustment} onChange={handleInputChange} step="0.01" required className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            name="is_default"
                            checked={newSize.is_default}
                            onChange={handleInputChange}
                            className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                        />
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Es el tamaño por defecto</span>
                    </label>
                    <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                        <button type="button" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition">Guardar</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Tamanos;
