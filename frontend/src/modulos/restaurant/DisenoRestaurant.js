import React from 'react';
import BarraNavegacion from '../../comun/BarraNavegacion';
import BarraLateralRestaurant from './BarraLateralRestaurant';

const DisenoRestaurant = ({ children }) => {
    return (
        <div className="layout">
            <BarraNavegacion />
            <div className="layout-body">
                <BarraLateralRestaurant />
                <main className="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default DisenoRestaurant;
