import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PanelFastFood = () => {
    const navigate = useNavigate();
    const [showWip, setShowWip] = useState(false);

    const quickAccess = [
        {
            title: 'Punto de Venta',
            description: 'Gestionar ventas y órdenes en tiempo real',
            path: '/fast-food/pos',
            icon: 'bi-cart-check-fill',
        },
        {
            title: 'Órdenes',
            description: 'Ver y gestionar todas las órdenes activas',
            path: '/fast-food/orders',
            icon: 'bi-receipt-cutoff',
        },
        {
            title: 'Inventario',
            description: 'Administrar productos y stock disponible',
            path: '/fast-food/inventory',
            icon: 'bi-box-seam-fill',
        },
        {
            title: 'Clientes',
            description: 'Gestión de clientes y fidelización',
            path: '/fast-food/customers',
            icon: 'bi-people-fill',
        },
        {
            title: 'Reportes',
            description: 'Análisis y estadísticas de ventas',
            path: '/fast-food/reports',
            icon: 'bi-graph-up-arrow',
        },
        {
            title: 'Impresoras',
            description: 'Configurar dispositivos de impresión',
            path: '/fast-food/printers',
            icon: 'bi-printer-fill',
        },
        {
            title: 'Facturación Electrónica',
            description: 'Emisión de comprobantes electrónicos SRI',
            icon: 'bi-file-earmark-check-fill',
            wip: true,
        },
    ];

    return (
        <>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
            <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

            <style>{`
                *, *::before, *::after { box-sizing: border-box; }

                .pff-page {
                    font-family: 'Sora', sans-serif;
                    padding: 28px;
                    background: #f0f4f9;
                    min-height: 100vh;
                }

                /* HEADER */
                .pff-header {
                    background: linear-gradient(160deg, #1a2e4a 0%, #243b5e 55%, #2c4f7c 100%);
                    border-radius: 18px;
                    padding: 32px 36px;
                    margin-bottom: 28px;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 8px 32px rgba(26,46,74,0.18);
                }
                .pff-header::before {
                    content: '';
                    position: absolute;
                    width: 300px; height: 300px;
                    border-radius: 50%;
                    border: 50px solid rgba(255,255,255,0.04);
                    top: -100px; right: -80px;
                    pointer-events: none;
                }
                .pff-header::after {
                    content: '';
                    position: absolute;
                    width: 200px; height: 200px;
                    border-radius: 50%;
                    border: 40px solid rgba(255,255,255,0.04);
                    bottom: -60px; left: 40%;
                    pointer-events: none;
                }
                .pff-header-icon {
                    width: 64px; height: 64px;
                    background: rgba(255,255,255,0.12);
                    border: 1.5px solid rgba(255,255,255,0.18);
                    border-radius: 16px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.8rem; color: #fff;
                    flex-shrink: 0;
                }
                .pff-header-text h1 {
                    font-size: 1.5rem; font-weight: 700;
                    color: #fff; margin: 0 0 6px;
                    letter-spacing: -0.02em;
                }
                .pff-header-text p {
                    font-size: 0.82rem; color: rgba(255,255,255,0.6);
                    margin: 0;
                }

                /* SECTION LABEL */
                .pff-section-label {
                    font-size: 0.68rem;
                    font-weight: 600;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: #6b87a8;
                    margin-bottom: 14px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .pff-section-label::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: #dce8f5;
                }

                /* GRID */
                .pff-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 16px;
                    margin-bottom: 32px;
                }

                /* CARD */
                .pff-card {
                    background: #fff;
                    border: 1.5px solid #dce8f5;
                    border-radius: 16px;
                    padding: 22px 20px;
                    cursor: pointer;
                    transition: transform .2s, box-shadow .2s, border-color .2s;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    position: relative;
                    overflow: hidden;
                }
                .pff-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 8px 28px rgba(26,46,74,0.12);
                    border-color: #b8d0ea;
                }
                .pff-card.wip {
                    border-style: dashed;
                    border-color: #dce8f5;
                    background: #fafcff;
                }
                .pff-card.wip:hover {
                    border-color: #f59e0b;
                    box-shadow: 0 8px 28px rgba(245,158,11,0.1);
                }

                /* barra izquierda de color */
                .pff-card::before {
                    content: '';
                    position: absolute;
                    left: 0; top: 16px; bottom: 16px;
                    width: 3px;
                    border-radius: 0 3px 3px 0;
                    background: linear-gradient(180deg, #1a2e4a, #2c4f7c);
                    opacity: 0;
                    transition: opacity .2s;
                }
                .pff-card:hover::before { opacity: 1; }
                .pff-card.wip::before { background: linear-gradient(180deg, #f59e0b, #d97706); }

                .pff-card-icon {
                    width: 52px; height: 52px;
                    border-radius: 13px;
                    background: #eef3fa;
                    color: #2c4f7c;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.3rem;
                    flex-shrink: 0;
                    transition: background .2s, color .2s;
                }
                .pff-card:hover .pff-card-icon {
                    background: linear-gradient(135deg, #1a2e4a, #2c4f7c);
                    color: #fff;
                }
                .pff-card.wip .pff-card-icon {
                    background: #fef9ee;
                    color: #d97706;
                }
                .pff-card.wip:hover .pff-card-icon {
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                    color: #fff;
                }

                .pff-card-body { flex: 1; min-width: 0; }
                .pff-card-title {
                    font-size: 0.88rem; font-weight: 600;
                    color: #1a2e4a; margin-bottom: 3px;
                }
                .pff-card-desc {
                    font-size: 0.75rem; color: #6b87a8; line-height: 1.4;
                }

                .pff-card-arrow {
                    color: #b8d0ea; font-size: 1rem; flex-shrink: 0;
                    transition: color .2s, transform .2s;
                }
                .pff-card:hover .pff-card-arrow {
                    color: #2c4f7c;
                    transform: translateX(3px);
                }
                .pff-card.wip .pff-card-arrow { color: #f59e0b; }

                .pff-wip-badge {
                    position: absolute;
                    top: 10px; right: 10px;
                    background: #fef9ee;
                    border: 1px solid #fde68a;
                    color: #d97706;
                    font-size: 0.6rem;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    padding: 2px 8px;
                    border-radius: 20px;
                }

                /* INFO CARDS */
                .pff-info-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 14px;
                }
                .pff-info-card {
                    background: #fff;
                    border: 1.5px solid #dce8f5;
                    border-radius: 14px;
                    padding: 20px 18px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }
                .pff-info-icon {
                    width: 42px; height: 42px;
                    border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.1rem; flex-shrink: 0;
                }
                .pff-info-icon.i1 { background: #eef3fa; color: #1a2e4a; }
                .pff-info-icon.i2 { background: #f0fdf4; color: #16a34a; }
                .pff-info-icon.i3 { background: #eff6ff; color: #2563eb; }
                .pff-info-title {
                    font-size: 0.8rem; font-weight: 600; color: #1a2e4a;
                }
                .pff-info-desc {
                    font-size: 0.7rem; color: #6b87a8; margin-top: 2px;
                }

                /* WIP MODAL */
                .pff-wip-overlay {
                    position: fixed; inset: 0;
                    background: rgba(26,46,74,.45);
                    backdrop-filter: blur(3px);
                    z-index: 2000;
                    display: flex; align-items: center; justify-content: center;
                    padding: 20px;
                    animation: fadeIn .2s ease;
                }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .pff-wip-box {
                    background: #fff;
                    border-radius: 20px;
                    padding: 40px 32px;
                    max-width: 400px; width: 100%;
                    text-align: center;
                    box-shadow: 0 20px 60px rgba(26,46,74,0.2);
                    border: 1.5px solid #dce8f5;
                    animation: slideUp .25s ease;
                }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .pff-wip-icon-wrap {
                    width: 72px; height: 72px;
                    border-radius: 50%;
                    background: #fef9ee;
                    border: 2px solid #fde68a;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.8rem; color: #d97706;
                    margin: 0 auto 20px;
                }
                .pff-wip-box h3 {
                    font-size: 1.1rem; font-weight: 700;
                    color: #1a2e4a; margin: 0 0 10px;
                }
                .pff-wip-box p {
                    font-size: 0.8rem; color: #6b87a8;
                    line-height: 1.6; margin: 0 0 28px;
                }
                .pff-wip-progress {
                    background: #f0f4f9;
                    border-radius: 20px;
                    height: 6px;
                    overflow: hidden;
                    margin-bottom: 28px;
                }
                .pff-wip-progress-bar {
                    height: 100%;
                    width: 35%;
                    background: linear-gradient(90deg, #f59e0b, #d97706);
                    border-radius: 20px;
                }
                .pff-wip-close {
                    padding: 11px 32px;
                    border-radius: 10px;
                    border: none;
                    background: linear-gradient(135deg, #1a2e4a, #2c4f7c);
                    color: #fff;
                    font-family: 'Sora', sans-serif;
                    font-size: 0.82rem; font-weight: 600;
                    cursor: pointer;
                    transition: opacity .15s;
                    box-shadow: 0 4px 14px rgba(26,46,74,0.22);
                }
                .pff-wip-close:hover { opacity: .9; }

                /* RESPONSIVE */
                @media (max-width: 600px) {
                    .pff-page { padding: 16px; }
                    .pff-header { padding: 22px 20px; }
                    .pff-header-text h1 { font-size: 1.2rem; }
                }
            `}</style>

            <div className="pff-page">

                {/* Header */}
                <div className="pff-header">
                    <div className="pff-header-icon">
                        <i className="bi bi-egg-fried"></i>
                    </div>
                    <div className="pff-header-text">
                        <h1>Kroky — Comida Rápida</h1>
                        <p>Selecciona un módulo para comenzar a trabajar</p>
                    </div>
                </div>

                {/* Módulos */}
                <div className="pff-section-label">
                    <i className="bi bi-grid-1x2"></i> Módulos disponibles
                </div>

                <div className="pff-grid">
                    {quickAccess.map((item, i) => (
                        <div
                            key={i}
                            className={`pff-card ${item.wip ? 'wip' : ''}`}
                            onClick={() => item.wip ? setShowWip(true) : navigate(item.path)}
                        >
                            {item.wip && <span className="pff-wip-badge">Próximamente</span>}
                            <div className="pff-card-icon">
                                <i className={`bi ${item.icon}`}></i>
                            </div>
                            <div className="pff-card-body">
                                <div className="pff-card-title">{item.title}</div>
                                <div className="pff-card-desc">{item.description}</div>
                            </div>
                            <i className={`bi ${item.wip ? 'bi-cone-striped' : 'bi-chevron-right'} pff-card-arrow`}></i>
                        </div>
                    ))}
                </div>

                {/* Info */}
                <div className="pff-section-label">
                    <i className="bi bi-info-circle"></i> Sistema
                </div>
                <div className="pff-info-grid">
                    {[
                        { cls: 'i1', icon: 'bi-lightning-charge-fill', title: 'Acceso Rápido',   desc: 'Navega fácilmente entre módulos'       },
                        { cls: 'i2', icon: 'bi-shield-check',          title: 'Sistema Seguro',  desc: 'Datos protegidos y encriptados'         },
                        { cls: 'i3', icon: 'bi-clock-history',         title: 'Tiempo Real',     desc: 'Información actualizada al instante'    },
                    ].map((c, i) => (
                        <div key={i} className="pff-info-card">
                            <div className={`pff-info-icon ${c.cls}`}><i className={`bi ${c.icon}`}></i></div>
                            <div>
                                <div className="pff-info-title">{c.title}</div>
                                <div className="pff-info-desc">{c.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal módulo en construcción */}
            {showWip && (
                <div className="pff-wip-overlay" onClick={() => setShowWip(false)}>
                    <div className="pff-wip-box" onClick={e => e.stopPropagation()}>
                        <div className="pff-wip-icon-wrap">
                            <i className="bi bi-cone-striped"></i>
                        </div>
                        <h3>Módulo en Construcción</h3>
                        <p>
                            La <strong>Facturación Electrónica</strong> está actualmente en desarrollo.
                            Pronto podrás emitir comprobantes electrónicos directamente desde el sistema.
                        </p>
                        <div className="pff-wip-progress">
                            <div className="pff-wip-progress-bar"></div>
                        </div>
                        <button className="pff-wip-close" onClick={() => setShowWip(false)}>
                            <i className="bi bi-check2" style={{marginRight: 6}}></i>
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default PanelFastFood;