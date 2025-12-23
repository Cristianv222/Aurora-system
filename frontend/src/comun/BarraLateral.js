import React, { useState, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const BarraLateral = () => {
    const location = useLocation();
    const { user, logout } = useContext(AuthContext);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const isActive = (path) => {
        return location.pathname === path || location.pathname.startsWith(path) ? 'active' : '';
    };

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    const menuItems = [
        { path: '/', icon: 'bi-house-door-fill', label: 'Inicio' },
        { path: '/users', icon: 'bi-people-fill', label: 'Usuarios' },
        { path: '/fast-food', icon: 'bi-cart-fill', label: 'Comida Rápida' },
        { path: '/hotel', icon: 'bi-building', label: 'Hotel' },
        { path: '/pool', icon: 'bi-water', label: 'Piscinas' },
        { path: '/restaurant', icon: 'bi-cup-straw', label: 'Restaurante' },
    ];

    // Estilos inline
    const styles = {
        sidebar: {
            position: 'fixed',
            top: 0,
            left: 0,
            height: '100vh',
            width: isCollapsed ? '70px' : '250px',
            background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
            color: '#fff',
            transition: 'width 0.3s ease',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)',
            overflowX: 'hidden'
        },
        sidebarHeader: {
            padding: '1.5rem 1rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
        },
        brandContainer: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem'
        },
        brandLogo: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flex: 1,
            minWidth: 0
        },
        brandIcon: {
            fontSize: '1.75rem',
            color: '#3b82f6',
            flexShrink: 0
        },
        brandText: {
            fontSize: '1.25rem',
            fontWeight: '700',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            opacity: isCollapsed ? 0 : 1,
            transition: 'opacity 0.2s',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
        },
        btnToggle: {
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: '#fff',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            fontSize: '1.1rem',
            flexShrink: 0
        },
        userInfo: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            opacity: isCollapsed ? 0 : 1,
            height: isCollapsed ? 0 : 'auto',
            overflow: 'hidden',
            transition: 'all 0.3s'
        },
        userAvatar: {
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            fontWeight: '600',
            flexShrink: 0
        },
        userDetails: {
            flex: 1,
            minWidth: 0
        },
        userName: {
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        },
        userRole: {
            fontSize: '0.75rem',
            color: '#94a3b8',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        },
        sidebarNav: {
            listStyle: 'none',
            padding: '1rem 0',
            margin: 0,
            flex: 1,
            overflowY: 'auto'
        },
        navItem: {
            margin: '0.25rem 0'
        },
        navLink: {
            display: 'flex',
            alignItems: 'center',
            padding: '0.875rem 1.25rem',
            color: '#cbd5e1',
            textDecoration: 'none',
            transition: 'all 0.2s',
            gap: '1rem',
            position: 'relative'
        },
        navLinkActive: {
            background: 'rgba(59, 130, 246, 0.2)',
            color: '#3b82f6',
            borderLeft: '4px solid #3b82f6',
            paddingLeft: 'calc(1.25rem - 4px)'
        },
        navIcon: {
            fontSize: '1.25rem',
            minWidth: '24px',
            transition: 'all 0.2s'
        },
        navText: {
            whiteSpace: 'nowrap',
            opacity: isCollapsed ? 0 : 1,
            width: isCollapsed ? 0 : 'auto',
            overflow: 'hidden',
            transition: 'opacity 0.2s'
        },
        sidebarFooter: {
            padding: '1rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        },
        logoutButton: {
            width: '100%',
            padding: '0.75rem 1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#ef4444',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '0.75rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            transition: 'all 0.2s'
        },
        versionText: {
            textAlign: 'center',
            fontSize: '0.7rem',
            color: '#64748b',
            marginTop: '0.5rem',
            opacity: isCollapsed ? 0 : 1,
            height: isCollapsed ? 0 : 'auto',
            overflow: 'hidden',
            transition: 'all 0.2s'
        }
    };

    return (
        <>
            {/* Agregar Bootstrap Icons */}
            <link 
                rel="stylesheet" 
                href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
            />

            <aside style={styles.sidebar}>
                {/* Header con Logo y Toggle */}
                <div style={styles.sidebarHeader}>
                    <div style={styles.brandContainer}>
                        <div style={styles.brandLogo}>
                            <i className="bi bi-stars" style={styles.brandIcon}></i>
                            <span style={styles.brandText}>Aurora System</span>
                        </div>
                        <button 
                            style={styles.btnToggle}
                            onClick={toggleSidebar}
                            title={isCollapsed ? 'Expandir' : 'Contraer'}
                            onMouseEnter={(e) => {
                                e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                                e.target.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.target.style.transform = 'scale(1)';
                            }}
                        >
                            <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
                        </button>
                    </div>

                    {/* Info del Usuario */}
                    <div style={styles.userInfo}>
                        <div style={styles.userAvatar}>
                            {user?.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div style={styles.userDetails}>
                            <div style={styles.userName}>
                                {user?.username || 'Usuario'}
                            </div>
                            <div style={styles.userRole}>
                                {user?.role || 'Administrador'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navegación */}
                <ul style={styles.sidebarNav}>
                    {menuItems.map((item) => {
                        const active = isActive(item.path);
                        return (
                            <li key={item.path} style={styles.navItem}>
                                <Link 
                                    to={item.path} 
                                    title={isCollapsed ? item.label : ''}
                                    style={{
                                        ...styles.navLink,
                                        ...(active ? styles.navLinkActive : {})
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!active) {
                                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                                            e.currentTarget.style.color = '#60a5fa';
                                            e.currentTarget.style.paddingLeft = '1.5rem';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!active) {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.color = '#cbd5e1';
                                            e.currentTarget.style.paddingLeft = '1.25rem';
                                        }
                                    }}
                                >
                                    <i 
                                        className={`bi ${item.icon}`} 
                                        style={{
                                            ...styles.navIcon,
                                            color: active ? '#3b82f6' : 'inherit'
                                        }}
                                    ></i>
                                    <span style={styles.navText}>{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>

                {/* Footer con Logout */}
                <div style={styles.sidebarFooter}>
                    <button 
                        style={styles.logoutButton}
                        onClick={logout}
                        title="Cerrar Sesión"
                        onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(239, 68, 68, 0.2)';
                            e.target.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = 'rgba(239, 68, 68, 0.1)';
                            e.target.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                        }}
                    >
                        <i className="bi bi-box-arrow-right" style={{ fontSize: '1.1rem' }}></i>
                        <span style={styles.navText}>Cerrar Sesión</span>
                    </button>
                    
                    <div style={styles.versionText}>
                        v1.0.0
                    </div>
                </div>
            </aside>

            {/* Estilos globales adicionales */}
            <style>{`
                /* Scrollbar personalizado */
                .sidebar-nav::-webkit-scrollbar {
                    width: 6px;
                }
                .sidebar-nav::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                }
                .sidebar-nav::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 3px;
                }
                .sidebar-nav::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.3);
                }

                /* Ajuste para el contenido principal */
                .main-content {
                    margin-left: ${isCollapsed ? '70px' : '250px'};
                    transition: margin-left 0.3s ease;
                    min-height: 100vh;
                }

                /* Responsive */
                @media (max-width: 768px) {
                    aside {
                        transform: ${isCollapsed ? 'translateX(-100%)' : 'translateX(0)'};
                    }
                    .main-content {
                        margin-left: 0 !important;
                    }
                }
            `}</style>
        </>
    );
};

export default BarraLateral;