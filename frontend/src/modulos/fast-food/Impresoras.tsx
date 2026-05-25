import React from 'react';

const Impresoras: React.FC = () => {
    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-6">
                <h3 className="text-xl font-bold text-slate-800">Gestión de Impresoras</h3>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-12 text-center">
                <svg className="w-14 h-14 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <p className="text-slate-800 font-semibold text-lg">Gestión de impresoras</p>
                <p className="text-slate-450 text-sm mt-1">Esta sección está en construcción.</p>
            </div>
        </div>
    );
};

export default Impresoras;
