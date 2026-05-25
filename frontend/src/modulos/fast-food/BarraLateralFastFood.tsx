import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const BarraLateralFastFood: React.FC = () => {
    const location = useLocation();

    const isActive = (path: string): string => {
        return location.pathname === path
            ? 'bg-slate-800 text-white'
            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200';
    };

    const links = [
        { path: '/fast-food', label: 'Panel Principal', icon: 'bi-grid-fill' },
        { path: '/fast-food/pos', label: 'Punto de Venta', icon: 'bi-shop' },
        { path: '/fast-food/orders', label: 'Órdenes', icon: 'bi-list-ul' },
        { path: '/fast-food/inventory', label: 'Inventario', icon: 'bi-archive-fill' },
        { path: '/fast-food/customers', label: 'Clientes', icon: 'bi-people-fill' },
        { path: '/fast-food/shift', label: 'Caja (Turnos)', icon: 'bi-safe2-fill' },
    ];

    return (
        <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen border-r border-slate-800 flex-shrink-0 z-10 relative">
            <div className="p-5 text-lg font-bold border-b border-slate-800 bg-slate-950/80 tracking-wide text-slate-200 flex items-center gap-2">
                <i className="bi bi-lightning-fill text-slate-400"></i>
                <span>Fortaleza FF</span>
            </div>
            <ul className="p-4 space-y-1">
                {links.map((link) => (
                    <li key={link.path}>
                        <Link 
                            to={link.path} 
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide uppercase transition-all duration-200 ${isActive(link.path)}`}
                        >
                            <i className={`bi ${link.icon} text-sm`}></i>
                            <span>{link.label}</span>
                        </Link>
                    </li>
                ))}
            </ul>
            <div className="mt-auto p-4 border-t border-slate-800 text-center">
                <Link 
                    to="/" 
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800/55 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-[10px] font-bold tracking-wider uppercase text-slate-300 hover:text-white transition-all duration-200"
                >
                    <i className="bi bi-arrow-left"></i>
                    <span>Volver al Inicio</span>
                </Link>
            </div>
        </aside>
    );
};

export default BarraLateralFastFood;
