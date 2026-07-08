import React, { useContext, useState, useEffect } from 'react';
import Modal from './comun/Modal';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
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

// Dashboard Portal Interactivo
const Dashboard: React.FC = () => {
  const context = useContext(AuthContext);
  const user = context?.user;
  const navigate = useNavigate();

  // Local state for Notes Board so it is collaborative and persists
  const [notes, setNotes] = useState<string[]>(() => {
    const saved = localStorage.getItem('aurora_dashboard_notes');
    return saved ? JSON.parse(saved) : [
      "Lavandería entrega sábanas limpias a las 11:00 AM.",
      "Huésped de la Hab 102 solicitó taxi para mañana a las 7:00 AM.",
      "Entregar llaves de oficina al administrador al final del turno."
    ];
  });
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    localStorage.setItem('aurora_dashboard_notes', JSON.stringify(notes));
  }, [notes]);

  const addNote = () => {
    if (newNote.trim()) {
      setNotes([...notes, newNote.trim()]);
      setNewNote('');
    }
  };

  const deleteNote = (index: number) => {
    setNotes(notes.filter((_, i) => i !== index));
  };

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Buenos días";
    if (hr < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col justify-between max-w-6xl mx-auto p-6 relative">
      
      {/* Main Content Area */}
      <div className="space-y-8 flex-1">
        
        {/* Welcome Header - Open & Clean */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-4 text-left">
            {/* Normal logo in original colors */}
            <img src="/logo-aurora.png" alt="Aurora System" className="h-10 md:h-12 object-contain" />
            
            {/* Divider line */}
            <div className="hidden md:block w-px h-8 bg-slate-300"></div>

            <div className="space-y-0.5">
              <span className="text-[9px] uppercase font-black tracking-widest text-[#1a2e4a] font-mono">Panel Principal</span>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight capitalize">
                {getGreeting()}, {user?.first_name ? `${user.first_name}` : user?.username || 'Usuario'}
              </h2>
              <p className="text-slate-500 text-[10px] font-semibold">Aurora System · Centro de control general de operaciones</p>
            </div>
          </div>
        </div>

        {/* Main Grid: Modules & Sticky Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left / Center Panel: Modules Access */}
          <div className="lg:col-span-2 space-y-4 text-left">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <i className="bi bi-grid-fill text-[#1a2e4a]"></i> Módulos y Áreas de Trabajo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Hotel Park */}
              <div 
                onClick={() => navigate('/hotel')}
                className="bg-white hover:bg-slate-50 border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all hover:scale-[1.01] flex items-start gap-4 group"
              >
                <div className="p-3.5 bg-[#1a2e4a]/5 text-[#1a2e4a] rounded-2xl group-hover:scale-110 group-hover:bg-[#1a2e4a]/10 transition-all">
                  <i className="bi bi-building-fill text-xl"></i>
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-slate-950">Hotel Park</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">Gestión de habitaciones, reservas, ingresos de huéspedes (check-in/out) y turnos de recepcionistas.</p>
                </div>
              </div>

              {/* Kroky */}
              <div 
                onClick={() => navigate('/fast-food')}
                className="bg-white hover:bg-slate-50 border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all hover:scale-[1.01] flex items-start gap-4 group"
              >
                <div className="p-3.5 bg-[#1a2e4a]/5 text-[#1a2e4a] rounded-2xl group-hover:scale-110 group-hover:bg-[#1a2e4a]/10 transition-all">
                  <i className="bi bi-egg-fried text-xl"></i>
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-slate-950">Kroky (Comida Rápida)</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">Punto de venta POS de servicio rápido, control de órdenes de comida, inventario e insumos.</p>
                </div>
              </div>

              {/* Fortaleza */}
              <div 
                onClick={() => navigate('/restaurant')}
                className="bg-white hover:bg-slate-50 border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all hover:scale-[1.01] flex items-start gap-4 group"
              >
                <div className="p-3.5 bg-[#1a2e4a]/5 text-[#1a2e4a] rounded-2xl group-hover:scale-110 group-hover:bg-[#1a2e4a]/10 transition-all">
                  <i className="bi bi-shield-fill text-xl"></i>
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-slate-950">Fortaleza (Restaurante)</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">Módulo de mesas y meseros para restaurante a la carta, reservas de mesas y facturación integrada.</p>
                </div>
              </div>

              {/* Usuarios */}
              <div 
                onClick={() => navigate('/users')}
                className="bg-white hover:bg-slate-50 border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all hover:scale-[1.01] flex items-start gap-4 group"
              >
                <div className="p-3.5 bg-[#1a2e4a]/5 text-[#1a2e4a] rounded-2xl group-hover:scale-110 group-hover:bg-[#1a2e4a]/10 transition-all">
                  <i className="bi bi-people-fill text-xl"></i>
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-slate-950">Control de Usuarios</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">Configuración de credenciales de acceso, asignación de roles (recepcionista, administrador) y permisos.</p>
                </div>
              </div>

            </div>
          </div>

          {/* Right Panel: Sticky Notes (Bitácora de Turnos) */}
          <div className="space-y-4 text-left">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <i className="bi bi-journal-text text-[#1a2e4a]"></i> Novedades y Pendientes
            </h3>
            
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between min-h-[300px]">
              {/* Notes List */}
              <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                {notes.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 italic text-[11px] bg-white border border-slate-150 rounded-2xl">
                    No hay novedades registradas.
                  </div>
                ) : (
                  notes.map((note, index) => (
                    <div key={index} className="bg-white border border-slate-150 border-l-4 border-l-[#1a2e4a] rounded-2xl p-3.5 shadow-sm flex justify-between items-start gap-2 hover:border-slate-350 transition-all hover:scale-[1.01]">
                      <div className="space-y-1 text-left">
                        <p className="text-xs text-slate-700 leading-relaxed font-semibold">{note}</p>
                        <span className="text-[9px] text-slate-400 block font-medium"><i className="bi bi-clock mr-0.5"></i> Registro de Turno</span>
                      </div>
                      <button 
                        onClick={() => deleteNote(index)}
                        className="text-slate-350 hover:text-rose-600 text-xs shrink-0 p-0.5 transition-colors"
                        title="Marcar como Completado"
                      >
                        <i className="bi bi-check2-circle text-base"></i>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Input to add notes */}
              <div className="border-t border-slate-200 pt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Añadir novedad..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addNote()}
                  className="flex-1 border border-slate-350 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white text-slate-800"
                />
                <button
                  onClick={addNote}
                  className="bg-[#1a2e4a] hover:bg-[#243b5e] text-white font-bold px-3.5 py-2 rounded-xl text-xs transition"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Footer Support Info */}
      <div className="mt-8 border-t border-slate-200 pt-5 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-3">
        <span className="font-semibold">FronteraTech Soporte Técnico: <a href="mailto:soporte@fronteratech.com" className="text-indigo-600 underline">soporte@fronteratech.com</a></span>
        <span>Aurora System v1.0.0 — Todos los derechos reservados</span>
      </div>

    </div>
  );
};

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
