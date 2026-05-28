import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';

interface Combo {
    id: string;
    name: string;
    description: string;
    price: string | number;
    image?: string;
    products_count?: number;
}

interface NewComboInput {
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

    const [newCombo, setNewCombo] = useState<NewComboInput>({
        name: '',
        description: '',
        price: '',
        image: null
    });
    const [editingCombo, setEditingCombo] = useState<Combo | null>(null);

    const fetchCombos = async () => {
        try {
            const response = await api.get('/api/restaurant/menu/combos/');
            setCombos(response.data.results || response.data || []);
        } catch (err: any) {
            console.error('Error fetching combos:', err);
            setError('Error al cargar los combos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCombos();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewCombo(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setNewCombo(prev => ({ ...prev, image: e.target.files![0] }));
        }
    };

    const handleEditCombo = (combo: Combo) => {
        setEditingCombo(combo);
        setNewCombo({
            name: combo.name,
            description: combo.description,
            price: String(combo.price),
            image: null
        });
        setIsModalOpen(true);
    };

    const handleDeleteCombo = async (id: string) => {
        if (window.confirm('¿Estás seguro de eliminar este combo?')) {
            try {
                await api.delete(`/api/restaurant/menu/combos/${id}/`, {
                    baseURL: process.env.REACT_APP_RESTAURANT_SERVICE,
                });
                fetchCombos();
            } catch (err: any) {
                console.error('Error deleting combo:', err);
                alert('Error al eliminar el combo');
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const slug = newCombo.name.toLowerCase()
            .replace(/ /g, '-')
            .replace(/[^\w-]+/g, '');

        const formData = new FormData();
        formData.append('name', newCombo.name);
        formData.append('slug', slug);
        formData.append('description', newCombo.description);
        formData.append('price', newCombo.price);
        if (newCombo.image) {
            formData.append('image', newCombo.image);
        }

        try {
            if (editingCombo) {
                await api.patch(`/api/restaurant/menu/combos/${editingCombo.id}/`, formData, {
                    baseURL: process.env.REACT_APP_RESTAURANT_SERVICE,
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } else {
                await api.post('/api/restaurant/menu/combos/', formData, {
                    baseURL: process.env.REACT_APP_RESTAURANT_SERVICE,
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            setIsModalOpen(false);
            setNewCombo({ name: '', description: '', price: '', image: null });
            setEditingCombo(null);
            fetchCombos();
        } catch (err: any) {
            console.error('Error saving combo:', err);
            alert('Error al guardar el combo. Verifique los datos.');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12 text-gray-500 font-medium">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
                Cargando combos...
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-sm mb-6">
                {error}
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="mb-6 flex justify-between items-center mt-2">
                <h3 className="text-2xl font-bold text-gray-800 m-0">Gestión de Combos</h3>
                <button
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors border-none cursor-pointer flex items-center gap-1 shadow-sm"
                    onClick={() => {
                        setEditingCombo(null);
                        setNewCombo({ name: '', description: '', price: '', image: null });
                        setIsModalOpen(true);
                    }}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nuevo Combo
                </button>
            </div>

            <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Imagen</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Nombre</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Descripción</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Precio</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Productos</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {combos.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500 font-medium">
                                    No hay combos registrados
                                </td>
                            </tr>
                        ) : (
                            combos.map(combo => (
                                <tr key={combo.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {combo.image ? (
                                            <img
                                                src={combo.image.startsWith('http') ? combo.image : `${process.env.REACT_APP_RESTAURANT_SERVICE}${combo.image}`}
                                                alt={combo.name}
                                                className="w-12 h-12 object-cover rounded-lg shadow-sm border border-gray-100"
                                            />
                                        ) : (
                                            <span className="text-gray-400 text-xs italic">Sin imagen</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{combo.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{combo.description}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${combo.price}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{combo.products_count || 0}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm flex items-center gap-2">
                                        <button
                                            className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer bg-white"
                                            onClick={() => handleEditCombo(combo)}
                                            title="Editar"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded text-red-600 transition-colors cursor-pointer"
                                            onClick={() => handleDeleteCombo(combo.id)}
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCombo ? "Editar Combo" : "Nuevo Combo"}>
                <form onSubmit={handleSubmit} className="p-1">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
                        <input
                            type="text"
                            name="name"
                            value={newCombo.name}
                            onChange={handleInputChange}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
                        <textarea
                            name="description"
                            value={newCombo.description}
                            onChange={handleInputChange}
                            required
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 resize-y"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Precio</label>
                        <input
                            type="number"
                            name="price"
                            value={newCombo.price}
                            onChange={handleInputChange}
                            step="0.01"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        />
                    </div>
                    <div className="mb-5">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Imagen</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            required={!editingCombo}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 border border-gray-300 rounded-lg font-medium text-sm transition-all cursor-pointer"
                            onClick={() => setIsModalOpen(false)}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-all border-none cursor-pointer"
                        >
                            Guardar
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Combos;
