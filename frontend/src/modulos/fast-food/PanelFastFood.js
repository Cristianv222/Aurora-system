import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../App.css';

const PanelFastFood = () => {
    const navigate = useNavigate();

    const modules = [
        { title: 'Reportes', path: '/fast-food/reports', color: '#3498db' },
        { title: 'Inventario', path: '/fast-food/inventory', color: '#2ecc71' },
        { title: 'Puntos de Venta', path: '/fast-food/pos', color: '#e67e22' },
        { title: 'Caja', path: '/fast-food/shift', color: '#f1c40f' },
        { title: 'Ordenes', path: '/fast-food/orders', color: '#9b59b6' },
        { title: 'Clientes', path: '/fast-food/customers', color: '#34495e' },
        { title: 'Impresoras', path: '/fast-food/printers', color: '#e74c3c' },
    ];

    return (
        <div className="page-container">
            <div className="page-header">
                <h2>Panel de Comida Rápida</h2>
            </div>

            <div className="dashboard-grid">
                {modules.map((mod, index) => (
                    <div
                        key={index}
                        className="dashboard-card"
                        onClick={() => navigate(mod.path)}
                        style={{ borderTop: `4px solid ${mod.color}` }}
                    >
                        <h3>{mod.title}</h3>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PanelFastFood;
