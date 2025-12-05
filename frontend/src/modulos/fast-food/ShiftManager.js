import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const ShiftManager = ({ onShiftActive }) => {
    const [currentShift, setCurrentShift] = useState(null);
    const [loading, setLoading] = useState(true);
    const [openingCash, setOpeningCash] = useState('');
    const [closingCash, setClosingCash] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        checkCurrentShift();
    }, []);

    const checkCurrentShift = async () => {
        try {
            const response = await api.get('/api/pos/shifts/current/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            if (response.data && response.data.status === 'open') {
                setCurrentShift(response.data);
                onShiftActive(true);
            } else {
                setCurrentShift(null);
                onShiftActive(false);
            }
        } catch (err) {
            // Si da 404 es que no hay turno, no es error crítico
            if (err.response && err.response.status === 404) {
                setCurrentShift(null);
                onShiftActive(false);
            } else {
                console.error('Error checking shift:', err);
                setError('Error al verificar turno');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOpenShift = async (e) => {
        e.preventDefault();
        setError('');
        try {
            // Necesitamos un cash_register_id. Por ahora hardcodeamos el primero o buscamos uno
            // Idealmente el usuario selecciona la caja o se asigna por configuración
            // Vamos a intentar obtener las cajas disponibles primero
            const registersRes = await api.get('/api/payments/cash-registers/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });

            const register = registersRes.data.results ? registersRes.data.results[0] : registersRes.data[0];

            if (!register) {
                setError('No hay cajas registradoras configuradas');
                return;
            }

            const response = await api.post('/api/pos/shifts/', {
                cash_register: register.id,
                opening_cash: parseFloat(openingCash),
                opening_notes: notes
            }, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });

            setCurrentShift(response.data);
            onShiftActive(true);
            setOpeningCash('');
            setNotes('');
        } catch (err) {
            console.error('Error opening shift:', err);
            setError('Error al abrir turno. Verifique los datos.');
        }
    };

    const handleCloseShift = async (e) => {
        e.preventDefault();
        if (!currentShift) return;

        if (!window.confirm('¿Está seguro de cerrar el turno?')) return;

        try {
            await api.post(`/api/pos/shifts/${currentShift.id}/close/`, {
                closing_cash: parseFloat(closingCash),
                closing_notes: notes
            }, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });

            setCurrentShift(null);
            onShiftActive(false);
            setClosingCash('');
            setNotes('');
            alert('Turno cerrado correctamente');
        } catch (err) {
            console.error('Error closing shift:', err);
            setError('Error al cerrar turno');
        }
    };

    if (loading) return <div>Cargando estado del turno...</div>;

    if (currentShift) {
        return (
            <div className="bg-white p-4 rounded shadow mb-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-green-600">Turno Abierto: {currentShift.shift_number}</h3>
                    <span className="text-sm text-gray-500">Inicio: {new Date(currentShift.opened_at).toLocaleString()}</span>
                </div>

                <form onSubmit={handleCloseShift} className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Cerrar Turno</h4>
                    <div className="flex gap-4 items-end">
                        <div>
                            <label className="block text-sm text-gray-700">Efectivo Final</label>
                            <input
                                type="number"
                                step="0.01"
                                className="border rounded p-2 w-32"
                                value={closingCash}
                                onChange={(e) => setClosingCash(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-700">Notas</label>
                            <input
                                type="text"
                                className="border rounded p-2 w-64"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Notas de cierre..."
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                        >
                            Cerrar Turno
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded shadow-lg max-w-md mx-auto mt-10">
            <h2 className="text-xl font-bold mb-4 text-center">Apertura de Caja</h2>
            {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>}

            <form onSubmit={handleOpenShift}>
                <div className="mb-4">
                    <label className="block text-gray-700 mb-2">Fondo de Caja (Efectivo Inicial)</label>
                    <input
                        type="number"
                        step="0.01"
                        className="w-full border rounded p-2"
                        value={openingCash}
                        onChange={(e) => setOpeningCash(e.target.value)}
                        required
                        placeholder="0.00"
                    />
                </div>
                <div className="mb-6">
                    <label className="block text-gray-700 mb-2">Notas</label>
                    <textarea
                        className="w-full border rounded p-2"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Observaciones iniciales..."
                        rows="3"
                    />
                </div>
                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-bold"
                >
                    Abrir Turno
                </button>
            </form>
        </div>
    );
};

export default ShiftManager;
