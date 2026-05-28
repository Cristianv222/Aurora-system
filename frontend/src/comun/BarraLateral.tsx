import React, { useState, useContext, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const BarraLateral: React.FC = () => {
    const location = useLocation();
    const context = useContext(AuthContext);
    const user = context?.user;
    const logout = context?.logout || (() => {});
    
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
    const [mobileOpen, setMobileOpen] = useState<boolean>(false);
    const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 768);

    const isActive = (path: string): string => {
        return location.pathname === path || location.pathname.startsWith(path) ? 'active' : '';
    };

    const toggleSidebar = (): void => {
        setIsCollapsed(!isCollapsed);
    };

    const menuItems = [
        { path: '/',            icon: 'bi-house-door-fill',  label: 'Inicio'     },
        { path: '/users',       icon: 'bi-people-fill',      label: 'Usuarios'   },
        { path: '/fast-food',   icon: 'bi-egg-fried',        label: 'Kroky'      },
        { path: '/hotel',       icon: 'bi-building-fill',    label: 'Hotel Park' },
        { path: '/pool',        icon: 'bi-water',            label: 'P. Caribe'  },
        { path: '/restaurant',  icon: 'bi-shield-fill',      label: 'Fortaleza'  },
    ];

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const styles: { [key: string]: React.CSSProperties } = {
        sidebar: {
            position: 'fixed',
            top: isMobile ? '54px' : '0',
            left: 0,
            height: isMobile ? 'calc(100vh - 54px)' : '100vh',
            width: isMobile ? '250px' : (isCollapsed ? '70px' : '250px'),
            background: '#ffffff',
            color: '#1a2e4a',
            transition: 'width 0.3s ease, transform 0.3s ease',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '2px 0 10px rgba(26,46,74,0.1)',
            overflowX: 'hidden',
            borderRight: '1.5px solid #dce8f5',
            transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
        },
        sidebarHeader: {
            padding: '1rem 0.75rem',
            borderBottom: '1.5px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            background: 'linear-gradient(160deg, #1a2e4a 0%, #243b5e 100%)',
        },
        brandContainer: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
        },
        brandLogo: {
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
        },
        logoImg: {
            width: isCollapsed ? '36px' : '160px',
            height: '44px',
            objectFit: 'cover',
            objectPosition: 'left center',
            filter: 'brightness(0) invert(1)',
            transition: 'width 0.3s ease',
            borderRadius: isCollapsed ? '6px' : '0',
            flexShrink: 0,
        },
        btnToggle: {
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            width: '32px', height: '32px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            fontSize: '0.9rem',
            flexShrink: 0,
        },
        userInfo: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: isCollapsed ? '0' : '0.6rem 0.75rem',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '8px',
            opacity: isCollapsed ? 0 : 1,
            maxHeight: isCollapsed ? 0 : '60px',
            overflow: 'hidden',
            transition: 'all 0.3s',
        },
        userAvatar: {
            width: '34px', height: '34px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #5b8fc9 0%, #3a6ea8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            fontWeight: '600',
            color: '#fff',
            flexShrink: 0,
            border: '2px solid rgba(255,255,255,0.25)',
        },
        userDetails: { flex: 1, minWidth: 0 },
        userName: {
            fontSize: '0.8rem', fontWeight: '600', color: '#fff',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        },
        userRole: {
            fontSize: '0.68rem', color: 'rgba(255,255,255,0.55)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        },
        sidebarNav: {
            listStyle: 'none',
            padding: '0.75rem 0.5rem',
            margin: 0,
            flex: 1,
            overflowY: 'auto',
        },
        navItem: { margin: '2px 0' },
        navLink: {
            display: 'flex',
            alignItems: 'center',
            padding: '0.7rem 0.75rem',
            color: '#6b87a8',
            textDecoration: 'none',
            transition: 'all 0.2s',
            gap: '0.85rem',
            position: 'relative',
            borderRadius: '9px',
            fontSize: '0.82rem',
            fontWeight: '500',
        },
        navLinkActive: {
            background: 'linear-gradient(135deg, #1a2e4a 0%, #2c4f7c 100%)',
            color: '#ffffff',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(26,46,74,0.18)',
        },
        navIcon: {
            fontSize: '1.1rem',
            minWidth: '20px',
            textAlign: 'center',
            transition: 'all 0.2s',
        },
        navText: {
            whiteSpace: 'nowrap',
            opacity: isCollapsed ? 0 : 1,
            maxWidth: isCollapsed ? 0 : '180px',
            overflow: 'hidden',
            transition: 'opacity 0.2s, max-width 0.3s',
        },
        sidebarFooter: {
            padding: '0.75rem 0.5rem',
            borderTop: '1.5px solid #dce8f5',
        },
        logoutButton: {
            width: '100%',
            padding: '0.65rem 0.75rem',
            background: '#fef2f2',
            border: '1.5px solid #fee2e2',
            borderRadius: '9px',
            color: '#dc2626',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '0.75rem',
            fontSize: '0.8rem',
            fontWeight: '600',
            transition: 'all 0.2s',
        },
        versionText: {
            textAlign: 'center',
            fontSize: '0.62rem',
            color: '#6b87a8',
            marginTop: '0.5rem',
            opacity: isCollapsed ? 0 : 1,
            maxHeight: isCollapsed ? 0 : '18px',
            overflow: 'hidden',
            transition: 'all 0.2s',
        },
    };

    return (
        <>
            <link
                rel="stylesheet"
                href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
            />

            {/* OVERLAY móvil */}
            {mobileOpen && (
                <div
                    onClick={() => setMobileOpen(false)}
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(26,46,74,0.45)',
                        zIndex: 999,
                        backdropFilter: 'blur(2px)',
                    }}
                />
            )}

            {/* BARRA SUPERIOR MÓVIL */}
            <div style={{
                display: 'none',
                position: 'fixed', top: 0, left: 0, right: 0,
                height: '54px',
                background: 'linear-gradient(160deg, #1a2e4a 0%, #243b5e 100%)',
                alignItems: 'center',
                padding: '0 14px',
                gap: '12px',
                zIndex: 998,
                boxShadow: '0 2px 12px rgba(26,46,74,0.2)',
            }} className="sl-mobile-bar">
                <button
                    onClick={() => setMobileOpen(o => !o)}
                    style={{
                        background: 'rgba(255,255,255,0.12)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff', width: '36px', height: '36px',
                        borderRadius: '8px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.2rem', flexShrink: 0,
                    }}
                >
                    <i className={`bi ${mobileOpen ? 'bi-x-lg' : 'bi-list'}`}></i>
                </button>
                <img
                    src="/logo-aurora.png"
                    alt="Aurora System"
                    style={{ height: '30px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
                />
            </div>

            <aside style={styles.sidebar} className="sl-sidebar-aside">
                <div style={styles.sidebarHeader}>
                    <div style={styles.brandContainer}>
                        <div style={styles.brandLogo}>
                            <img src="/logo-aurora.png" alt="Aurora System" style={styles.logoImg} />
                        </div>
                        <button
                            style={styles.btnToggle}
                            onClick={toggleSidebar}
                            title={isCollapsed ? 'Expandir' : 'Contraer'}
                        >
                            <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
                        </button>
                    </div>

                    <div style={styles.userInfo}>
                        <div style={styles.userAvatar}>
                            {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div style={styles.userDetails}>
                            <div style={styles.userName}>{user?.first_name ? `${user.first_name} ${user.last_name}` : user?.email || 'Usuario'}</div>
                            <div style={styles.userRole}>{user?.role?.name || 'Administrador'}</div>
                        </div>
                    </div>
                </div>

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
                                        ...(active ? styles.navLinkActive : {}),
                                    }}
                                    onClick={() => setMobileOpen(false)}
                                    onMouseEnter={(e) => {
                                        if (!active) {
                                            e.currentTarget.style.background = '#eaf1f9';
                                            e.currentTarget.style.color = '#1a2e4a';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!active) {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.color = '#6b87a8';
                                        }
                                    }}
                                >
                                    <i
                                        className={`bi ${item.icon}`}
                                        style={{
                                            ...styles.navIcon,
                                            color: active ? '#ffffff' : '#6b87a8',
                                        }}
                                    ></i>
                                    <span style={styles.navText}>{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>

                <div style={styles.sidebarFooter}>
                    <button
                        style={styles.logoutButton}
                        onClick={logout}
                        title="Cerrar Sesión"
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#fee2e2';
                            e.currentTarget.style.borderColor = '#fca5a5';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fef2f2';
                            e.currentTarget.style.borderColor = '#fee2e2';
                        }}
                    >
                        <i className="bi bi-box-arrow-right" style={{ fontSize: '1rem' }}></i>
                        <span style={styles.navText}>Cerrar Sesión</span>
                    </button>
                    <div style={styles.versionText}>v1.0.0</div>
                </div>
            </aside>

            <style>{`
                .sl-mobile-bar {
                    display: none;
                }
                .main-content {
                    margin-left: ${isCollapsed ? '70px' : '250px'};
                    transition: margin-left 0.3s ease;
                    min-height: 100vh;
                }
                @media (max-width: 768px) {
                    .sl-mobile-bar {
                        display: flex !important;
                    }
                    .main-content {
                        margin-left: 0 !important;
                        padding-top: 54px !important;
                        padding-left: 15px !important;
                        padding-right: 15px !important;
                    }
                }
            `}</style>
        </>
    );
};

export default BarraLateral;
