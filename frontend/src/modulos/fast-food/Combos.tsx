import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';

interface Combo {
    id: string;
    name: string;
    description?: string;
    price: number | string;
    image?: string;
    products_count?: number;
}

interface ComboForm {
    name: string;
    description: string;
    price: string;
    image: File | null;
}

const Combos: React.FC = () => {
    const [combos, setCombos] = useState<Combo[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [newCombo, setNewCombo] = useState<ComboForm>({ name: '', description: '', price: '', image: null });
    const [editingCombo, setEditingCombo] = useState<Combo | null>(null);

    const fetchCombos = async () => {
        try {
            const response = await api.get('/api/menu/combos/', { baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE });
            setCombos(response.data.results || (Array.isArray(response.data) ? response.data : []));
        } catch (err) {
            console.error('Error fetching combos:', err);
            setError('Error al cargar los combos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCombos(); }, []);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewCombo(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setNewCombo(prev => ({ ...prev, image: e.target.files![0] }));
        }
    };

    const handleEditCombo = (combo: Combo) => {
        setEditingCombo(combo);
        setNewCombo({ name: combo.name, description: combo.description || '', price: String(combo.price), image: null });
        setIsModalOpen(true);
    };

    const handleDeleteCombo = async (id: string) => {
        if (!window.confirm('¿Estás seguro de eliminar este combo?')) return;
        try {
            await api.delete(`/api/menu/combos/${id}/`, { baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE });
            fetchCombos();
        } catch (err) {
            console.error('Error deleting combo:', err);
            alert('Error al eliminar el combo');
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const slug = newCombo.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
        const formData = new FormData();
        formData.append('name', newCombo.name);
        formData.append('slug', slug);
        formData.append('description', newCombo.description);
        formData.append('price', newCombo.price);
        if (newCombo.image instanceof File) formData.append('image', newCombo.image);

        try {
            if (editingCombo) {
                await api.patch(`/api/menu/combos/${editingCombo.id}/`, formData, {
                    baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE,
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } else {
                await api.post('/api/menu/combos/', formData, {
                    baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE,
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            setIsModalOpen(false);
            setNewCombo({ name: '', description: '', price: '', image: null });
            setEditingCombo(null);
            fetchCombos();
        } catch (err) {
            console.error('Error saving combo:', err);
            alert('Error al guardar el combo. Verifique los datos.');
        }
    };

    if (loading) return <div className="p-6 text-center text-slate-500 font-semibold text-sm">Cargando combos...</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <h3 className="text-xl font-bold text-slate-800">Gestión de Combos</h3>
                <button
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider rounded-xl transition"
                    onClick={() => { setEditingCombo(null); setNewCombo({ name: '', description: '', price: '', image: null }); setIsModalOpen(true); }}
                >
                    + Nuevo Combo
                </button>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                                <th className="px-6 py-3.5 w-24">Imagen</th>
                                <th className="px-6 py-3.5">Nombre</th>
                                <th className="px-6 py-3.5">Descripción</th>
                                <th className="px-6 py-3.5 w-28">Precio</th>
                                <th className="px-6 py-3.5 w-28 text-center">Productos</th>
                                <th className="px-6 py-3.5 w-32 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {combos.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No hay combos registrados</td>
                                </tr>
                            ) : (
                                combos.map(combo => (
                                    <tr key={combo.id} className="hover:bg-slate-50/50 transition">
                                        <td className="px-6 py-3">
                                            {combo.image ? (
                                                <img
                                                    src={combo.image.startsWith('http') ? combo.image : `${import.meta.env.VITE_FAST_FOOD_SERVICE}${combo.image}`}
                                                    alt={combo.name}
                                                    className="w-12 h-12 object-cover rounded-lg border border-slate-100 shadow-sm"
                                                />
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Sin imagen</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-slate-800">{combo.name}</td>
                                        <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{combo.description || '—'}</td>
                                        <td className="px-6 py-4 font-semibold text-emerald-700">${Number(combo.price).toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200">
                                                {combo.products_count || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition" onClick={() => handleEditCombo(combo)}>✏️</button>
                                            <button className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition" onClick={() => handleDeleteCombo(combo.id)}>🗑️</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCombo ? 'Editar Combo' : 'Nuevo Combo'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nombre</label>
                        <input type="text" name="name" value={newCombo.name} onChange={handleInputChange} required className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Descripción</label>
                        <textarea name="description" value={newCombo.description} onChange={handleInputChange} rows={3} className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition resize-none" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Precio</label>
                        <input type="number" name="price" value={newCombo.price} onChange={handleInputChange} step="0.01" required className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Imagen</label>
                        <input type="file" accept="image/*" onChange={handleImageChange} required={!editingCombo} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
                    </div>
                    <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                        <button type="button" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition">Guardar</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Combos;
