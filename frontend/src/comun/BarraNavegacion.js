import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const BarraNavegacion = () => {
    const { user, logout } = useContext(AuthContext);

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <h1>Aurora System</h1>
            </div>
            <div className="navbar-menu">
                <div className="navbar-user">
                    <span>Hola, {user?.username || 'Usuario'}</span>
                </div>
                <button onClick={logout} className="btn btn-outline btn-sm">
                    Cerrar Sesión
                </button>
            </div>
        </nav>
    );
};

export default BarraNavegacion;
