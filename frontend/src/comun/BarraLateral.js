import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const BarraLateral = () => {
    const location = useLocation();

    const isActive = (path) => {
        return location.pathname === path ? 'active' : '';
    };

    return (
        <aside className="sidebar">
            <ul className="sidebar-nav">
                <li className={isActive('/')}>
                    <Link to="/">Inicio</Link>
                </li>
                <li className={isActive('/users') || location.pathname.startsWith('/users')}>
                    <Link to="/users">Gestión de Usuarios</Link>
                </li>
                {/* Aquí se pueden agregar más enlaces para otros servicios */}
                <li>
                    <Link to="/fast-food">Comida Rápida</Link>
                </li>
                <li>
                    <Link to="/hotel">Hotel</Link>
                </li>
                <li>
                    <Link to="/pool">Piscinas</Link>
                </li>
                <li>
                    <Link to="/restaurant">Restaurante</Link>
                </li>
            </ul>
        </aside>
    );
};

export default BarraLateral;
