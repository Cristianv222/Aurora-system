import React from 'react';
import { useNavigate } from 'react-router-dom';

const PanelFastFood = () => {
    const navigate = useNavigate();

    const quickAccess = [
        {
            title: 'Punto de Venta',
            description: 'Gestionar ventas y órdenes en tiempo real',
            path: '/fast-food/pos',
            icon: 'bi-cart-check-fill',
            color: '#0d6efd'
        },
        {
            title: 'Órdenes',
            description: 'Ver y gestionar todas las órdenes',
            path: '/fast-food/orders',
            icon: 'bi-receipt-cutoff',
            color: '#6610f2'
        },
        {
            title: 'Inventario',
            description: 'Administrar productos y stock',
            path: '/fast-food/inventory',
            icon: 'bi-box-seam-fill',
            color: '#198754'
        },
        {
            title: 'Caja',
            description: 'Gestión de turnos y efectivo',
            path: '/fast-food/shift',
            icon: 'bi-cash-coin',
            color: '#fd7e14'
        },
        {
            title: 'Reportes',
            description: 'Análisis y estadísticas de ventas',
            path: '/fast-food/reports',
            icon: 'bi-graph-up-arrow',
            color: '#20c997'
        }
    ];

    const infoCards = [
        {
            icon: 'bi-lightning-charge-fill',
            title: 'Acceso Rápido',
            description: 'Navega fácilmente entre módulos',
            color: '#ffc107'
        },
        {
            icon: 'bi-shield-check',
            title: 'Sistema Seguro',
            description: 'Datos protegidos y encriptados',
            color: '#28a745'
        },
        {
            icon: 'bi-clock-history',
            title: 'Tiempo Real',
            description: 'Información actualizada al instante',
            color: '#17a2b8'
        }
    ];

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#f0f2f5',
            padding: '2rem'
        }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

                {/* Header Section */}
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '2.5rem',
                    marginBottom: '2rem',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center'
                }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '80px',
                        height: '80px',
                        backgroundColor: '#e7f1ff',
                        borderRadius: '18px',
                        marginBottom: '1.5rem'
                    }}>
                        <i className="bi bi-shop" style={{
                            fontSize: '2.75rem',
                            color: '#0d6efd'
                        }}></i>
                    </div>
                    <h1 style={{
                        fontSize: '2rem',
                        fontWeight: '700',
                        color: '#1a1a2e',
                        marginBottom: '0.75rem',
                        letterSpacing: '-0.02em'
                    }}>
                        Panel de Comida Rápida
                    </h1>
                    <p style={{
                        fontSize: '1.125rem',
                        color: '#6c757d',
                        margin: 0,
                        fontWeight: '400'
                    }}>
                        Accede rápidamente a las funciones principales del sistema
                    </p>
                </div>

                {/* Quick Access Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: '1.5rem',
                    marginBottom: '2rem'
                }}>
                    {quickAccess.map((item, index) => (
                        <div
                            key={index}
                            onClick={() => navigate(item.path)}
                            style={{
                                backgroundColor: '#ffffff',
                                borderRadius: '16px',
                                padding: '1.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                                border: '2px solid transparent',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-8px)';
                                e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.12)';
                                e.currentTarget.style.borderColor = item.color;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                                e.currentTarget.style.borderColor = 'transparent';
                            }}
                        >
                            {/* Top colored bar */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '4px',
                                backgroundColor: item.color
                            }}></div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1.25rem'
                            }}>
                                {/* Icon */}
                                <div style={{
                                    width: '72px',
                                    height: '72px',
                                    backgroundColor: `${item.color}15`,
                                    borderRadius: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <i className={item.icon} style={{
                                        fontSize: '2.25rem',
                                        color: item.color
                                    }}></i>
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h5 style={{
                                        fontSize: '1.25rem',
                                        fontWeight: '600',
                                        color: '#1a1a2e',
                                        marginBottom: '0.5rem',
                                        letterSpacing: '-0.01em'
                                    }}>
                                        {item.title}
                                    </h5>
                                    <p style={{
                                        fontSize: '0.9375rem',
                                        color: '#6c757d',
                                        margin: 0,
                                        lineHeight: '1.5'
                                    }}>
                                        {item.description}
                                    </p>
                                </div>

                                {/* Arrow */}
                                <div style={{ flexShrink: 0 }}>
                                    <i className="bi bi-arrow-right-circle" style={{
                                        fontSize: '1.75rem',
                                        color: item.color,
                                        transition: 'transform 0.3s'
                                    }}></i>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Info Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1.5rem'
                }}>
                    {infoCards.map((card, index) => (
                        <div
                            key={index}
                            style={{
                                backgroundColor: '#ffffff',
                                borderRadius: '16px',
                                padding: '2rem',
                                textAlign: 'center',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                                transition: 'all 0.3s',
                                cursor: 'default'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                            }}
                        >
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '72px',
                                height: '72px',
                                backgroundColor: `${card.color}15`,
                                borderRadius: '14px',
                                marginBottom: '1.25rem'
                            }}>
                                <i className={card.icon} style={{
                                    fontSize: '2.25rem',
                                    color: card.color
                                }}></i>
                            </div>
                            <h6 style={{
                                fontSize: '1.125rem',
                                fontWeight: '600',
                                color: '#1a1a2e',
                                marginBottom: '0.5rem'
                            }}>
                                {card.title}
                            </h6>
                            <p style={{
                                fontSize: '0.9375rem',
                                color: '#6c757d',
                                margin: 0,
                                lineHeight: '1.5'
                            }}>
                                {card.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PanelFastFood;