import React from 'react';
import BarraNavegacion from './BarraNavegacion';
import BarraLateral from './BarraLateral';

const Diseno = ({ children }) => {
    return (
        <div className="layout">
            <BarraNavegacion />
            <div className="layout-body">
                <BarraLateral />
                <main className="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Diseno;
