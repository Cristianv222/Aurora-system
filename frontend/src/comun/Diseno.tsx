import React from 'react';
import BarraLateral from './BarraLateral';

interface DisenoProps {
  children: React.ReactNode;
}

const Diseno: React.FC<DisenoProps> = ({ children }) => {
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
