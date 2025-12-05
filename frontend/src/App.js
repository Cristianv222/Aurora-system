import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './modulos/login/Login';
import Diseno from './comun/Diseno';
import ListaUsuarios from './modulos/usuarios/ListaUsuarios';
import ServicePlaceholder from './components/ServicePlaceholder';
import PanelFastFood from './modulos/fast-food/PanelFastFood';
import Inventario from './modulos/fast-food/Inventario';
import Ordenes from './modulos/fast-food/Ordenes';
import Clientes from './modulos/fast-food/Clientes';
import Reportes from './modulos/fast-food/Reportes';
import PuntosVenta from './modulos/fast-food/PuntosVenta';
import ShiftManager from './modulos/fast-food/ShiftManager';
import Impresoras from './modulos/fast-food/Impresoras';
import DisenoFastFood from './modulos/fast-food/DisenoFastFood';
import './App.css';

// Componente para proteger rutas
const PrivateRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <Diseno>{children}</Diseno>;
};

// Componente para proteger rutas de Comida Rápida con su propio diseño
const FastFoodRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <div>Cargando...</div>;
  if (!user) return <Navigate to="/login" />;

  // Si es Super Admin (por rol o por flag de superusuario), mantener el diseño general
  if (user.role_details?.name === 'SUPER_ADMIN' || user.is_superuser) {
    return <Diseno>{children}</Diseno>;
  }

  // Si es otro rol (ej. Admin Fast Food), usar el diseño específico
  return <DisenoFastFood>{children}</DisenoFastFood>;
};

// Dashboard simple
const Dashboard = () => (
  <div className="page-container">
    <h2>Bienvenido al Panel de Control</h2>
    <p>Seleccione una opción del menú lateral para comenzar.</p>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />

          <Route path="/users" element={
            <PrivateRoute>
              <ListaUsuarios />
            </PrivateRoute>
          } />

          {/* Rutas de creación/edición eliminadas porque ahora son Modales */}

          <Route path="/fast-food" element={
            <FastFoodRoute>
              <PanelFastFood />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/inventory" element={
            <FastFoodRoute>
              <Inventario />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/orders" element={
            <FastFoodRoute>
              <Ordenes />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/customers" element={
            <FastFoodRoute>
              <Clientes />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/reports" element={
            <FastFoodRoute>
              <Reportes />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/pos" element={
            <FastFoodRoute>
              <PuntosVenta />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/shift" element={
            <FastFoodRoute>
              <ShiftManager onShiftActive={() => { }} />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/printers" element={
            <FastFoodRoute>
              <Impresoras />
            </FastFoodRoute>
          } />

          <Route path="/hotel" element={
            <PrivateRoute>
              <ServicePlaceholder title="Hotel" />
            </PrivateRoute>
          } />

          <Route path="/pool" element={
            <PrivateRoute>
              <ServicePlaceholder title="Piscinas" />
            </PrivateRoute>
          } />

          <Route path="/restaurant" element={
            <PrivateRoute>
              <ServicePlaceholder title="Restaurante" />
            </PrivateRoute>
          } />

          {/* Redirigir cualquier otra ruta al inicio */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
