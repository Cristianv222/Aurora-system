import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';

interface Extra {
    id: string;
    name: string;
    description?: string;
    price: string | number;
    image?: string;
}

interface NewExtraInput {
    name: string;
    description: string;
    price: string;
    image: File | null;
}

const Extras: React.FC = () => {
    const [extras, setExtras] = useState<Extra[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    const [newExtra, setNewExtra] = useState<NewExtraInput>({
        name: '',
        description: '',
        price: '',
        image: null
    });
    const [editingExtra, setEditingExtra] = useState<Extra | null>(null);

    const fetchExtras = async () => {
        try {
            const response = await api.get('/api/restaurant/menu/extras/');
            setExtras(response.data.results || response.data || []);
        } catch (err: any) {
            console.error('Error fetching extras:', err);
            setError('Error al cargar los extras');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExtras();
    }, []);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewExtra(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            setNewExtra(prev => ({ ...prev, image: files[0] }));
        }
    };

    const handleEditExtra = (extra: Extra) => {
        setEditingExtra(extra);
        setNewExtra({
            name: extra.name,
            description: extra.description || '',
            price: String(extra.price),
            image: null
        });
        setIsModalOpen(true);
    };

    const handleDeleteExtra = async (id: string) => {
        if (window.confirm('¿Estás seguro de eliminar este extra?')) {
            try {
                await api.delete(`/api/restaurant/menu/extras/${id}/`);
                fetchExtras();
            } catch (err: any) {
                console.error('Error deleting extra:', err);
                alert('Error al eliminar el extra');
            }
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('name', newExtra.name);
        formData.append('description', newExtra.description);
        formData.append('price', newExtra.price);
        if (newExtra.image) {
            formData.append('image', newExtra.image);
        }

        try {
            if (editingExtra) {
                await api.patch(`/api/restaurant/menu/extras/${editingExtra.id}/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } else {
                await api.post('/api/restaurant/menu/extras/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            setIsModalOpen(false);
            setNewExtra({ name: '', description: '', price: '', image: null });
            setEditingExtra(null);
            fetchExtras();
        } catch (err: any) {
            console.error('Error saving extra:', err);
            alert('Error al guardar el extra. Verifique los datos.');
        }
    };

    if (loading) {
        return (
            <div className="p-6 text-center text-slate-500 flex justify-center items-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-600 mr-2"></div>
                Cargando extras...
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <h3 className="text-xl font-bold text-slate-800 m-0">Gestión de Extras/Adicionales</h3>
                <button
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider rounded-xl transition cursor-pointer border-none"
                    onClick={() => {
                        setEditingExtra(null);
                        setNewExtra({ name: '', description: '', price: '', image: null });
                        setIsModalOpen(true);
                    }}
                >
                    + Nuevo Extra
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
                                <th className="px-6 py-3.5">Nombre</th>
                                <th className="px-6 py-3.5">Descripción</th>
                                <th className="px-6 py-3.5 w-32">Precio</th>
                                <th className="px-6 py-3.5 w-32 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {extras.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                        No hay extras registrados
                                    </td>
                                </tr>
                            ) : (
                                extras.map(extra => (
                                    <tr key={extra.id} className="hover:bg-slate-50/50 transition">
                                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{extra.id}</td>
                                        <td className="px-6 py-4 font-semibold text-slate-800">{extra.name}</td>
                                        <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{extra.description || '—'}</td>
                                        <td className="px-6 py-4 font-medium text-slate-900">${extra.price}</td>
                                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                            <button
                                                className="px-2 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition cursor-pointer bg-white"
                                                onClick={() => handleEditExtra(extra)}
                                                title="Editar"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition cursor-pointer border-none"
                                                onClick={() => handleDeleteExtra(extra.id)}
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingExtra ? "Editar Extra" : "Nuevo Extra"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nombre</label>
                        <input
                            type="text"
                            name="name"
                            value={newExtra.name}
                            onChange={handleInputChange}
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition"
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Descripción</label>
                        <textarea
                            name="description"
                            value={newExtra.description}
                            onChange={handleInputChange}
                            rows={3}
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Precio</label>
                        <input
                            type="number"
                            name="price"
                            value={newExtra.price}
                            onChange={handleInputChange}
                            step="0.01"
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition"
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Imagen</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 transition"
                            required={!editingExtra}
                        />
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

export default Extras;
