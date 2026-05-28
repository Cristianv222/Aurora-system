import React from 'react';

interface ServicePlaceholderProps {
  title: string;
}

const ServicePlaceholder: React.FC<ServicePlaceholderProps> = ({ title }) => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="border-b border-slate-200 pb-4 mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
          <i className="bi bi-tools text-2xl"></i>
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-1">Módulo en Construcción</h3>
        <p className="text-sm text-slate-500">Estamos trabajando en esta sección. Muy pronto estará disponible.</p>
      </div>
    </div>
  );
};

export default ServicePlaceholder;
