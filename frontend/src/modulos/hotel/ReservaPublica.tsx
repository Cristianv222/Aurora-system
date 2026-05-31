import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import '../../App.css';

interface Guest {
    name: string;
    identification: string;
    email: string;
    phone: string;
}

interface Room {
    room_number: string;
    room_type_display: string;
    price_per_night: string;
}

interface Reservation {
    id: number;
    reservation_code: string;
    check_in_date: string;
    planned_check_out: string;
    check_out_date?: string | null;
    number_of_adults: number;
    number_of_children: number;
    total_amount: string;
    deposit_amount: string;
    deposit_paid: boolean;
    status: string;
    status_display: string;
    notes: string;
    room_details: Room;
    guest_details: Guest;
    nights_count: number;
    total_estimated: number;
}

interface HotelSettings {
    hotel_name: string;
    hotel_address: string;
    hotel_phone: string;
}

const ReservaPublica: React.FC = () => {
    const { code } = useParams<{ code: string }>();
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<{ reservation: Reservation; hotel_settings: HotelSettings } | null>(null);

    useEffect(() => {
        // SEO optimization
        document.title = `Detalle de Reservación | Hotel Park`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content', 'Consulta los detalles de tu reservación en Hotel Park de forma segura.');
        }

        const fetchPublicReservation = async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/hotel/api/reservations/public/${code}/`);
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                    if (json.hotel_settings?.hotel_name) {
                        document.title = `Reserva ${code} - ${json.hotel_settings.hotel_name}`;
                    }
                } else {
                    const errJson = await res.json();
                    setError(errJson.error || 'No se pudo encontrar la reservación');
                }
            } catch (err) {
                console.error(err);
                setError('Error al conectar con el servidor.');
            } finally {
                setLoading(false);
            }
        };

        if (code) {
            fetchPublicReservation();
        }
    }, [code]);

    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return '';
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateStr).toLocaleDateString('es-ES', options);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-white" id="loading-container">
                <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
                    <p className="text-amber-500/80 font-medium animate-pulse">Buscando reservación...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4 text-white" id="error-container">
                <div className="max-w-md w-full bg-neutral-900 border border-amber-500/30 p-8 rounded-2xl text-center shadow-2xl shadow-amber-950/10">
                    <div className="inline-flex p-3 rounded-full bg-amber-500/10 text-amber-500 mb-4">
                        <i className="bi bi-exclamation-triangle-fill text-3xl"></i>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Error al Cargar la Reserva</h1>
                    <p className="text-neutral-400 mb-6">{error || 'La reserva solicitada no existe o expiró.'}</p>
                    <div className="text-sm text-amber-600/80 font-medium">
                        Por favor verifique el código o póngase en contacto con recepción.
                    </div>
                </div>
            </div>
        );
    }

    const { reservation, hotel_settings } = data;
    const pendingAmount = Number(reservation.total_estimated || reservation.total_amount) - Number(reservation.deposit_amount);

    return (
        <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 py-12 px-4 text-white flex flex-col items-center" id="public-reservation-page">
            <header className="text-center mb-8">
                <div className="inline-flex items-center justify-center space-x-3 mb-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-yellow-400 rounded-xl flex items-center justify-center text-black font-black shadow-lg shadow-amber-500/10 text-2xl">
                        HP
                    </div>
                    <span className="text-3xl font-black tracking-widest bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 bg-clip-text text-transparent">
                        {hotel_settings.hotel_name || 'HOTEL PARK'}
                    </span>
                </div>
                <p className="text-amber-500/80 text-xs font-bold uppercase tracking-widest">Confirmación de Reserva de Lujo</p>
            </header>

            <main className="max-w-2xl w-full bg-neutral-900 border border-amber-500/20 rounded-3xl overflow-hidden shadow-2xl shadow-black/80">
                {/* Header Card Status */}
                <div className="bg-gradient-to-b from-neutral-900 to-neutral-950/60 p-8 border-b border-amber-500/10 relative text-center flex flex-col items-center">
                    <div className="absolute top-4 right-4">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase border ${
                            reservation.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                            reservation.status === 'reserved' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                            reservation.status === 'checked_out' ? 'bg-slate-500/10 text-slate-400 border-slate-500/30' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}>
                            {reservation.status_display}
                        </span>
                    </div>

                    <div className="text-amber-500/60 text-xs font-bold tracking-widest uppercase mb-1">CÓDIGO DE RESERVACIÓN</div>
                    <h1 className="text-4xl font-black text-amber-500 tracking-wide mb-2" id="reservation-code-title">
                        {reservation.reservation_code}
                    </h1>
                    
                    <p className="text-neutral-400 text-xs max-w-md mb-6">
                        Presente el siguiente código QR en la recepción para agilizar su ingreso.
                    </p>

                    {/* QR Code integration */}
                    <div className="flex flex-col items-center justify-center p-5 bg-black/60 border border-amber-500/30 rounded-2xl shadow-inner max-w-xs w-full">
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${reservation.reservation_code}&color=f59e0b&bgcolor=000000`} 
                            alt="Código QR de Check-In" 
                            className="w-40 h-40 rounded-lg shadow-lg border border-amber-500/20"
                        />
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-3">Código QR de Check-In</span>
                    </div>
                </div>

                {/* Details Section */}
                <div className="p-8 space-y-8">
                    {/* Guest & Room Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-black/30 border border-amber-500/10 p-5 rounded-2xl">
                            <h2 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3 flex items-center">
                                <i className="bi bi-person-fill mr-1.5 text-sm"></i> HUÉSPED PRINCIPAL
                            </h2>
                            <div className="font-bold text-lg text-white mb-1">{reservation.guest_details.name}</div>
                            <div className="text-neutral-400 text-sm mb-1">ID: {reservation.guest_details.identification}</div>
                            <div className="text-neutral-400 text-sm mb-1"><i className="bi bi-envelope mr-1 text-amber-500/50"></i> {reservation.guest_details.email}</div>
                            <div className="text-neutral-400 text-sm"><i className="bi bi-telephone mr-1 text-amber-500/50"></i> {reservation.guest_details.phone}</div>
                        </div>

                        <div className="bg-black/30 border border-amber-500/10 p-5 rounded-2xl">
                            <h2 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3 flex items-center">
                                <i className="bi bi-door-closed-fill mr-1.5 text-sm"></i> HABITACIÓN
                            </h2>
                            <div className="font-bold text-lg text-white mb-1">Habitación {reservation.room_details.room_number}</div>
                            <div className="text-neutral-300 text-sm mb-1">{reservation.room_details.room_type_display}</div>
                            <div className="text-neutral-400 text-sm">Capacidad: {reservation.number_of_adults} Adulto(s) {reservation.number_of_children > 0 && `y ${reservation.number_of_children} Niño(s)`}</div>
                        </div>
                    </div>

                    {/* Dates Card */}
                    <div className="border border-amber-500/10 rounded-2xl bg-black/20 overflow-hidden divide-y divide-amber-500/10">
                        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <span className="block text-xs font-bold text-amber-500/60 uppercase tracking-widest mb-1">Fecha de Entrada (Check-In)</span>
                                <span className="text-sm font-semibold text-neutral-200">{formatDateTime(reservation.check_in_date)}</span>
                            </div>
                            <div className="bg-amber-500/10 text-amber-400 text-xs px-3 py-1 rounded-full border border-amber-500/20 self-start md:self-auto font-bold">
                                Entrada estándar
                            </div>
                        </div>
                        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <span className="block text-xs font-bold text-amber-500/60 uppercase tracking-widest mb-1">Fecha de Salida (Check-Out)</span>
                                <span className="text-sm font-semibold text-neutral-200">{formatDateTime(reservation.planned_check_out || reservation.check_out_date)}</span>
                            </div>
                            <div className="bg-amber-500/10 text-amber-400 text-xs px-3 py-1 rounded-full border border-amber-500/20 self-start md:self-auto font-bold">
                                {reservation.nights_count} noche(s)
                            </div>
                        </div>
                    </div>

                    {/* Pricing details */}
                    <div className="bg-gradient-to-r from-neutral-950 to-neutral-900 border border-amber-500/10 p-6 rounded-2xl">
                        <h2 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-4">RESUMEN DE CUENTAS</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-neutral-400">Precio por Noche:</span>
                                <span className="font-semibold text-neutral-200">${Number(reservation.room_details.price_per_night).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-neutral-400">Estadía ({reservation.nights_count} noches):</span>
                                <span className="font-semibold text-neutral-200">${Number(reservation.total_estimated).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-amber-400">
                                <span>Depósito / Anticipo Pagado:</span>
                                <span className="font-bold">${Number(reservation.deposit_amount).toFixed(2)}</span>
                            </div>
                            <hr className="border-amber-500/10 my-2" />
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-neutral-300 font-medium">Saldo Pendiente a Pagar:</span>
                                <span className="text-2xl font-black text-amber-500">${pendingAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Notes if exist */}
                    {reservation.notes && (
                        <div className="bg-black/20 border border-amber-500/10 p-4 rounded-xl text-neutral-400 text-sm">
                            <strong className="block text-amber-500 mb-1">Notas especiales:</strong>
                            {reservation.notes}
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="bg-black/40 p-6 border-t border-amber-500/10 flex flex-col md:flex-row md:items-center justify-between text-xs text-neutral-400 gap-4">
                    <div>
                        {hotel_settings.hotel_address && <div className="mb-1"><i className="bi bi-geo-alt-fill mr-1 text-amber-500"></i> {hotel_settings.hotel_address}</div>}
                        {hotel_settings.hotel_phone && <div><i className="bi bi-telephone-fill mr-1 text-amber-500"></i> {hotel_settings.hotel_phone}</div>}
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="bg-amber-600 hover:bg-amber-500 text-black font-bold px-4 py-2 rounded-xl transition duration-200 shadow-md shadow-amber-500/10 flex items-center justify-center space-x-1.5"
                        id="btn-print-reservation"
                    >
                        <i className="bi bi-printer-fill"></i>
                        <span>Imprimir</span>
                    </button>
                </div>
            </main>
        </div>
    );
};

export default ReservaPublica;
