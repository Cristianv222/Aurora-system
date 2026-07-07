import React, { useContext, useState, useEffect } from 'react';
import Modal from './comun/Modal';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './modulos/login/Login';
import Diseno from './comun/Diseno';
import ListaUsuarios from './modulos/usuarios/ListaUsuarios';
import ServicePlaceholder from './components/ServicePlaceholder';

// Fast Food imports
import PanelFastFood from './modulos/fast-food/PanelFastFood';
import Inventario from './modulos/fast-food/Inventario';
import Ordenes from './modulos/fast-food/Ordenes';
import Clientes from './modulos/fast-food/Clientes';
import Reportes from './modulos/fast-food/Reportes';
import PuntosVenta from './modulos/fast-food/PuntosVenta';
import ShiftManager from './modulos/fast-food/ShiftManager';
import Impresoras from './modulos/fast-food/Impresoras';
import DisenoFastFood from './modulos/fast-food/DisenoFastFood';

// Restaurant imports
import PanelRestaurant from './modulos/restaurant/PanelRestaurant';
import InventarioRestaurant from './modulos/restaurant/Inventario';
import OrdenesRestaurant from './modulos/restaurant/Ordenes';
import ClientesRestaurant from './modulos/restaurant/Clientes';
import ReportesRestaurant from './modulos/restaurant/Reportes';
import PuntosVentaRestaurant from './modulos/restaurant/PuntosVenta';
import ShiftManagerRestaurant from './modulos/restaurant/ShiftManager';
import ImpresorasRestaurant from './modulos/restaurant/Impresoras';
import DisenoRestaurant from './modulos/restaurant/DisenoRestaurant';
import ReservacionesRestaurant from './modulos/restaurant/Reservaciones';

// Hotel imports
import PanelHotel from './modulos/hotel/PanelHotel';
import ReservaPublica from './modulos/hotel/ReservaPublica';

import './App.css';
import ToastContainer from './components/ToastContainer';


interface RouteProps {
  children: React.ReactNode;
}

// Componente para proteger rutas
const PrivateRoute: React.FC<RouteProps> = ({ children }) => {
  const context = useContext(AuthContext);
  if (!context) return null;
  const { user, loading } = context;

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <Diseno>{children}</Diseno>;
};

// Componente para proteger rutas de Comida Rápida con su propio diseño
const FastFoodRoute: React.FC<RouteProps> = ({ children }) => {
  const context = useContext(AuthContext);
  if (!context) return null;
  const { user, loading } = context;

  if (loading) return <div>Cargando...</div>;
  if (!user) return <Navigate to="/login" />;

  // Si es Super Admin (por rol o por flag de superusuario), mantener el diseño general
  const isSuperAdmin = (user as any).role_details?.name === 'SUPER_ADMIN' || (user as any).is_superuser;
  if (isSuperAdmin) {
    return <Diseno>{children}</Diseno>;
  }

  // Si es otro rol (ej. Admin Fast Food), usar el diseño específico
  return <DisenoFastFood>{children}</DisenoFastFood>;
};

// Componente para proteger rutas de Restaurante con su propio diseño
const RestaurantRoute: React.FC<RouteProps> = ({ children }) => {
  const context = useContext(AuthContext);
  if (!context) return null;
  const { user, loading } = context;

  if (loading) return <div>Cargando...</div>;
  if (!user) return <Navigate to="/login" />;

  // Si es Super Admin (por rol o por flag de superusuario), mantener el diseño general
  const isSuperAdmin = (user as any).role_details?.name === 'SUPER_ADMIN' || (user as any).is_superuser;
  if (isSuperAdmin) {
    return <Diseno>{children}</Diseno>;
  }

  // Si es otro rol (ej. Admin Restaurant), usar el diseño específico
  return <DisenoRestaurant>{children}</DisenoRestaurant>;
};

// Dashboard simple
const Dashboard: React.FC = () => (
  <div className="page-container">
    <h2>Bienvenido al Panel de Control</h2>
    <p>Seleccione una opción del menú lateral para comenzar.</p>
  </div>
);

function AppContent(): JSX.Element {
  const context = useContext(AuthContext);
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    if (context?.user && !sessionStorage.getItem('aurora_notice_seen')) {
      setShowNotice(true);
    }
  }, [context?.user]);

  const handleCloseNotice = () => {
    sessionStorage.setItem('aurora_notice_seen', '1');
    setShowNotice(false);
  };

  return (
    <Modal isOpen={showNotice} onClose={handleCloseNotice} title="Novedades del Sistema">
      <div className="space-y-4 text-sm text-slate-700">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <i className="bi bi-exclamation-triangle-fill text-amber-500 text-lg mt-0.5 shrink-0"></i>
            <div>
              <p className="font-bold text-amber-800 mb-1">Posibles intermitencias</p>
              <p className="text-amber-700 text-xs leading-relaxed">El sistema puede presentar comportamientos inesperados o lentitud ocasional durante los proximos dias. Si experimenta algun problema, por favor cierre sesion, vuelva a ingresar e intente de nuevo.</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <i className="bi bi-building-fill text-blue-500 text-lg mt-0.5 shrink-0"></i>
            <div>
              <p className="font-bold text-blue-800 mb-1">Nuevo modulo — Hotel Aurora</p>
              <p className="text-blue-700 text-xs leading-relaxed">Se ha incorporado el modulo de gestion hotelera con reservas, habitaciones y turnos de caja. Al ser una funcionalidad nueva, puede requerir ajustes adicionales.</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <i className="bi bi-headset text-slate-500 text-lg mt-0.5 shrink-0"></i>
            <div>
              <p className="font-bold text-slate-700 mb-1">Tiene algun problema?</p>
              <p className="text-slate-600 text-xs leading-relaxed">Comuniquese con soporte tecnico de FronteraTech. Estamos disponibles para ayudarle.</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleCloseNotice}
          className="w-full py-2.5 bg-slate-900 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl transition-colors"
        >
          Entendido
        </button>
      </div>
    </Modal>
  );
}

function App(): JSX.Element {
  return (
    <AuthProvider>
      <ToastContainer />
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
              <PanelHotel />
            </PrivateRoute>
          } />

          <Route path="/reserva/:code" element={<ReservaPublica />} />

          <Route path="/pool" element={
            <PrivateRoute>
              <ServicePlaceholder title="Piscinas" />
            </PrivateRoute>
          } />

          {/* Rutas de Restaurante */}
          <Route path="/restaurant" element={
            <RestaurantRoute>
              <PanelRestaurant />
            </RestaurantRoute>
          } />
          <Route path="/restaurant/inventory" element={
            <RestaurantRoute>
              <InventarioRestaurant />
            </RestaurantRoute>
          } />
          <Route path="/restaurant/orders" element={
            <RestaurantRoute>
              <OrdenesRestaurant />
            </RestaurantRoute>
          } />
          <Route path="/restaurant/customers" element={
            <RestaurantRoute>
              <ClientesRestaurant />
            </RestaurantRoute>
          } />
          <Route path="/restaurant/reports" element={
            <RestaurantRoute>
              <ReportesRestaurant />
            </RestaurantRoute>
          } />
          <Route path="/restaurant/pos" element={
            <RestaurantRoute>
              <PuntosVentaRestaurant />
            </RestaurantRoute>
          } />
          <Route path="/restaurant/shift" element={
            <RestaurantRoute>
              <ShiftManagerRestaurant onShiftActive={() => { }} />
            </RestaurantRoute>
          } />
          <Route path="/restaurant/printers" element={
            <RestaurantRoute>
              <ImpresorasRestaurant />
            </RestaurantRoute>
          } />
          <Route path="/restaurant/reservations" element={
            <RestaurantRoute>
              <ReservacionesRestaurant />
            </RestaurantRoute>
          } />

          {/* Redirigir cualquier otra ruta al inicio */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
