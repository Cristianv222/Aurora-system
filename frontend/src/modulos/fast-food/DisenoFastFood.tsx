import React from 'react';
import BarraNavegacion from '../../comun/BarraNavegacion';
import BarraLateralFastFood from './BarraLateralFastFood';

interface DisenoFastFoodProps {
  children: React.ReactNode;
}

const DisenoFastFood: React.FC<DisenoFastFoodProps> = ({ children }) => {
  return (
    <div className="layout">
      <BarraNavegacion />
      <div className="layout-body">
        <BarraLateralFastFood />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DisenoFastFood;
