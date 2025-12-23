import React from 'react';
import BarraLateral from './BarraLateral';

const Diseno = ({ children }) => {
    return (
        <div className="layout">
            <BarraLateral />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

export default Diseno;