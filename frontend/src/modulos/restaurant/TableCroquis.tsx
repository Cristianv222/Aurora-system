import React, { useState, useEffect, useRef } from 'react';
import { Table } from '../../types';

// Configuración de mesas con dimensiones base para un ancho de referencia de 1200px (según el SVG de 1200x700)
const REFERENCE_WIDTH = 1200;

interface TableConfig {
    top: string;
    left: string;
    tableWidth: number;
    tableHeight: number;
    type: 'rectangle' | 'square' | 'special' | 'bar';
    chairs: any[];
}

const TABLE_CONFIGS: Record<string, TableConfig> = {
    // ───── ZONA SUPERIOR IZQUIERDA ─────
    'Mesa 7 B': {
        top: '5.714%',
        left: '15%',
        tableWidth: 110,
        tableHeight: 170,
        type: 'rectangle',
        chairs: []
    },
    'Mesa 7': {
        top: '5.714%',
        left: '25.833%',
        tableWidth: 110,
        tableHeight: 170,
        type: 'rectangle',
        chairs: []
    },

    // ───── SEGUNDA FILA IZQUIERDA ─────
    'Mesa 7 C': {
        top: '32.857%',
        left: '15%',
        tableWidth: 240,
        tableHeight: 55,
        type: 'rectangle',
        chairs: []
    },
    'Mesa 8': {
        top: '48.571%',
        left: '14.167%',
        tableWidth: 170,
        tableHeight: 120,
        type: 'square',
        chairs: []
    },

    // ───── ZONA CENTRAL ─────
    'Mesa 9': {
        top: '35.714%',
        left: '45%',
        tableWidth: 190,
        tableHeight: 120,
        type: 'square',
        chairs: []
    },
    'Mesa 6': {
        top: '10%',
        left: '43.333%',
        tableWidth: 150,
        tableHeight: 90,
        type: 'square',
        chairs: []
    },
    'Mesa 5': {
        top: '10%',
        left: '60.833%',
        tableWidth: 150,
        tableHeight: 90,
        type: 'square',
        chairs: []
    },

    // ───── COLUMNA DERECHA ─────
    'Mesa 4': {
        top: '10%',
        left: '77.5%',
        tableWidth: 150,
        tableHeight: 90,
        type: 'square',
        chairs: []
    },
    'Mesa 3': {
        top: '30%',
        left: '77.5%',
        tableWidth: 150,
        tableHeight: 90,
        type: 'square',
        chairs: []
    },
    'Mesa 2': {
        top: '50%',
        left: '77.5%',
        tableWidth: 150,
        tableHeight: 90,
        type: 'square',
        chairs: []
    },
    'Mesa 1': {
        top: '70%',
        left: '77.5%',
        tableWidth: 150,
        tableHeight: 90,
        type: 'square',
        chairs: []
    },

    // ───── BARRA ─────
    'Barra 1': {
        top: '87.143%',
        left: '27.5%',
        tableWidth: 170,
        tableHeight: 55,
        type: 'bar',
        chairs: []
    },
    'Barra 2': {
        top: '87.143%',
        left: '42.083%',
        tableWidth: 170,
        tableHeight: 55,
        type: 'bar',
        chairs: []
    },
    'Barra 3': {
        top: '87.143%',
        left: '56.667%',
        tableWidth: 170,
        tableHeight: 55,
        type: 'bar',
        chairs: []
    },

    // ───── DOMICILIO ─────
    'Domicilio': {
        top: '10%',
        left: '90.833%',
        tableWidth: 100,
        tableHeight: 90,
        type: 'special',
        chairs: []
    }
};

interface TableCroquisProps {
    tables: Table[];
    selectedTable?: Table | null;
    onSelectTable: (table: Table) => void;
    onClose?: () => void;
    isEmbedded?: boolean;
}

const TableCroquis: React.FC<TableCroquisProps> = ({
    tables,
    selectedTable,
    onSelectTable,
    onClose,
    isEmbedded = false
}) => {
    const [scaleFactor, setScaleFactor] = useState<number>(1);
    const containerRef = useRef<HTMLDivElement>(null);

    // Observer para recalcular el factor de escala cuando el contenedor cambia de tamaño
    useEffect(() => {
        const updateScale = () => {
            if (containerRef.current) {
                const currentWidth = containerRef.current.offsetWidth;
                const factor = currentWidth / REFERENCE_WIDTH;
                setScaleFactor(factor);
            }
        };

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

    const getColors = (table: Table) => {
        const isSelected = selectedTable && selectedTable.id === table.id;

        if (isSelected) {
            return {
                table: 'rgba(34, 197, 94, 0.85)', // Verde semi-transparente de alta opacidad
                tableBorder: '#15803d',
                tableText: 'text-white'
            };
        }

        switch (table.status) {
            case 'available':
                return {
                    table: 'rgba(255, 251, 235, 0.8)', // Crema semi-transparente
                    tableBorder: '#d97706',
                    tableText: 'text-amber-950' // Texto oscuro de alto contraste
                };
            case 'occupied':
                return {
                    table: 'rgba(254, 226, 226, 0.8)', // Rojo claro semi-transparente
                    tableBorder: '#dc2626',
                    tableText: 'text-red-950'
                };
            case 'reserved':
                return {
                    table: 'rgba(219, 234, 254, 0.8)', // Azul claro semi-transparente
                    tableBorder: '#2563eb',
                    tableText: 'text-blue-950'
                };
            default:
                return {
                    table: 'rgba(243, 244, 246, 0.8)', // Gris claro semi-transparente
                    tableBorder: '#9ca3af',
                    tableText: 'text-gray-800'
                };
        }
    };

    const handleTableClick = (table: Table, e: React.MouseEvent) => {
        e.stopPropagation();
        if (['available', 'reserved', 'occupied'].includes(table.status)) {
            onSelectTable(table);
        }
    };

    return (
        <div className={isEmbedded ? "w-full h-full flex items-center justify-center" : "fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-2.5"}>
            <div className={isEmbedded ? "bg-white rounded-lg w-full max-w-full h-full flex flex-col overflow-hidden shadow-sm" : "bg-white rounded-lg w-full max-w-7xl max-h-[98vh] flex flex-col overflow-hidden shadow-2xl"}>
                {/* Header Compacto - Solo lo mostramos si NO está embebido */}
                {!isEmbedded && (
                    <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 bg-white z-20">
                        <div>
                            <h2 className="m-0 text-gray-800 text-lg font-bold">
                                Selección de Mesa
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="bg-red-650 hover:bg-red-700 text-white border-none rounded px-3.5 py-1.5 text-sm font-semibold cursor-pointer transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                )}

                {/* Contenedor del Mapa */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center p-2.5 bg-neutral-900">
                    {/* Contenedor Relativo Escalable con Aspect Ratio Fijo de 1200x700 */}
                    <div
                        ref={containerRef}
                        className="relative w-full max-w-full leading-none aspect-[1200/700]"
                    >
                        {/* Imagen Real que dicta la altura y el aspecto */}
                        <img
                            src="/restaurant-background.svg"
                            alt="Mapa del Restaurante"
                            className="w-full h-full block rounded object-fill"
                        />

                        {/* Capa de Mesas Superpuesta */}
                        <div className="absolute inset-0">
                            {tables.map((table) => {
                                const config = TABLE_CONFIGS[table.number];
                                if (!config) return null;

                                const colors = getColors(table);
                                const isClickable = ['available', 'reserved', 'occupied'].includes(table.status);

                                // Calcular dimensiones dinámicas en pixeles escalables
                                const dynamicWidth = config.tableWidth * scaleFactor;
                                const dynamicHeight = config.tableHeight * scaleFactor;
                                // Ajustar tamaño de fuente basado en la escala (mínimo 10px)
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
                                        <div
                                            style={{
                                                backgroundColor: colors.table,
                                                borderColor: colors.tableBorder,
                                                borderWidth: `${2 * scaleFactor}px`,
                                                borderRadius: config.type === 'bar' ? `${8 * scaleFactor}px` : `${6 * scaleFactor}px`,
                                                boxShadow: `0 ${2 * scaleFactor}px ${4 * scaleFactor}px rgba(0,0,0,0.2)`
                                            }}
                                            className="w-full h-full border-solid flex flex-col items-center justify-center p-0.5 relative overflow-hidden"
                                        >
                                            {/* Nombre de la mesa */}
                                            <div
                                                style={{
                                                    fontSize: `${fontSizeName}px`,
                                                    textShadow: '0px 0px 2px rgba(255,255,255,0.7)'
                                                }}
                                                className={`font-extrabold text-center leading-tight ${colors.tableText}`}
                                            >
                                                {table.number}
                                            </div>

                                            {/* Capacidad */}
                                            {config.type !== 'special' && dynamicHeight > 25 && (
                                                <div
                                                    style={{
                                                        fontSize: `${fontSizeCap}px`
                                                    }}
                                                    className={`font-semibold leading-none opacity-90 ${colors.tableText}`}
                                                >
                                                    Cap: {table.capacity}
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
                    <div className="p-4 bg-emerald-50 border-t border-emerald-550 text-center text-emerald-800 font-bold text-sm">
                        Mesa seleccionada: {selectedTable.number} ({selectedTable.capacity} pers.)
                    </div>
                )}
            </div>
        </div>
    );
};

export default TableCroquis;
