import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import api from '../../services/api';
import { User } from '../../types';

interface FormularioUsuarioProps {
  userToEdit: User | null;
  onSave: () => void;
  onCancel: () => void;
}

interface RoleChoice {
  value: string;
  label: string;
}

const FormularioUsuario: React.FC<FormularioUsuarioProps> = ({ userToEdit, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        password_confirm: '',
        first_name: '',
        last_name: '',
        phone: '',
        role: '' // Inicializar vacío para obligar selección
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [roles, setRoles] = useState<RoleChoice[]>([]);

    useEffect(() => {
        const fetchRoles = async () => {
            try {
                const response = await api.get('/api/roles/choices/');
                setRoles(response.data);
            } catch (err) {
                console.error('Error cargando roles', err);
            }
        };
        fetchRoles();
    }, []);

    useEffect(() => {
        if (userToEdit) {
            const { password, ...userData } = userToEdit as any;
            setFormData({ 
                username: userData.username || '',
                email: userData.email || '',
                first_name: userData.first_name || '',
                last_name: userData.last_name || '',
                phone: userData.phone || '',
                role: userData.role || '',
                password: '',
                password_confirm: ''
            });
        } else {
            setFormData({
                username: '',
                email: '',
                password: '',
                password_confirm: '',
                first_name: '',
                last_name: '',
                phone: '',
                role: ''
            });
        }
    }, [userToEdit]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (userToEdit) {
                const dataToSend: any = { ...formData };
                if (!dataToSend.password) delete dataToSend.password;
                delete dataToSend.password_confirm;

                await api.patch(`/api/users/${userToEdit.id}/`, dataToSend);
            } else {
                if (formData.password !== formData.password_confirm) {
                    setError('Las contraseñas no coinciden');
                    setLoading(false);
                    return;
                }
                await api.post('/api/users/', formData);
            }
            onSave(); // Notificar al padre que se guardó
        } catch (err: any) {
            console.error(err);
            if (err.response?.data) {
                const errorData = err.response.data;
                if (typeof errorData === 'object' && !errorData.detail) {
                    const messages = Object.entries(errorData).map(([key, value]) => {
                        return `${key}: ${Array.isArray(value) ? value.join(' ') : value}`;
                    }).join(' | ');
                    setError(messages);
                } else {
                    setError(errorData.detail || 'Error al guardar usuario');
                }
            } else {
                setError('Error al guardar usuario');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs font-semibold flex items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill"></i>
                    <span>{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nombre de Usuario</label>
                    <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition placeholder:text-slate-300"
                        required
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Email</label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition placeholder:text-slate-300"
                        required
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Contraseña {userToEdit && '(Dejar en blanco)'}
                        </label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition placeholder:text-slate-300"
                            required={!userToEdit}
                        />
                    </div>

                    {!userToEdit && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Confirmar Contraseña</label>
                            <input
                                type="password"
                                name="password_confirm"
                                value={formData.password_confirm}
                                onChange={handleChange}
                                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition placeholder:text-slate-300"
                                required
                            />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nombre</label>
                        <input
                            type="text"
                            name="first_name"
                            value={formData.first_name}
                            onChange={handleChange}
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition placeholder:text-slate-300"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Apellido</label>
                        <input
                            type="text"
                            name="last_name"
                            value={formData.last_name}
                            onChange={handleChange}
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition placeholder:text-slate-300"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Teléfono</label>
                    <input
                        type="text"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition placeholder:text-slate-300"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Rol</label>
                    <select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm bg-white focus:outline-none focus:border-slate-800 transition"
                        required
                    >
                        <option value="">Seleccione un rol</option>
                        {roles.map(role => (
                            <option key={role.value} value={role.value}>
                                {role.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button 
                        type="button" 
                        onClick={onCancel} 
                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition"
                        disabled={loading}
                    >
                        {loading ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default FormularioUsuario;
