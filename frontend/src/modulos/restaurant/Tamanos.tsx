import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';

interface Size {
    id: string;
    product: string | number;
    product_name?: string;
    name: string;
    price_adjustment: string | number;
    is_default: boolean;
}

interface NewSizeInput {
    product: string;
    name: string;
    price_adjustment: number | string;
    is_default: boolean;
}

interface Product {
    id: string;
    name: string;
}

const Tamanos: React.FC = () => {
    const [sizes, setSizes] = useState<Size[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    const [newSize, setNewSize] = useState<NewSizeInput>({
        product: '',
        name: '',
        price_adjustment: 0,
        is_default: false
    });
    const [editingSize, setEditingSize] = useState<Size | null>(null);

    const fetchSizes = async () => {
        try {
            const response = await api.get('/api/restaurant/menu/sizes/');
            setSizes(response.data.results || response.data || []);
        } catch (err: any) {
            console.error('Error fetching sizes:', err);
            setError('Error al cargar los tamaños');
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const response = await api.get('/api/restaurant/menu/products/');
            setProducts(response.data.results || response.data || []);
        } catch (err: any) {
            console.error('Error fetching products:', err);
        }
    };

    useEffect(() => {
        fetchSizes();
        fetchProducts();
    }, []);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setNewSize(prev => ({
            ...prev,
            [name]: val
        }));
    };

    const handleEditSize = (size: Size) => {
        setEditingSize(size);
        setNewSize({
            product: String(size.product),
            name: size.name,
            price_adjustment: size.price_adjustment,
            is_default: size.is_default
        });
        setIsModalOpen(true);
    };

    const handleDeleteSize = async (id: string) => {
        if (window.confirm('¿Estás seguro de eliminar este tamaño?')) {
            try {
                await api.delete(`/api/restaurant/menu/sizes/${id}/`);
                fetchSizes();
            } catch (err: any) {
                console.error('Error deleting size:', err);
                alert('Error al eliminar el tamaño');
            }
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        try {
            if (editingSize) {
                await api.patch(`/api/restaurant/menu/sizes/${editingSize.id}/`, newSize);
            } else {
                await api.post('/api/restaurant/menu/sizes/', newSize);
            }
            setIsModalOpen(false);
            setNewSize({ product: '', name: '', price_adjustment: 0, is_default: false });
            setEditingSize(null);
            fetchSizes();
        } catch (err: any) {
            console.error('Error saving size:', err);
            alert('Error al guardar el tamaño. Verifique los datos.');
        }
    };

    if (loading) {
        return (
            <div className="p-6 text-center text-slate-500 flex justify-center items-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-600 mr-2"></div>
                Cargando tamaños...
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <h3 className="text-xl font-bold text-slate-800 m-0">Gestión de Tamaños</h3>
                <button
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider rounded-xl transition cursor-pointer border-none"
                    onClick={() => {
                        setEditingSize(null);
                        setNewSize({ product: '', name: '', price_adjustment: 0, is_default: false });
                        setIsModalOpen(true);
                    }}
                >
                    + Nuevo Tamaño
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                                <th className="px-6 py-3.5 w-24">ID</th>
                                <th className="px-6 py-3.5">Producto</th>
                                <th className="px-6 py-3.5">Nombre</th>
                                <th className="px-6 py-3.5 w-40">Ajuste de Precio</th>
                                <th className="px-6 py-3.5 w-32 text-center">Por Defecto</th>
                                <th className="px-6 py-3.5 w-32 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {sizes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                                        No hay tamaños registrados
                                    </td>
                                </tr>
                            ) : (
                                sizes.map(size => (
                                    <tr key={size.id} className="hover:bg-slate-50/50 transition">
                                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{size.id}</td>
                                        <td className="px-6 py-4 font-semibold text-slate-800">
                                            {size.product_name || (products.find(p => p.id === String(size.product))?.name) || size.product}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 font-medium">{size.name}</td>
                                        <td className="px-6 py-4 font-semibold text-emerald-600">${size.price_adjustment}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                size.is_default
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : 'bg-slate-50 text-slate-500 border border-slate-200'
                                            }`}>
                                                {size.is_default ? 'Sí' : 'No'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                            <button
                                                className="px-2 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition cursor-pointer bg-white"
                                                onClick={() => handleEditSize(size)}
                                                title="Editar"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition cursor-pointer border-none"
                                                onClick={() => handleDeleteSize(size.id)}
                                                title="Eliminar"
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
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSize ? "Editar Tamaño" : "Nuevo Tamaño"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Producto</label>
                        <select
                            name="product"
                            value={newSize.product}
                            onChange={handleInputChange}
                            required
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition bg-white"
                        >
                            <option value="">Seleccione un producto</option>
                            {products.map(prod => (
                                <option key={prod.id} value={prod.id}>{prod.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nombre (ej: Grande, Mediano)</label>
                        <input
                            type="text"
                            name="name"
                            value={newSize.name}
                            onChange={handleInputChange}
                            required
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ajuste de Precio (Adicional al base)</label>
                        <input
                            type="number"
                            name="price_adjustment"
                            value={newSize.price_adjustment}
                            onChange={handleInputChange}
                            step="0.01"
                            required
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition"
                        />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            name="is_default"
                            id="is_default"
                            checked={newSize.is_default}
                            onChange={handleInputChange}
                            className="w-4 h-4 text-slate-900 border-slate-200 rounded focus:ring-slate-800 accent-slate-900 cursor-pointer"
                        />
                        <label htmlFor="is_default" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                            Es el tamaño por defecto
                        </label>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer bg-white"
                            onClick={() => setIsModalOpen(false)}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition cursor-pointer border-none"
                        >
                            Guardar
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Tamanos;
