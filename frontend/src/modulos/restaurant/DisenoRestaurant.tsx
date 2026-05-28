import React from 'react';
import BarraNavegacion from '../../comun/BarraNavegacion';
import BarraLateralRestaurant from './BarraLateralRestaurant';

interface DisenoRestaurantProps {
  children: React.ReactNode;
}

const DisenoRestaurant: React.FC<DisenoRestaurantProps> = ({ children }) => {
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
