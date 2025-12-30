import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const BarraLateralFastFood = () => {
    const location = useLocation();

    const isActive = (path) => {
        return location.pathname === path ? 'active' : '';
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                Comida Rápida
            </div>
            <ul className="sidebar-nav">
                <li className={isActive('/fast-food')}>
                    <Link to="/fast-food">Panel Principal</Link>
                </li>
                <li className={isActive('/fast-food/pos')}>
                    <Link to="/fast-food/pos">Punto de Venta</Link>
                </li>
                <li className={isActive('/fast-food/orders')}>
                    <Link to="/fast-food/orders">Órdenes</Link>
                </li>
                <li className={isActive('/fast-food/inventory')}>
                    <Link to="/fast-food/inventory">Inventario</Link>
                </li>
                <li className={isActive('/fast-food/customers')}>
                    <Link to="/fast-food/customers">Clientes</Link>
                </li>
                <li className={isActive('/fast-food/shift')}>
                    <Link to="/fast-food/shift">Caja (Turnos)</Link>
                </li>
            </ul>
        </aside>
    );
};

export default BarraLateralFastFood;