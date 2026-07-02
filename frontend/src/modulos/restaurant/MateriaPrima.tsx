import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';
import { Product } from '../../types';

interface RecipeItem {
    id: string;
    product: string;
    product_name: string;
    quantity_used: string;
}

interface RawMaterial {
    id: string;
    name: string;
    unit: string;
    stock: string;
    recipe_items: RecipeItem[];
}

interface DailyInventory {
    id: string;
    raw_material: string;
    raw_material_name: string;
    raw_material_unit: string;
    previous_balance: string;
    income: string;
    consumption: string;
    current_balance: string;
}

// Utilidad para convertir decimales a fracciones comunes para visualización
const formatFraction = (decimalStr: string) => {
    const val = parseFloat(decimalStr);
    if (isNaN(val)) return decimalStr;
    if (val === 0) return '0';
    
    const whole = Math.floor(val);
    const fraction = val - whole;
    
    let fractionStr = '';
    if (Math.abs(fraction - 0.25) < 0.01) fractionStr = '1/4';
    else if (Math.abs(fraction - 0.5) < 0.01) fractionStr = '1/2';
    else if (Math.abs(fraction - 0.75) < 0.01) fractionStr = '3/4';
    else if (fraction > 0) fractionStr = fraction.toFixed(2).replace('0.', '.');

    if (whole > 0 && fractionStr) {
        return `${whole} ${fractionStr}`;
    } else if (fractionStr) {
        return fractionStr;
    }
    return whole.toString();
};

const MateriaPrima: React.FC = () => {
    const [dailyInventory, setDailyInventory] = useState<DailyInventory[]>([]);
    const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

    // Forms
    const [newMaterial, setNewMaterial] = useState({ name: '', unit: 'Unidades', stock: '0' });
    const [incomeData, setIncomeData] = useState({ raw_material_id: '', amount: '' });
    const [linkData, setLinkData] = useState({ raw_material_id: '', product_id: '', quantity_used: '1' });
    const [editMaterial, setEditMaterial] = useState({ id: '', name: '', unit: '', previous_balance: '0', income: '0', usages: [] as RecipeItem[] });
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    
    // Confirm Dialog State
    const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [dailyRes, rawRes, prodRes] = await Promise.all([
                api.get('/api/restaurant/inventory/daily-inventory/'),
                api.get('/api/restaurant/inventory/raw-materials/'),
                api.get('/api/restaurant/menu/products/')
            ]);
            setDailyInventory(dailyRes.data.results || dailyRes.data);
            setRawMaterials(rawRes.data.results || rawRes.data);
            setProducts(prodRes.data.results || prodRes.data);
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/api/restaurant/inventory/raw-materials/', newMaterial);
            setIsAddModalOpen(false);
            setNewMaterial({ name: '', unit: 'Unidades', stock: '0' });
            fetchData();
        } catch (error) {
            console.error('Error:', error);
            alert('Error al crear materia prima');
        }
    };

    const handleUpdateMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.patch(`/api/restaurant/inventory/raw-materials/${editMaterial.id}/update_full/`, {
                name: editMaterial.name,
                unit: editMaterial.unit,
                previous_balance: editMaterial.previous_balance,
                income: editMaterial.income,
                usages: editMaterial.usages
            });
            setIsEditModalOpen(false);
            fetchData();
        } catch (error) {
            console.error('Error:', error);
            alert('Error al actualizar materia prima');
        }
    };

    const handleDeleteMaterial = async (id: string) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Eliminar Materia Prima',
            message: '¿Está seguro de eliminar esta materia prima? Se eliminará de todas las recetas vinculadas.',
            onConfirm: async () => {
                try {
                    await api.delete(`/api/restaurant/inventory/raw-materials/${id}/`);
                    fetchData();
                } catch (error) {
                    console.error('Error:', error);
                    alert('Error al eliminar materia prima');
                }
            }
        });
    };

    const handleDeleteUsage = async (id: string) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Eliminar Vinculación',
            message: '¿Eliminar esta vinculación?',
            onConfirm: async () => {
                try {
                    await api.delete(`/api/restaurant/inventory/recipe-items/${id}/`);
                    setEditMaterial(prev => ({
                        ...prev,
                        usages: prev.usages.filter(u => u.id !== id)
                    }));
                    fetchData();
                } catch (error) {
                    console.error('Error:', error);
                    alert('Error al eliminar vinculación');
                }
            }
        });
    };

    const handleAddIncome = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post(`/api/restaurant/inventory/raw-materials/${incomeData.raw_material_id}/add_income/`, {
                amount: incomeData.amount
            });
            setIsIncomeModalOpen(false);
            setIncomeData({ raw_material_id: '', amount: '' });
            fetchData();
        } catch (error) {
            console.error('Error:', error);
            alert('Error al registrar ingreso');
        }
    };

    const handleLinkProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/api/restaurant/inventory/recipe-items/', {
                raw_material: linkData.raw_material_id,
                product: linkData.product_id,
                quantity_used: linkData.quantity_used
            });
            setIsLinkModalOpen(false);
            setLinkData({ raw_material_id: '', product_id: '', quantity_used: '1' });
            fetchData();
        } catch (error) {
            console.error('Error:', error);
            alert('Error al vincular producto');
        }
    };

    // Combinar dailyInventory con rawMaterials para mostrar la tabla completa
    // Si no hay dailyInventory hoy, mostrar stock actual desde rawMaterials
    const tableData = rawMaterials.map(rm => {
        const daily = dailyInventory.find(d => d.raw_material === rm.id);
        return {
            id: rm.id,
            name: rm.name,
            unit: rm.unit,
            previous_balance: daily ? daily.previous_balance : rm.stock,
            income: daily ? daily.income : '0',
            consumption: daily ? daily.consumption : '0',
            current_balance: daily ? daily.current_balance : rm.stock,
            usages: rm.recipe_items || []
        };
    });

    if (loading) {
        return <div className="text-center py-10">Cargando inventario...</div>;
    }

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-800">Control de Materia Prima</h2>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
                    >
                        <i className="bi bi-plus" /> Nueva Materia
                    </button>
                    <button 
                        onClick={() => setIsIncomeModalOpen(true)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                    >
                        <i className="bi bi-box-arrow-in-down" /> Registrar Ingreso
                    </button>
                    <button 
                        onClick={() => setIsLinkModalOpen(true)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                    >
                        <i className="bi bi-link" /> Vincular a Producto
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[800px] text-sm text-center">
                    <thead className="bg-slate-50 border-y border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-left font-bold text-slate-600">MATERIA PRIMA</th>
                            <th className="px-4 py-3 font-bold text-slate-600">SALDO ANTERIOR</th>
                            <th className="px-4 py-3 font-bold text-emerald-600">INGRESO</th>
                            <th className="px-4 py-3 font-bold text-rose-600">CONSUMO</th>
                            <th className="px-4 py-3 font-bold text-slate-800">SALDO ACTUAL</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-600">USO (Productos)</th>
                            <th className="px-4 py-3 font-bold text-slate-600">ACCIONES</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {tableData.length === 0 ? (
                            <tr><td colSpan={6} className="py-8 text-slate-400">No hay materias primas registradas</td></tr>
                        ) : tableData.map(row => (
                            <tr key={row.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 text-left font-semibold text-slate-800">{row.name} <span className="text-xs text-slate-400 font-normal">({row.unit})</span></td>
                                <td className="px-4 py-3 text-slate-600">{formatFraction(row.previous_balance)}</td>
                                <td className="px-4 py-3 text-emerald-600 font-medium">{formatFraction(row.income) !== '0' ? formatFraction(row.income) : ''}</td>
                                <td className="px-4 py-3 text-rose-600 font-medium">{formatFraction(row.consumption) !== '0' ? formatFraction(row.consumption) : ''}</td>
                                <td className="px-4 py-3 font-bold text-slate-800">{formatFraction(row.current_balance)}</td>
                                <td className="px-4 py-3 text-left">
                                    <div className="flex flex-wrap gap-1">
                                        {row.usages.map(u => (
                                            <span key={u.id} className="text-[10px] px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                                                {u.product_name} <span className="opacity-70">({formatFraction(u.quantity_used)})</span>
                                            </span>
                                        ))}
                                        {row.usages.length === 0 && <span className="text-xs text-slate-400">-</span>}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex justify-center gap-2">
                                        <button 
                                            onClick={() => {
                                                setEditMaterial({ 
                                                    id: row.id, 
                                                    name: row.name, 
                                                    unit: row.unit,
                                                    previous_balance: row.previous_balance,
                                                    income: row.income,
                                                    usages: JSON.parse(JSON.stringify(row.usages))
                                                });
                                                setIsEditModalOpen(true);
                                            }}
                                            className="text-blue-500 hover:text-blue-700" title="Editar"
                                        >
                                            <i className="bi bi-pencil-square" />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteMaterial(row.id)}
                                            className="text-rose-500 hover:text-rose-700" title="Eliminar"
                                        >
                                            <i className="bi bi-trash" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal Nueva Materia */}
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Nueva Materia Prima">
                <form onSubmit={handleCreateMaterial} className="p-2">
                    <div className="mb-3">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Nombre</label>
                        <input required type="text" className="w-full p-2 border rounded" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} placeholder="Ej: Pechuga" />
                    </div>
                    <div className="mb-3">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Unidad de Medida</label>
                        <input required type="text" className="w-full p-2 border rounded" value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})} placeholder="Ej: Unidades, Kg, Gramos" />
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Stock Inicial</label>
                        <input required type="number" step="0.01" className="w-full p-2 border rounded" value={newMaterial.stock} onChange={e => setNewMaterial({...newMaterial, stock: e.target.value})} />
                    </div>
                    <div className="flex justify-end"><button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded">Guardar</button></div>
                </form>
            </Modal>

            {/* Modal Editar Materia */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar Materia Prima">
                <form onSubmit={handleUpdateMaterial} className="p-2">
                    <div className="mb-3">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Nombre</label>
                        <input required type="text" className="w-full p-2 border rounded" value={editMaterial.name} onChange={e => setEditMaterial({...editMaterial, name: e.target.value})} placeholder="Ej: Pechuga" />
                    </div>
                    <div className="mb-3">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Unidad de Medida</label>
                        <input required type="text" className="w-full p-2 border rounded" value={editMaterial.unit} onChange={e => setEditMaterial({...editMaterial, unit: e.target.value})} placeholder="Ej: Unidades, Kg, Gramos" />
                    </div>
                    <div className="mb-3">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Saldo Anterior</label>
                        <input required type="number" step="0.01" className="w-full p-2 border rounded" value={editMaterial.previous_balance} onChange={e => setEditMaterial({...editMaterial, previous_balance: e.target.value})} />
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Ingreso de Hoy</label>
                        <input required type="number" step="0.01" className="w-full p-2 border rounded" value={editMaterial.income} onChange={e => setEditMaterial({...editMaterial, income: e.target.value})} />
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-700 mb-2">Usos (Productos Vinculados)</label>
                        {editMaterial.usages.length === 0 ? (
                            <p className="text-xs text-slate-500">No hay productos vinculados.</p>
                        ) : (
                            <div className="space-y-2">
                                {editMaterial.usages.map((u, index) => (
                                    <div key={u.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded border border-slate-100">
                                        <span className="text-sm font-medium flex-1 truncate">{u.product_name}</span>
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            className="w-20 p-1 border rounded text-sm text-center" 
                                            value={u.quantity_used}
                                            onChange={(e) => {
                                                const newUsages = [...editMaterial.usages];
                                                newUsages[index].quantity_used = e.target.value;
                                                setEditMaterial({...editMaterial, usages: newUsages});
                                            }}
                                            title="Cantidad utilizada"
                                        />
                                        <button 
                                            type="button" 
                                            className="text-rose-500 hover:bg-rose-50 p-1.5 rounded flex items-center justify-center" 
                                            onClick={() => handleDeleteUsage(u.id)}
                                            title="Eliminar vinculación"
                                        >
                                            <i className="bi bi-trash"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end"><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Actualizar</button></div>
                </form>
            </Modal>

            {/* Modal Ingreso */}
            <Modal isOpen={isIncomeModalOpen} onClose={() => setIsIncomeModalOpen(false)} title="Registrar Ingreso">
                <form onSubmit={handleAddIncome} className="p-2">
                    <div className="mb-3">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Materia Prima</label>
                        <select required className="w-full p-2 border rounded" value={incomeData.raw_material_id} onChange={e => setIncomeData({...incomeData, raw_material_id: e.target.value})}>
                            <option value="">Seleccione...</option>
                            {rawMaterials.map(rm => <option key={rm.id} value={rm.id}>{rm.name}</option>)}
                        </select>
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Cantidad Ingresada</label>
                        <input required type="number" step="0.01" min="0.01" className="w-full p-2 border rounded" value={incomeData.amount} onChange={e => setIncomeData({...incomeData, amount: e.target.value})} />
                    </div>
                    <div className="flex justify-end"><button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded">Confirmar Ingreso</button></div>
                </form>
            </Modal>

            {/* Modal Vincular Uso */}
            <Modal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} title="Vincular a Producto (Uso)">
                <form onSubmit={handleLinkProduct} className="p-2">
                    <div className="mb-3">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Materia Prima</label>
                        <select required className="w-full p-2 border rounded" value={linkData.raw_material_id} onChange={e => setLinkData({...linkData, raw_material_id: e.target.value})}>
                            <option value="">Seleccione...</option>
                            {rawMaterials.map(rm => <option key={rm.id} value={rm.id}>{rm.name}</option>)}
                        </select>
                    </div>
                    <div className="mb-3">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Producto del Menú</label>
                        <select required className="w-full p-2 border rounded" value={linkData.product_id} onChange={e => setLinkData({...linkData, product_id: e.target.value})}>
                            <option value="">Seleccione...</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Cantidad a descontar por cada venta</label>
                        <input required type="number" step="0.01" min="0.01" className="w-full p-2 border rounded" value={linkData.quantity_used} onChange={e => setLinkData({...linkData, quantity_used: e.target.value})} />
                    </div>
                    <div className="flex justify-end"><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Vincular</button></div>
                </form>
            </Modal>

            {/* Modal Confirmación General */}
            <Modal isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog({...confirmDialog, isOpen: false})} title={confirmDialog.title}>
                <div className="p-4">
                    <p className="text-sm text-slate-700 mb-6">{confirmDialog.message}</p>
                    <div className="flex justify-end gap-2">
                        <button 
                            type="button" 
                            onClick={() => setConfirmDialog({...confirmDialog, isOpen: false})} 
                            className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded font-medium"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="button" 
                            onClick={() => {
                                confirmDialog.onConfirm();
                                setConfirmDialog({...confirmDialog, isOpen: false});
                            }} 
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium"
                        >
                            Confirmar
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default MateriaPrima;
