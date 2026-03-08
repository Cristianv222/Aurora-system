import React, { useState, useEffect, useRef } from 'react';

// Configuración de mesas con dimensiones base para un ancho de referencia de 1600px
const REFERENCE_WIDTH = 1600;

const TABLE_CONFIGS = {
    // ───── ZONA SUPERIOR IZQUIERDA ─────
    'Mesa 7 B': {
        top: '2%',
        left: '24.7%',
        tableWidth: 120,
        tableHeight: 221,
        type: 'rectangle',
        chairs: []
    },
    'Mesa 7': {
        top: '3.5%',
        left: '33.3%',
        tableWidth: 122,
        tableHeight: 208,
        type: 'rectangle',
        chairs: []
    },

    // ───── SUPERIOR CENTRO ─────
    'Mesa 5': {
        top: '14%',
        left: '59%',
        tableWidth: 157,
        tableHeight: 105,
        type: 'square',
        chairs: []
    },
    'Mesa 4': {
        top: '14.5%',
        left: '70.8%',
        tableWidth: 137,
        tableHeight: 105,
        type: 'square',
        chairs: []
    },

    // ───── DOMICILIO ─────
    'Domicilio': {
        top: '4%',
        left: '85%',
        tableWidth: 100,
        tableHeight: 50,
        type: 'special',
        chairs: []
    },

    // ───── SEGUNDA FILA ─────
    'Mesa 7 C': {
        top: '29.2%',
        left: '24.8%',
        tableWidth: 255,
        tableHeight: 60,
        type: 'rectangle',
        chairs: []
    },
    'Mesa 8': {
        top: '43%',
        left: '24.7%',
        tableWidth: 214,
        tableHeight: 116,
        type: 'square',
        chairs: []
    },

    // ───── ZONA CENTRAL ─────
    'Mesa 9': {
        top: '34%',
        left: '47.8%',
        tableWidth: 183,
        tableHeight: 129,
        type: 'square',
        chairs: []
    },
    'Mesa 6': {
        top: '14%',
        left: '46.5%',
        tableWidth: 157,
        tableHeight: 105,
        type: 'square',
        chairs: []
    },
    // ───── COLUMNA DERECHA ─────
    'Mesa 3': {
        top: '29.2%',
        left: '70.8%',
        tableWidth: 137,
        tableHeight: 100,
        type: 'square',
        chairs: []
    },
    'Mesa 2': {
        top: '44%',
        left: '70.8%',
        tableWidth: 137,
        tableHeight: 100,
        type: 'square',
        chairs: []
    },
    'Mesa 1': {
        top: '59%',
        left: '70.8%',
        tableWidth: 137,
        tableHeight: 100,
        type: 'square',
        chairs: []
    },

    // ───── BARRA ─────
    'Barra A': {
        top: '87%',
        left: '36%',
        tableWidth: 518,
        tableHeight: 83,
        type: 'bar',
        chairs: []
    }
};

const TableCroquis = ({ tables, selectedTable, onSelectTable, onClose, isEmbedded = false }) => {
    const [scaleFactor, setScaleFactor] = useState(1);
    const containerRef = useRef(null);

    // Observer para recalcular el factor de escala cuando el contenedor cambia de tamaño
    useEffect(() => {
        const updateScale = () => {
            if (containerRef.current) {
                const currentWidth = containerRef.current.offsetWidth;
                // Calculamos la proporción basada en el ancho de referencia (1600px)
                // Si el ancho actual es 800px, el factor será 0.5
                const factor = currentWidth / REFERENCE_WIDTH;
                setScaleFactor(factor);
            }
        };

        // Ejecutar al inicio
        updateScale();

        const observer = new ResizeObserver(updateScale);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            if (containerRef.current) {
                observer.unobserve(containerRef.current);
            }
        };
    }, []);

    const getColors = (table) => {
        const isSelected = selectedTable && selectedTable.id === table.id;

        if (isSelected) {
            return {
                table: 'rgba(34, 197, 94, 0.9)',
                tableBorder: '#16a34a',
                tableText: '#ffffff'
            };
        }

        switch (table.status) {
            case 'available':
                return {
                    table: 'rgba(241, 237, 218, 0.47)',
                    tableBorder: '#d97706',
                    tableText: '#78350f'
                };
            case 'occupied':
                return {
                    table: 'rgba(254, 202, 202, 0.85)',
                    tableBorder: '#dc2626',
                    tableText: '#991b1b'
                };
            case 'reserved':
                return {
                    table: 'rgba(191, 219, 254, 0.85)',
                    tableBorder: '#2563eb',
                    tableText: '#1e3a8a'
                };
            case 'upcoming':
                return {
                    table: 'rgba(255, 251, 235, 0.65)',
                    tableBorder: '#f59e0b',
                    tableText: '#78350f'
                };
            default:
                return {
                    table: 'rgba(229, 231, 235, 0.85)',
                    tableBorder: '#9ca3af',
                    tableText: '#4b5563'
                };
        }
    };

    const handleTableClick = (table, e) => {
        e.stopPropagation();
        if (['available', 'reserved', 'upcoming', 'occupied'].includes(table.status)) {
            onSelectTable(table);
        }
    };

    // Si no está embebido, usa la capa negra translúcida. Si está embebido, usa espacio completo.
    const wrapperStyle = isEmbedded ? {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    } : {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '10px'
    };

    const containerStyle = isEmbedded ? {
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    } : {
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '1600px', // Limitar el ancho máximo para pantallas muy grandes
        maxHeight: '98vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
    };

    return (
        <div style={wrapperStyle}>
            <div style={containerStyle}>
                {/* Header Compacto - Solo lo mostramos si NO está embebido, ya que el panel principal tendrá su propio título */}
                {!isEmbedded && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.8rem 1rem',
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: '#fff',
                        zIndex: 20
                    }}>
                        <div>
                            <h2 style={{ margin: 0, color: '#1f2937', fontSize: '1.2rem', fontWeight: '700' }}>
                                Selección de Mesa
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                backgroundColor: '#dc2626',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '0.4rem 0.8rem',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            Cerrar
                        </button>
                    </div>
                )}

                {/* Contenedor del Mapa con Scroll si es necesario en pantallas muy bajitas */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '10px',
                    backgroundColor: '#1a1a1a'
                }}>

                    {/* Contenedor Relativo Escalable */}
                    <div
                        ref={containerRef}
                        style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: '100%',
                            lineHeight: 0 // Eliminar espacio extra debajo de la imagen
                        }}
                    >
                        {/* Imagen Real que dicta la altura y el aspecto */}
                        <img
                            src="/restaurant-background.png"
                            alt="Mapa del Restaurante"
                            style={{
                                width: '100%',
                                height: 'auto',
                                display: 'block',
                                borderRadius: '4px'
                            }}
                        />

                        {/* Capa de Mesas Superpuesta */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0
                        }}>
                            {tables.map((table) => {
                                const config = TABLE_CONFIGS[table.number];
                                if (!config) return null;

                                const colors = getColors(table);
                                const isClickable = ['available', 'reserved', 'upcoming', 'occupied'].includes(table.status);

                                // Calcular dimensiones dinámicas
                                const dynamicWidth = config.tableWidth * scaleFactor;
                                const dynamicHeight = config.tableHeight * scaleFactor;
                                // Ajustar tamaño de fuente basado en la escala (mínimo 8px)
                                const fontSizeName = Math.max(10, 14 * scaleFactor);
                                const fontSizeCap = Math.max(8, 11 * scaleFactor);

                                return (
                                    <div
                                        key={table.id}
                                        style={{
                                            position: 'absolute',
                                            top: config.top,
                                            left: config.left,
                                            width: `${dynamicWidth}px`,
                                            height: `${dynamicHeight}px`,
                                            cursor: isClickable ? 'pointer' : 'not-allowed',
                                            transition: 'transform 0.2s',
                                            zIndex: 10
                                        }}
                                        onClick={(e) => handleTableClick(table, e)}
                                        onMouseEnter={(e) => {
                                            if (isClickable) {
                                                e.currentTarget.style.transform = 'scale(1.05)';
                                                e.currentTarget.style.zIndex = '20';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'scale(1)';
                                            e.currentTarget.style.zIndex = '10';
                                        }}
                                    >

                                        {/* Diseño de la Mesa */}
                                        <div style={{
                                            width: '100%',
                                            height: '100%',
                                            backgroundColor: colors.table,
                                            border: `${2 * scaleFactor}px solid ${colors.tableBorder}`,
                                            borderRadius: config.type === 'bar' ? `${8 * scaleFactor}px` : `${6 * scaleFactor}px`,
                                            boxShadow: table.status === 'upcoming'
                                                ? `0 0 ${6 * scaleFactor}px ${2 * scaleFactor}px rgba(245,158,11,0.25)`
                                                : `0 ${2 * scaleFactor}px ${4 * scaleFactor}px rgba(0,0,0,0.2)`,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: `${2 * scaleFactor}px`,
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}>
                                            {/* Barra superior de alerta para 'upcoming' */}
                                            {table.status === 'upcoming' && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    height: `${Math.max(2, 3 * scaleFactor)}px`,
                                                    backgroundColor: '#f59e0b',
                                                    borderRadius: `${4 * scaleFactor}px ${4 * scaleFactor}px 0 0`
                                                }} />
                                            )}

                                            {/* Nombre de la mesa */}
                                            <div style={{
                                                fontSize: `${fontSizeName}px`,
                                                fontWeight: '800',
                                                color: colors.tableText,
                                                textAlign: 'center',
                                                lineHeight: '1.1',
                                                textShadow: '0px 0px 2px rgba(255,255,255,0.7)'
                                            }}>
                                                {table.number}
                                            </div>

                                            {/* Capacidad */}
                                            {config.type !== 'special' && dynamicHeight > 30 && (
                                                <div style={{
                                                    fontSize: `${fontSizeCap}px`,
                                                    fontWeight: '600',
                                                    color: colors.tableText,
                                                    opacity: 0.9,
                                                    lineHeight: '1'
                                                }}>
                                                    Cap: {table.capacity}
                                                </div>
                                            )}

                                            {/* Minutos restantes para reserva próxima */}
                                            {table.status === 'upcoming' && table.reservation?.minutes_until != null && dynamicHeight > 50 && (
                                                <div style={{
                                                    fontSize: `${Math.max(8, 10 * scaleFactor)}px`,
                                                    fontWeight: '700',
                                                    color: '#92400e',
                                                    backgroundColor: 'rgba(254,243,199,0.9)',
                                                    borderRadius: `${3 * scaleFactor}px`,
                                                    padding: `${1 * scaleFactor}px ${3 * scaleFactor}px`,
                                                    marginTop: `${2 * scaleFactor}px`,
                                                    textAlign: 'center',
                                                    lineHeight: '1.2',
                                                    border: '1px solid #d97706'
                                                }}>
                                                    {table.reservation.minutes_until < 60
                                                        ? `${table.reservation.minutes_until} min`
                                                        : `${Math.floor(table.reservation.minutes_until / 60)}h ${table.reservation.minutes_until % 60}m`
                                                    }
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer Flotante o Fijo */}
                {selectedTable && (
                    <div style={{
                        padding: '1rem',
                        backgroundColor: '#d1fae5',
                        borderTop: '1px solid #22c55e',
                        textAlign: 'center',
                        color: '#065f46',
                        fontWeight: '700'
                    }}>
                        Mesa seleccionada: {selectedTable.number} ({selectedTable.capacity} pers.)
                    </div>
                )}
            </div>
        </div>
    );
};

export default TableCroquis;
