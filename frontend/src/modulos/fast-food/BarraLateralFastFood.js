import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const BarraLateralFastFood = () => {
    const location = useLocation();

    const isActive = (path) => {
        return location.pathname === path ? 'active' : '';
    };

    return (
        <aside className="sidebar" style={{ backgroundColor: '#2c3e50' }}>
            <div style={{ padding: '1rem', color: 'white', fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                Comida Rápida
            </div>
            <ul className="sidebar-nav">
                <li className={isActive('/fast-food')}>
                    <Link to="/fast-food">📊 Panel Principal</Link>
                </li>
                <li className={isActive('/fast-food/pos')}>
                    <Link to="/fast-food/pos">🛒 Punto de Venta</Link>
                </li>
                <li className={isActive('/fast-food/orders')}>
                    <Link to="/fast-food/orders">📝 Órdenes</Link>
                </li>
                <li className={isActive('/fast-food/inventory')}>
                    <Link to="/fast-food/inventory">📦 Inventario</Link>
                </li>
                <li className={isActive('/fast-food/reports')}>
                    <Link to="/fast-food/reports">📈 Reportes</Link>
                </li>
                <li className={isActive('/fast-food/printers')}>
                    <Link to="/fast-food/printers">🖨️ Impresoras</Link>
                </li>
            </ul>
        </aside>
    );
};

export default BarraLateralFastFood;
