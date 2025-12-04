import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../App.css';

const PanelFastFood = () => {
    const navigate = useNavigate();

    const modules = [
        { title: 'Reportes', path: '/fast-food/reports', icon: '📊', color: '#3498db' },
        { title: 'Inventario', path: '/fast-food/inventory', icon: '📦', color: '#2ecc71' },
        { title: 'Puntos de Venta', path: '/fast-food/pos', icon: '🛒', color: '#e67e22' },
        { title: 'Ordenes', path: '/fast-food/orders', icon: '📝', color: '#9b59b6' },
        { title: 'Impresoras', path: '/fast-food/printers', icon: '🖨️', color: '#e74c3c' },
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
                        style={{ borderTop: `4px solid ${mod.color}`, cursor: 'pointer' }}
                    >
                        <div className="card-icon" style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                            {mod.icon}
                        </div>
                        <h3>{mod.title}</h3>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PanelFastFood;
