import React from 'react';

const ServicePlaceholder = ({ title }) => {
    return (
        <div className="page-container">
            <div className="page-header">
                <h2>{title}</h2>
            </div>
            <div className="card">
                <p>Este módulo está en construcción.</p>
            </div>
        </div>
    );
};

export default ServicePlaceholder;
