import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const BarraLateralRestaurant = () => {
    const location = useLocation();

    const isActive = (path) => {
        return location.pathname === path ? 'active' : '';
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                Restaurante
            </div>
            <ul className="sidebar-nav">
                <li className={isActive('/restaurant')}>
                    <Link to="/restaurant">Panel Principal</Link>
                </li>
                <li className={isActive('/restaurant/pos')}>
                    <Link to="/restaurant/pos">Punto de Venta</Link>
                </li>
                <li className={isActive('/restaurant/orders')}>
                    <Link to="/restaurant/orders">Órdenes</Link>
                </li>
                <li className={isActive('/restaurant/inventory')}>
                    <Link to="/restaurant/inventory">Inventario</Link>
                </li>
                <li className={isActive('/restaurant/customers')}>
                    <Link to="/restaurant/customers">Clientes</Link>
                </li>
                <li className={isActive('/restaurant/shift')}>
                    <Link to="/restaurant/shift">Caja (Turnos)</Link>
                </li>
            </ul>
        </aside>
    );
};

export default BarraLateralRestaurant;