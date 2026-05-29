import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';

const Categorias: React.FC = () => {
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    // Estado del formulario
    const [newCategory, setNewCategory] = useState<{
        name: string;
        description: string;
        image: File | null;
    }>({
        name: '',
        description: '',
        image: null
    });
    const [editingCategory, setEditingCategory] = useState<any | null>(null);

    const fetchCategories = async () => {
        try {
            const response = await api.get('/api/menu/categories/', {
                baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE
            });
            setCategories(response.data.results || response.data || []);
        } catch (err) {
            console.error('Error fetching categories:', err);
            setError('Error al cargar las categorías');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewCategory(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            setNewCategory(prev => ({ ...prev, image: files[0] }));
        }
    };

    const handleEditCategory = (category: any) => {
        setEditingCategory(category);
        setNewCategory({
            name: category.name,
            description: category.description,
            image: null // Reset image input
        });
        setIsModalOpen(true);
    };

    const handleDeleteCategory = async (id: string) => {
        if (window.confirm('¿Estás seguro de eliminar esta categoría?')) {
            try {
                await api.delete(`/api/menu/categories/${id}/`, {
                    baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE
                });
                fetchCategories();
            } catch (err) {
                console.error('Error deleting category:', err);
                alert('Error al eliminar la categoría');
            }
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        // Generar slug simple
        const slug = newCategory.name.toLowerCase()
            .replace(/ /g, '-')
            .replace(/[^\w-]+/g, '');

        const formData = new FormData();
        formData.append('name', newCategory.name);
        formData.append('slug', slug);
        formData.append('description', newCategory.description);
        if (newCategory.image instanceof File) {
            formData.append('image', newCategory.image);
        }

        try {
            if (editingCategory) {
                await api.patch(`/api/menu/categories/${editingCategory.id}/`, formData, {
                    baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE,
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } else {
                await api.post('/api/menu/categories/', formData, {
                    baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE,
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            setIsModalOpen(false);
            setNewCategory({ name: '', description: '', image: null });
            setEditingCategory(null);
            fetchCategories(); // Recargar lista
        } catch (err) {
            console.error('Error saving category:', err);
            alert('Error al guardar la categoría. Verifique los datos.');
        }
    };

    if (loading) return <div className="p-6 text-center text-slate-500 font-semibold text-sm">Cargando categorías...</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <h3 className="text-xl font-bold text-slate-800">Gestión de Categorías</h3>
                <button 
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider rounded-xl transition" 
                    onClick={() => {
                        setEditingCategory(null);
                        setNewCategory({ name: '', description: '', image: null });
                        setIsModalOpen(true);
                    }}
                >
                    + Nueva Categoría
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
                                <th className="px-6 py-3.5 w-40 text-center">Productos Activos</th>
                                <th className="px-6 py-3.5 w-32 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {categories.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                        No hay categorías registradas
                                    </td>
                                </tr>
                            ) : (
                                categories.map(cat => (
                                    <tr key={cat.id} className="hover:bg-slate-50/50 transition">
                                        <td className="px-6 py-3">
                                            {cat.image ? (
                                                <img
                                                    src={cat.image.startsWith('http') ? cat.image : `${import.meta.env.VITE_FAST_FOOD_SERVICE}${cat.image}`}
                                                    alt={cat.name}
                                                    className="w-12 h-12 object-cover rounded-lg border border-slate-100 shadow-sm"
                                                />
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Sin imagen</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-slate-800">{cat.name}</td>
                                        <td className="px-6 py-4 text-slate-550 max-w-xs truncate">{cat.description || '—'}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200">
                                                {cat.products_count || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button
                                                className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition"
                                                onClick={() => handleEditCategory(cat)}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-650 rounded-lg transition"
                                                onClick={() => handleDeleteCategory(cat.id)}
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCategory ? "Editar Categoría" : "Nueva Categoría"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nombre</label>
                        <input
                            type="text"
                            name="name"
                            value={newCategory.name}
                            onChange={handleInputChange}
                            required
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Descripción</label>
                        <textarea
                            name="description"
                            value={newCategory.description}
                            onChange={handleInputChange}
                            rows={3}
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition resize-none"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Imagen</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            required={!editingCategory}
                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                        />
                    </div>
                    <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                        <button type="button" className="px-4.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition">Guardar</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Categorias;
