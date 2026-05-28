import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const BarraNavegacion: React.FC = () => {
  const context = useContext(AuthContext);
  const user = context?.user;

  return (
    <nav className="h-14 bg-white border-b border-slate-200 px-6 flex justify-between items-center shadow-sm z-30 relative">
      {/* Branding / Module Info */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
          Aurora Control Panel
        </span>
      </div>

      {/* User Session Info */}
      {user && (
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-800">
              {user.first_name ? `${user.first_name} ${user.last_name}` : user.email}
            </p>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
              {user.role?.name || 'User'}
            </p>
          </div>
          
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 text-white flex items-center justify-center font-bold text-sm border-2 border-slate-100 shadow-sm">
            {user.first_name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
    </nav>
  );
};

export default BarraNavegacion;
