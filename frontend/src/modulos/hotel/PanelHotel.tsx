import React, { useState, useEffect } from 'react';
import { showToast } from '../../utils/toast';
import '../../App.css';

const toast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const mappedType = (type === 'warning' ? 'info' : type) as 'success' | 'error' | 'info';
    showToast(message, { type: mappedType });
};

interface Floor {
    id: number;
    name: string;
    order: number;
    rooms?: Room[];
}

interface Room {
    id: number;
    floor: number;
    room_number: string;
    room_type: 'single' | 'double' | 'suite' | 'matrimonial';
    room_type_display: string;
    price_per_night: number;
    adult_capacity: number;
    child_capacity: number;
    status: 'available' | 'occupied' | 'cleaning' | 'maintenance';
    status_display: string;
}

interface Guest {
    id?: number;
    identification_type: string;
    identification: string;
    name: string;
    email: string;
    phone: string;
    address: string;
}

interface Payment {
    id: number;
    amount: string;
    payment_method: string;
    payment_method_display: string;
    is_deposit: boolean;
    created_at: string;
}

interface Reservation {
    id: number;
    room: number;
    room_details: Room;
    guest: number;
    guest_details: Guest;
    check_in_date: string;
    planned_check_out: string;
    check_out_date: string | null;
    number_of_adults: number;
    number_of_children: number;
    total_amount: string;
    deposit_amount: string;
    deposit_paid: boolean;
    reservation_code: string;
    status: 'reserved' | 'active' | 'checked_out' | 'cancelled';
    status_display: string;
    notes: string;
    nights_count: number;
    total_estimated: number;
    payments?: Payment[];
}

interface HotelSettings {
    id?: number;
    hotel_name: string;
    default_checkin_time: string;
    default_checkout_time: string;
    hotel_address: string;
    hotel_phone: string;
}

const getLocalISODate = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const PanelHotel: React.FC = () => {
    const API_BASE = '/api/hotel';

    const [activeViewTab, setActiveViewTab] = useState<'croquis' | 'reservas' | 'calendario'>('croquis');
    const [floors, setFloors] = useState<Floor[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [activeFloorTab, setActiveFloorTab] = useState<number | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    // Filter states
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Calendar filter states
    const [calendarFloorFilter, setCalendarFloorFilter] = useState<string>('all');
    const [calendarRoomTypeFilter, setCalendarRoomTypeFilter] = useState<string>('all');
    const [calendarRoomSearch, setCalendarRoomSearch] = useState<string>('');
    const [calendarGuestSearch, setCalendarGuestSearch] = useState<string>('');

    // Modals control
    const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
    const [showSRIConfigModal, setShowSRIConfigModal] = useState<boolean>(false);
    const [showHotelSettingsModal, setShowHotelSettingsModal] = useState<boolean>(false);
    const [showCheckInModal, setShowCheckInModal] = useState<boolean>(false);
    const [showReserveModal, setShowReserveModal] = useState<boolean>(false);
    const [showCheckOutModal, setShowCheckOutModal] = useState<boolean>(false);
    const [showQRScannerModal, setShowQRScannerModal] = useState<boolean>(false);
    const [qrCodeInput, setQrCodeInput] = useState<string>('');
    const [scannedRes, setScannedRes] = useState<Reservation | null>(null);

    // Selection state
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);

    // Hotel Settings
    const [hotelSettings, setHotelSettings] = useState<HotelSettings>({
        hotel_name: 'Hotel Aurora',
        default_checkin_time: '14:00',
        default_checkout_time: '12:00',
        hotel_address: '',
        hotel_phone: '',
    });

    // Form inputs: Floors/Rooms configuration
    const [newFloorName, setNewFloorName] = useState<string>('');
    const [newRoomNumber, setNewRoomNumber] = useState<string>('');
    const [newRoomType, setNewRoomType] = useState<'single' | 'double' | 'suite' | 'matrimonial'>('single');
    const [newRoomPrice, setNewRoomPrice] = useState<number>(50.0);
    const [newRoomAdults, setNewRoomAdults] = useState<number>(2);
    const [newRoomChildren, setNewRoomChildren] = useState<number>(0);
    const [newRoomFloorId, setNewRoomFloorId] = useState<number>(0);

    // Form inputs: Check-In / Reservation Guest
    const [guestIdent, setGuestIdent] = useState<string>('');
    const [guestIdentType, setGuestIdentType] = useState<string>('05');
    const [guestName, setGuestName] = useState<string>('');
    const [guestEmail, setGuestEmail] = useState<string>('');
    const [guestPhone, setGuestPhone] = useState<string>('');
    const [guestAddress, setGuestAddress] = useState<string>('');
    const [checkInAdults, setCheckInAdults] = useState<number>(1);
    const [checkInChildren, setCheckInChildren] = useState<number>(0);
    const [plannedCheckOutDate, setPlannedCheckOutDate] = useState<string>('');
    const [reservationCheckInDate, setReservationCheckInDate] = useState<string>('');
    const [depositAmount, setDepositAmount] = useState<number>(0);
    const [depositPaymentMethod, setDepositPaymentMethod] = useState<string>('cash');
    const [notes, setNotes] = useState<string>('');

    // Form inputs: Check-Out
    const [paymentMethod, setPaymentMethod] = useState<string>('cash');
    const [processSRI, setProcessSRI] = useState<boolean>(false);
    const [billingIdentType, setBillingIdentType] = useState<string>('05');
    const [billingIdent, setBillingIdent] = useState<string>('');
    const [billingName, setBillingName] = useState<string>('');
    const [billingEmail, setBillingEmail] = useState<string>('');
    const [billingPhone, setBillingPhone] = useState<string>('');
    const [billingAddress, setBillingAddress] = useState<string>('');

    // SRI config settings
    const [sriIsActive, setSriIsActive] = useState<boolean>(false);
    const [sriVsrToken, setSriVsrToken] = useState<string>('');
    const [sriEnvironment, setSriEnvironment] = useState<string>('TEST');
    const [sriEstCode, setSriEstCode] = useState<string>('001');
    const [sriEmPoint, setSriEmPoint] = useState<string>('001');

    // Live WebSocket / API processing feedback
    const [wsProcessing, setWsProcessing] = useState<boolean>(false);
    const [wsStatusMessage, setWsStatusMessage] = useState<string>('');
    const [wsStatusCode, setWsStatusCode] = useState<string>('');

    // Table view & calendar state
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [todayAlerts, setTodayAlerts] = useState<{ arrivals: Reservation[]; departures: Reservation[] }>({ arrivals: [], departures: [] });
    const [calendarStart, setCalendarStart] = useState<Date>(new Date());

    // Fetch initial data
    const loadHotelData = async () => {
        try {
            setLoading(true);
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
            };

            const t = Date.now();
            const floorsRes = await fetch(`${API_BASE}/api/rooms/floors/?_=${t}`, { headers });
            const roomsRes = await fetch(`${API_BASE}/api/rooms/rooms/?_=${t}`, { headers });
            const settingsRes = await fetch(`${API_BASE}/api/reservations/hotel-settings/?_=${t}`, { headers });
            const resRes = await fetch(`${API_BASE}/api/reservations/?_=${t}`, { headers });
            const alertsRes = await fetch(`${API_BASE}/api/reservations/today-alerts/?_=${t}`, { headers });

            if (floorsRes.ok && roomsRes.ok) {
                const floorsJson = await floorsRes.json();
                const roomsJson = await roomsRes.json();
                const resJson = await resRes.json();

                const floorsData: Floor[] = Array.isArray(floorsJson) ? floorsJson : (floorsJson.results ?? []);
                const roomsData: Room[] = Array.isArray(roomsJson) ? roomsJson : (roomsJson.results ?? []);
                const resData: Reservation[] = Array.isArray(resJson) ? resJson : (resJson.results ?? []);

                setFloors(floorsData);
                setRooms(roomsData);
                setReservations(resData);

                if (floorsData.length > 0 && activeFloorTab === null) {
                    setActiveFloorTab(floorsData[0].id);
                }
            } else {
                toast('Error al cargar datos del hotel', 'error');
            }

            if (settingsRes.ok) {
                const settingsJson = await settingsRes.json();
                setHotelSettings(settingsJson);
            }

            if (alertsRes.ok) {
                const alertsJson = await alertsRes.json();
                setTodayAlerts(alertsJson);
            }
        } catch (error) {
            console.error(error);
            toast('Fallo al conectar con el servidor', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHotelData();
        loadSRIConfig();
    }, []);

    // Load SRI Config
    const loadSRIConfig = async () => {
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
            };
            const res = await fetch(`${API_BASE}/api/reservations/sri-config/`, { headers });
            if (res.ok) {
                const data = await res.json();
                setSriIsActive(data.is_active);
                setSriEnvironment(data.environment);
                setSriEstCode(data.establishment_code);
                setSriEmPoint(data.emission_point);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Save SRI Config
    const saveSRIConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
            };
            const payload = {
                is_active: sriIsActive,
                environment: sriEnvironment,
                establishment_code: sriEstCode,
                emission_point: sriEmPoint,
            };
            if (sriVsrToken) {
                Object.assign(payload, { vsr_token: sriVsrToken });
            }

            const res = await fetch(`${API_BASE}/api/reservations/sri-config/`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast('Configuración SRI guardada con éxito', 'success');
                setShowSRIConfigModal(false);
                setSriVsrToken('');
            } else {
                toast('Error al guardar configuración', 'error');
            }
        } catch (err) {
            toast('Fallo de conexión', 'error');
        }
    };

    // Save Hotel Settings
    const saveHotelSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
            };
            const res = await fetch(`${API_BASE}/api/reservations/hotel-settings/update-settings/`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(hotelSettings)
            });
            if (res.ok) {
                const data = await res.json();
                setHotelSettings(data);
                toast('Configuración del hotel guardada', 'success');
                setShowHotelSettingsModal(false);
            } else {
                toast('Error al guardar configuración', 'error');
            }
        } catch (err) {
            toast('Error de red', 'error');
        }
    };

    // Search Guest by ID
    const searchGuest = async () => {
        if (!guestIdent) return;
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
            };
            const res = await fetch(`${API_BASE}/api/guests/by-id/?identification=${guestIdent}`, { headers });
            if (res.ok) {
                const data = await res.json();
                setGuestName(data.name);
                setGuestEmail(data.email || '');
                setGuestPhone(data.phone || '');
                setGuestAddress(data.address || '');
                setGuestIdentType(data.identification_type);
                toast('Huésped encontrado', 'success');
            } else {
                toast('Huésped nuevo detectado', 'info');
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Search Billing Guest by ID
    const searchBillingGuest = async () => {
        if (!billingIdent) return;
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
            };
            const res = await fetch(`${API_BASE}/api/guests/by-id/?identification=${billingIdent}`, { headers });
            if (res.ok) {
                const data = await res.json();
                setBillingName(data.name);
                setBillingEmail(data.email || '');
                setBillingPhone(data.phone || '');
                setBillingAddress(data.address || '');
                setBillingIdentType(data.identification_type);
                toast('Datos de facturación recuperados', 'success');
            } else {
                toast('Cliente nuevo de facturación', 'info');
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Handle Create Floor
    const handleCreateFloor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFloorName.trim()) {
            toast('Escribe el nombre del piso', 'error');
            return;
        }
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
            };
            const res = await fetch(`${API_BASE}/api/rooms/floors/`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ name: newFloorName.trim(), order: floors.length })
            });
            if (res.ok) {
                toast('Piso creado', 'success');
                setNewFloorName('');
                await loadHotelData();
            } else {
                toast('Error al crear el piso', 'error');
            }
        } catch (err) {
            console.error(err);
            toast('Error de red al crear piso', 'error');
        }
    };

    // Handle Create Room
    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRoomNumber) {
            toast('Ingresa el número de habitación', 'error');
            return;
        }
        const floorId = newRoomFloorId || (floors.length > 0 ? floors[0].id : null);
        if (!floorId) {
            toast('Primero crea un piso', 'error');
            return;
        }
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
            };
            const payload = {
                floor: floorId,
                room_number: newRoomNumber,
                room_type: newRoomType,
                price_per_night: newRoomPrice,
                adult_capacity: newRoomAdults,
                child_capacity: newRoomChildren
            };
            const res = await fetch(`${API_BASE}/api/rooms/rooms/`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                toast('Habitación agregada', 'success');
                setNewRoomNumber('');
                setNewRoomPrice(50.0);
                loadHotelData();
            } else {
                const errData = await res.json();
                toast(`Error: ${JSON.stringify(errData)}`, 'error');
            }
        } catch (err) {
            console.error(err);
            toast('Error de red al crear habitación', 'error');
        }
    };

    // Handle Check-in Action
    const handleCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRoom) return;
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
            };
            
            const checkOutDateTime = `${plannedCheckOutDate}T${hotelSettings.default_checkout_time}:00`;

            const payload = {
                room: selectedRoom.id,
                number_of_adults: checkInAdults,
                number_of_children: checkInChildren,
                planned_check_out: checkOutDateTime,
                notes: notes,
                guest_data: {
                    identification_type: guestIdentType,
                    identification: guestIdent,
                    name: guestName,
                    email: guestEmail,
                    phone: guestPhone,
                    address: guestAddress
                }
            };

            const res = await fetch(`${API_BASE}/api/reservations/check-in/`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast('Check-in registrado con éxito', 'success');
                setShowCheckInModal(false);
                clearForms();
                loadHotelData();
            } else {
                const data = await res.json();
                toast(data.error || data.non_field_errors?.[0] || 'Error al registrar check-in', 'error');
            }
        } catch (err) {
            toast('Fallo en la conexión', 'error');
        }
    };

    // Handle Check-in of a Reserved Booking
    const handleCheckInReserved = async (resId: number) => {
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
            };
            const res = await fetch(`${API_BASE}/api/reservations/check-in/`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ reservation_id: resId })
            });
            if (res.ok) {
                toast('Check-in realizado con éxito', 'success');
                loadHotelData();
            } else {
                const errData = await res.json();
                toast(errData.error || 'Error al iniciar Check-in', 'error');
            }
        } catch (err) {
            toast('Error de conexión', 'error');
        }
    };

    // Handle Reserve (Booking) Action
    const handleReserve = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRoom) return;
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
            };

            const checkInDateTime = `${reservationCheckInDate}T${hotelSettings.default_checkin_time}:00`;
            const checkOutDateTime = `${plannedCheckOutDate}T${hotelSettings.default_checkout_time}:00`;

            const payload = {
                room: selectedRoom.id,
                check_in_date: checkInDateTime,
                planned_check_out: checkOutDateTime,
                number_of_adults: checkInAdults,
                number_of_children: checkInChildren,
                deposit_amount: depositAmount,
                payment_method: depositPaymentMethod,
                notes: notes,
                guest_data: {
                    identification_type: guestIdentType,
                    identification: guestIdent,
                    name: guestName,
                    email: guestEmail,
                    phone: guestPhone,
                    address: guestAddress
                }
            };

            const res = await fetch(`${API_BASE}/api/reservations/reserve/`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast('Reserva anticipada registrada', 'success');
                setShowReserveModal(false);
                clearForms();
                loadHotelData();
            } else {
                const data = await res.json();
                toast(data.error || data.non_field_errors?.[0] || 'Error al registrar reserva', 'error');
            }
        } catch (err) {
            toast('Error de red', 'error');
        }
    };

    const clearForms = () => {
        setGuestIdent('');
        setGuestName('');
        setGuestEmail('');
        setGuestPhone('');
        setGuestAddress('');
        setCheckInAdults(1);
        setCheckInChildren(0);
        setPlannedCheckOutDate('');
        setReservationCheckInDate('');
        setDepositAmount(0);
        setDepositPaymentMethod('cash');
        setNotes('');
    };

    // Action Room Click
    const handleRoomClick = async (room: Room) => {
        clearForms();
        setSelectedRoom(room);
        if (room.status === 'available') {
            const todayStr = getLocalISODate();
            const pendingToday = reservations.find(r => r.room === room.id && r.status === 'reserved' && (r.check_in_date || '').split('T')[0] === todayStr);
            if (pendingToday) {
                if (window.confirm(`La habitación tiene una reserva pendiente para ${pendingToday.guest_details.name}. ¿Desea hacer el Check-In para esta reserva?`)) {
                    handleCheckInReserved(pendingToday.id);
                    return;
                }
            }
            setShowCheckInModal(true);
        }
 else if (room.status === 'occupied') {
            try {
                const headers = {
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                };
                const res = await fetch(`${API_BASE}/api/reservations/?room=${room.id}&status=active`, { headers });
                if (res.ok) {
                    const data: Reservation[] = await res.json();
                    if (data.length > 0) {
                        const activeRes = data[0];
                        setActiveReservation(activeRes);
                        
                        setBillingIdentType(activeRes.guest_details.identification_type);
                        setBillingIdent(activeRes.guest_details.identification);
                        setBillingName(activeRes.guest_details.name);
                        setBillingEmail(activeRes.guest_details.email || '');
                        setBillingPhone(activeRes.guest_details.phone || '');
                        setBillingAddress(activeRes.guest_details.address || '');

                        setShowCheckOutModal(true);
                    } else {
                        toast('No se encontró reservación activa.', 'error');
                    }
                }
            } catch (err) {
                toast('Fallo al recuperar reservación', 'error');
            }
        } else if (room.status === 'cleaning') {
            if (window.confirm(`¿Desea marcar la habitación ${room.room_number} como Disponible?`)) {
                try {
                    const headers = {
                        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                        'Content-Type': 'application/json'
                    };
                    const res = await fetch(`${API_BASE}/api/rooms/rooms/${room.id}/set-available/`, {
                        method: 'POST',
                        headers
                    });
                    if (res.ok) {
                        toast('Habitación lista y disponible', 'success');
                        loadHotelData();
                    }
                } catch (err) {
                    toast('Error de red', 'error');
                }
            }
        }
    };

    // QR Code Check-in scan logic
    useEffect(() => {
        if (qrCodeInput.trim()) {
            const found = reservations.find(r => r.reservation_code.toUpperCase() === qrCodeInput.trim().toUpperCase());
            setScannedRes(found || null);
        } else {
            setScannedRes(null);
        }
    }, [qrCodeInput, reservations]);

    const handleCheckInFromQR = async () => {
        if (!scannedRes) return;
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
            };
            const todayStr = getLocalISODate();
            const checkOutDateTime = `${todayStr}T${hotelSettings.default_checkout_time}:00`;

            const payload = {
                reservation_id: scannedRes.id,
                planned_check_out: checkOutDateTime,
                number_of_adults: scannedRes.number_of_adults,
                number_of_children: scannedRes.number_of_children,
            };

            const res = await fetch(`${API_BASE}/api/reservations/check-in/`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast('Check-In de reserva completado con éxito', 'success');
                setShowQRScannerModal(false);
                setQrCodeInput('');
                setScannedRes(null);
                loadHotelData();
            } else {
                const errData = await res.json();
                toast(`Error: ${JSON.stringify(errData.detail || JSON.stringify(errData))}`, 'error');
            }
        } catch (err) {
            console.error(err);
            toast('Error de red al registrar check-in', 'error');
        }
    };

    // Cancel reservation
    const handleCancelReservation = async (id: number) => {
        if (!window.confirm('¿Está seguro de que desea cancelar esta reservación?')) return;
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
            };
            const res = await fetch(`${API_BASE}/api/reservations/${id}/cancel/`, {
                method: 'POST',
                headers
            });
            if (res.ok) {
                toast('Reservación cancelada', 'success');
                loadHotelData();
            } else {
                toast('Error al cancelar la reservación', 'error');
            }
        } catch (err) {
            toast('Error de red', 'error');
        }
    };

    // Handle Check-out Action
    const handleCheckOut = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeReservation) return;

        setWsProcessing(true);
        setWsStatusMessage('Iniciando cobro...');
        setWsStatusCode('DRAFT');

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws/invoice/${activeReservation.id}/`;
        const socket = new WebSocket(wsUrl);

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setWsStatusCode(data.status);
            setWsStatusMessage(data.message);
        };

        socket.onerror = (err) => {
            console.error('WebSocket Error:', err);
        };

        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
            };
            const payload = {
                payment_method: paymentMethod,
                process_sri: processSRI,
                billing_data: processSRI ? {
                    identification_type: billingIdentType,
                    identification: billingIdent,
                    name: billingName,
                    email: billingEmail,
                    address: billingAddress,
                    phone: billingPhone
                } : {}
            };

            const res = await fetch(`${API_BASE}/api/reservations/${activeReservation.id}/check-out/`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const result = await res.json();
                if (processSRI && result.invoice_error) {
                    toast(`Alerta: Checkout realizado pero falló la factura: ${result.invoice_error}`, 'warning');
                } else {
                    toast('Check-out procesado correctamente', 'success');
                }
                setTimeout(() => {
                    setWsProcessing(false);
                    setShowCheckOutModal(false);
                    loadHotelData();
                }, 1500);
            } else {
                toast('Error al procesar check-out', 'error');
                setWsProcessing(false);
            }
        } catch (err) {
            toast('Error de red', 'error');
            setWsProcessing(false);
        } finally {
            setTimeout(() => socket.close(), 5000);
        }
    };

    // Copy public link to clipboard
    const copyPublicLink = (code: string) => {
        const publicUrl = `${window.location.protocol}//${window.location.host}/reserva/${code}`;
        navigator.clipboard.writeText(publicUrl);
        toast('Enlace copiado al portapapeles', 'success');
    };

    // Calendar Navigation helpers
    const changeCalendarWeek = (offset: number) => {
        const d = new Date(calendarStart);
        d.setDate(d.getDate() + offset * 7);
        setCalendarStart(d);
    };

    const getCalendarDays = () => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(calendarStart);
            d.setDate(d.getDate() + i);
            days.push(d);
        }
        return days;
    };

    const getReservationForRoomAndDate = (roomId: number, date: Date) => {
        const dateStr = getLocalISODate(date);
        return reservations.find(res => {
            if (res.room !== roomId) return false;
            if (res.status === 'cancelled' || res.status === 'checked_out') return false;
            const checkIn = res.check_in_date.split('T')[0];
            const checkOut = (res.planned_check_out || res.check_out_date || '').split('T')[0];
            return dateStr >= checkIn && dateStr < checkOut;
        });
    };

    // Filtered rooms for the calendar view
    const filteredCalendarRooms = rooms.filter(room => {
        if (calendarFloorFilter !== 'all' && room.floor !== parseInt(calendarFloorFilter)) {
            return false;
        }
        if (calendarRoomTypeFilter !== 'all' && room.room_type !== calendarRoomTypeFilter) {
            return false;
        }
        if (calendarRoomSearch && !room.room_number.includes(calendarRoomSearch)) {
            return false;
        }
        if (calendarGuestSearch) {
            const hasMatchingRes = getCalendarDays().some(day => {
                const res = getReservationForRoomAndDate(room.id, day);
                if (!res) return false;
                return (
                    (res.guest_details?.name || '').toLowerCase().includes(calendarGuestSearch.toLowerCase()) ||
                    (res.reservation_code || '').toLowerCase().includes(calendarGuestSearch.toLowerCase())
                );
            });
            if (!hasMatchingRes) return false;
        }
        return true;
    });

    const getNextReservationDate = (roomId: number) => {
        const futureRes = reservations
            .filter(r => r.room === roomId && r.status === 'reserved' && new Date(r.check_in_date) > new Date())
            .sort((a, b) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime());
        if (futureRes.length > 0) {
            return futureRes[0];
        }
        return null;
    };

    const nextReservation = selectedRoom ? getNextReservationDate(selectedRoom.id) : null;


    // Filtered reservations for Pestaña de Reservas
    const filteredReservations = reservations.filter(res => {
        const matchesSearch = 
            (res.reservation_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (res.guest_details?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (res.room_details?.room_number || '').includes(searchQuery);

        if (statusFilter === 'all') return matchesSearch;
        return res.status === statusFilter && matchesSearch;
    });


    return (
        <div className="page-container p-6 bg-slate-50 min-h-screen text-slate-800">
            {/* Header following Fast-Food colors (bg-white dashboard panels with dark slate buttons) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-5 mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                        <i className="bi bi-building-fill text-slate-950"></i> {hotelSettings.hotel_name}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Gestión completa de habitaciones, reservas anticipadas con depósito, calendario interactivo y facturación SRI.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={() => setShowHotelSettingsModal(true)} 
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 font-semibold shadow-sm transition-all text-xs"
                    >
                        <i className="bi bi-gear-fill text-slate-500"></i> Ajustes Hotel
                    </button>
                    <button 
                        onClick={() => setShowSRIConfigModal(true)} 
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 font-semibold shadow-sm transition-all text-xs"
                    >
                        <i className="bi bi-shield-fill-check text-emerald-600"></i> Credenciales SRI
                    </button>
                    <button 
                        onClick={() => {
                            if (floors.length > 0) setNewRoomFloorId(floors[0].id);
                            setShowConfigModal(true);
                        }} 
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-semibold shadow-sm transition-all text-xs"
                    >
                        <i className="bi bi-plus-circle-fill"></i> Pisos & Habitaciones
                    </button>
                    <button 
                        onClick={() => setShowQRScannerModal(true)} 
                        className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black px-4 py-2 rounded-xl flex items-center gap-2 font-black shadow-sm transition-all text-xs"
                    >
                        <i className="bi bi-qr-code-scan"></i> Escanear QR Check-In
                    </button>
                </div>
            </div>

            {/* Notification Banner Alerts in beautiful rounded boxes */}
            {(todayAlerts.arrivals.length > 0 || todayAlerts.departures.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {todayAlerts.arrivals.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 shadow-sm">
                            <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                                <i className="bi bi-bell-fill text-lg"></i>
                            </div>
                            <div>
                                <span className="font-bold text-sm text-amber-950 block">Entradas hoy ({todayAlerts.arrivals.length})</span>
                                <span className="text-xs text-amber-800">
                                    Huéspedes que ingresan hoy: {todayAlerts.arrivals.map(r => r.guest_details.name).join(', ')}
                                </span>
                            </div>
                        </div>
                    )}
                    {todayAlerts.departures.length > 0 && (
                        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-3 shadow-sm">
                            <div className="p-2.5 bg-red-100 text-red-800 rounded-xl">
                                <i className="bi bi-exclamation-triangle-fill text-lg"></i>
                            </div>
                            <div>
                                <span className="font-bold text-sm text-red-950 block">Salidas Pendientes / Atrasados ({todayAlerts.departures.length})</span>
                                <span className="text-xs text-red-800">
                                    Paso límite de check-out: {todayAlerts.departures.map(r => `${r.guest_details.name} (Hab ${r.room_details?.room_number || ''})`).join(', ')}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Views Tabs Navigation (Fast-Food matching design) */}
            <div className="flex gap-2 border-b border-slate-200 mb-6 overflow-x-auto pb-1" id="dashboard-tab-navigation">
                <button
                    onClick={() => setActiveViewTab('croquis')}
                    className={`px-5 py-2.5 font-bold text-xs transition-all border-b-2 rounded-t-xl ${
                        activeViewTab === 'croquis' ? 'border-slate-900 text-slate-900 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <i className="bi bi-grid-3x3-gap-fill mr-1.5"></i> Croquis de Habitaciones
                </button>
                <button
                    onClick={() => setActiveViewTab('reservas')}
                    className={`px-5 py-2.5 font-bold text-xs transition-all border-b-2 rounded-t-xl ${
                        activeViewTab === 'reservas' ? 'border-slate-900 text-slate-900 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <i className="bi bi-calendar3-event-fill mr-1.5"></i> Gestión de Reservaciones
                </button>
                <button
                    onClick={() => setActiveViewTab('calendario')}
                    className={`px-5 py-2.5 font-bold text-xs transition-all border-b-2 rounded-t-xl ${
                        activeViewTab === 'calendario' ? 'border-slate-900 text-slate-900 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <i className="bi bi-calendar-range-fill mr-1.5"></i> Calendario de Ocupación
                </button>
            </div>

            {/* View Render */}
            {activeViewTab === 'croquis' && (
                <div>
                    {floors.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200">
                                <i className="bi bi-grid-fill text-2xl"></i>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1">Sin infraestructura configurada</h3>
                            <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">Por favor agregue pisos y habitaciones para comenzar.</p>
                            <button 
                                onClick={() => setShowConfigModal(true)} 
                                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm"
                            >
                                Configurar Ahora
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex gap-1.5 border-b border-slate-200 mb-6 overflow-x-auto pb-1">
                                {floors.map(floor => (
                                    <button
                                        key={floor.id}
                                        onClick={() => setActiveFloorTab(floor.id)}
                                        className={`px-4 py-2 font-bold text-xs transition-all rounded-lg ${
                                            activeFloorTab === floor.id 
                                                ? 'bg-slate-900 text-white' 
                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <i className="bi bi-layers-fill mr-1"></i> {floor.name}
                                    </button>
                                ))}
                            </div>

                            {/* Rooms Grid with high visual contrast */}
                            {loading ? (
                                <div className="text-center py-12 text-slate-500">Cargando habitaciones...</div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {rooms
                                        .filter(room => room.floor === activeFloorTab)
                                        .map(room => {
                                            const hasReservation = reservations.some(r => r.room === room.id && r.status === 'reserved');
                                            const computedStatus = (room.status === 'available' && hasReservation) ? 'reserved' : room.status;

                                            const statusStyles = {
                                                available: 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-500 hover:shadow-emerald-100/50 text-emerald-800',
                                                occupied: 'bg-rose-50/70 border-rose-300 hover:border-rose-500 hover:shadow-rose-100/50 text-rose-800',
                                                reserved: 'bg-amber-50/70 border-amber-300 hover:border-amber-500 hover:shadow-amber-100/50 text-amber-800',
                                                cleaning: 'bg-blue-50/70 border-blue-300 hover:border-blue-500 hover:shadow-blue-100/50 text-blue-800',
                                                maintenance: 'bg-slate-100/70 border-slate-300 text-slate-600'
                                            };

                                            const badgeColors = {
                                                available: 'bg-emerald-100/80 text-emerald-800 border-emerald-300',
                                                occupied: 'bg-rose-100/80 text-rose-800 border-rose-300',
                                                reserved: 'bg-amber-100/80 text-amber-800 border-amber-300',
                                                cleaning: 'bg-blue-100/80 text-blue-800 border-blue-300',
                                                maintenance: 'bg-slate-200 text-slate-700 border-slate-350'
                                            };

                                            const statusLabels = {
                                                available: 'Disponible',
                                                occupied: 'Ocupada',
                                                reserved: 'Reservada',
                                                cleaning: 'Limpieza',
                                                maintenance: 'Mantenimiento'
                                            };

                                            return (
                                                <div
                                                    key={room.id}
                                                    onClick={() => handleRoomClick(room)}
                                                    className={`p-5 rounded-2xl border-2 bg-white shadow-sm cursor-pointer transition-all duration-250 transform hover:-translate-y-1 ${statusStyles[computedStatus]}`}
                                                >
                                                    <div className="flex justify-between items-start mb-4">
                                                        <span className="text-2xl font-bold text-slate-800">{room.room_number}</span>
                                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border tracking-wide uppercase ${badgeColors[computedStatus]}`}>
                                                            {statusLabels[computedStatus]}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-slate-600 mb-1.5">
                                                        <i className="bi bi-tag-fill mr-1.5 text-slate-400"></i> {room.room_type_display}
                                                    </div>
                                                    <div className="text-xs text-slate-600 mb-4">
                                                        <i className="bi bi-people-fill mr-1.5 text-slate-400"></i> {room.adult_capacity} Ad / {room.child_capacity} Ni
                                                    </div>
                                                    <div className="text-sm font-bold text-slate-900 pt-3 border-t border-slate-200/80 flex justify-between items-center">
                                                        <span>Tarifa</span>
                                                        <span className="text-slate-800 font-extrabold">${room.price_per_night} <span className="text-[10px] text-slate-500 font-normal">/ noche</span></span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {activeViewTab === 'reservas' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    {/* Filters bar */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h3 className="text-lg font-bold text-slate-900">Listado General de Reservaciones</h3>
                        <div className="flex flex-wrap gap-2 items-center">
                            <input 
                                type="text"
                                placeholder="Buscar por código, huésped..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="border border-slate-350 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 w-full sm:w-60 bg-white text-slate-800"
                            />
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="border border-slate-350 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white text-slate-700"
                            >
                                <option value="all">Todos los Estados</option>
                                <option value="reserved">Reservada (Pendiente)</option>
                                <option value="active">Activa (Ocupado)</option>
                                <option value="checked_out">Completada (Checkout)</option>
                                <option value="cancelled">Cancelada</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-sm divide-y divide-slate-200">
                            <thead>
                                <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                                    <th className="p-4 border-b border-slate-200">Código</th>
                                    <th className="p-4 border-b border-slate-200">Habitación</th>
                                    <th className="p-4 border-b border-slate-200">Huésped</th>
                                    <th className="p-4 border-b border-slate-200">Ingreso</th>
                                    <th className="p-4 border-b border-slate-200">Salida Planeada</th>
                                    <th className="p-4 border-b border-slate-200">Total Estimado</th>
                                    <th className="p-4 border-b border-slate-200">Depósito Pagado</th>
                                    <th className="p-4 border-b border-slate-200">Estado</th>
                                    <th className="p-4 border-b border-slate-200 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                                {filteredReservations.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-slate-400 italic">No se encontraron reservaciones con los criterios de búsqueda.</td>
                                    </tr>
                                ) : (
                                    filteredReservations.map(res => (
                                        <tr key={res.id} className="hover:bg-slate-50/50 transition duration-150">
                                            <td className="p-4 font-mono font-bold text-slate-900">{res.reservation_code}</td>
                                            <td className="p-4 font-medium text-slate-800">Hab {res.room_details?.room_number} <span className="block text-[10px] text-slate-400 font-normal">{res.room_details?.room_type_display}</span></td>
                                            <td className="p-4 font-medium text-slate-800">{res.guest_details?.name}</td>
                                            <td className="p-4">{new Date(res.check_in_date).toLocaleDateString()}</td>
                                            <td className="p-4">{(res.planned_check_out || res.check_out_date) ? new Date(res.planned_check_out || res.check_out_date!).toLocaleDateString() : 'N/A'}</td>
                                            <td className="p-4 font-bold text-slate-900">${res.total_estimated || res.total_amount}</td>
                                            <td className="p-4">
                                                {Number(res.deposit_amount) > 0 ? (
                                                    <span className="text-cyan-600 font-bold">${res.deposit_amount}</span>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                                                    res.status === 'active' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                                                    res.status === 'reserved' ? 'bg-cyan-50 border-cyan-200 text-cyan-800' :
                                                    res.status === 'checked_out' ? 'bg-slate-100 border-slate-200 text-slate-600' :
                                                    'bg-red-50 border-red-200 text-red-800'
                                                }`}>
                                                    {res.status_display}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right flex justify-end gap-1.5">
                                                <button 
                                                    onClick={() => copyPublicLink(res.reservation_code)}
                                                    className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition"
                                                    title="Copiar Link para Huésped"
                                                >
                                                    <i className="bi bi-link-45deg"></i>
                                                </button>
                                                {res.status === 'reserved' && (
                                                    <button 
                                                        onClick={() => handleCheckInReserved(res.id)}
                                                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition"
                                                    >
                                                        Check-In
                                                    </button>
                                                )}
                                                {res.status === 'active' && (
                                                    <button 
                                                        onClick={() => {
                                                            const roomObj = rooms.find(r => r.id === res.room);
                                                            if (roomObj) handleRoomClick(roomObj);
                                                        }}
                                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition"
                                                    >
                                                        Check-Out
                                                    </button>
                                                )}
                                                {(res.status === 'reserved' || res.status === 'active') && (
                                                    <button 
                                                        onClick={() => handleCancelReservation(res.id)}
                                                        className="p-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 rounded-xl transition"
                                                        title="Cancelar"
                                                    >
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeViewTab === 'calendario' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Calendario Visual de Reservas</h3>
                            <p className="text-xs text-slate-500">Muestra la ocupación diaria detallada de las habitaciones.</p>
                        </div>
                        <div className="flex gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto justify-between">
                            <button onClick={() => changeCalendarWeek(-1)} className="hover:bg-white text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition"><i className="bi bi-chevron-left"></i> Anterior</button>
                            <span className="font-bold px-4 py-1.5 text-xs text-slate-800 flex items-center">
                                {calendarStart.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })} — {new Date(new Date(calendarStart).setDate(calendarStart.getDate() + 6)).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <button onClick={() => changeCalendarWeek(1)} className="hover:bg-white text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition">Siguiente <i className="bi bi-chevron-right"></i></button>
                        </div>
                    </div>

                    {/* Filtros de Calendario para Escala Masiva */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Filtrar por Piso</label>
                            <select
                                value={calendarFloorFilter}
                                onChange={e => setCalendarFloorFilter(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
                            >
                                <option value="all">Todos los Pisos</option>
                                {floors.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo de Habitación</label>
                            <select
                                value={calendarRoomTypeFilter}
                                onChange={e => setCalendarRoomTypeFilter(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
                            >
                                <option value="all">Todos los Tipos</option>
                                <option value="single">Simple (Single)</option>
                                <option value="double">Doble (Double)</option>
                                <option value="suite">Suite</option>
                                <option value="matrimonial">Matrimonial</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Número de Habitación</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar hab..."
                                    value={calendarRoomSearch}
                                    onChange={e => setCalendarRoomSearch(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
                                />
                                <i className="bi bi-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Huésped o Código</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Nombre o código..."
                                    value={calendarGuestSearch}
                                    onChange={e => setCalendarGuestSearch(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
                                />
                                <i className="bi bi-person-fill absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                            </div>
                        </div>
                    </div>

                    {/* Timeline representation layout for optimal clarity */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-center text-xs divide-y divide-slate-200 min-w-[800px] table-fixed">
                            <thead>
                                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                    <th className="p-3 text-left w-48 font-semibold uppercase tracking-wider">Habitación</th>
                                    {getCalendarDays().map((day, idx) => (
                                        <th key={idx} className="p-3 border-l border-slate-200 w-32">
                                            <span className="block capitalize text-[10px] text-slate-400 font-normal">{day.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                                            <span className="block text-slate-800 text-sm font-extrabold mt-0.5">{day.getDate()}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {rooms.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-slate-400 italic">Cargue habitaciones para visualizar el calendario.</td>
                                    </tr>
                                ) : filteredCalendarRooms.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-slate-400 italic">No se encontraron habitaciones con los filtros aplicados.</td>
                                    </tr>
                                ) : (
                                    filteredCalendarRooms.map(room => (
                                        <tr key={room.id} className="hover:bg-slate-50/50 transition">
                                            <td className="p-4 text-left font-bold text-slate-800 border-r border-slate-200 bg-slate-50/30">
                                                <div className="font-extrabold text-sm text-slate-900">Hab {room.room_number}</div>
                                                <span className="text-[10px] text-slate-500 font-medium">{room.room_type_display}</span>
                                            </td>
                                            {getCalendarDays().map((day, idx) => {
                                                const res = getReservationForRoomAndDate(room.id, day);
                                                return (
                                                    <td key={idx} className="p-2 border-l border-slate-250 min-h-[56px] relative align-middle">
                                                        {res ? (
                                                            <div 
                                                                className={`p-2 rounded-xl text-center font-bold text-[10px] shadow-sm select-none truncate ${
                                                                    res.status === 'active' 
                                                                        ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                                                                        : 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                                                                }`}
                                                                title={`Cliente: ${res.guest_details.name}\nCódigo: ${res.reservation_code}\nFechas: ${new Date(res.check_in_date).toLocaleDateString()} al ${new Date(res.planned_check_out || res.check_out_date!).toLocaleDateString()}`}
                                                            >
                                                                <span className="block truncate font-extrabold">{res.guest_details.name}</span>
                                                                <span className="block font-mono text-[9px] opacity-75">{res.reservation_code}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 border border-emerald-250 px-2 py-1 rounded-lg">Libre</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Check-In Form (styled with glass backdrop and system color inputs) */}
            {showCheckInModal && selectedRoom && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <form onSubmit={handleCheckIn} className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
                        <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg">Ingreso Inmediato (Check-In) — Hab {selectedRoom.room_number}</h3>
                            <button type="button" onClick={() => setShowCheckInModal(false)} className="text-white/80 hover:text-white"><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-5">
                            {/* Fast switch toggle */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                                <div>
                                    <span className="text-xs font-bold text-slate-700 block">¿Es una reserva programada a futuro?</span>
                                    <span className="text-[10px] text-slate-500 block">Asigna un pasajero para días posteriores</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCheckInModal(false);
                                        setShowReserveModal(true);
                                    }}
                                    className="bg-white border border-slate-255 hover:bg-slate-50 text-slate-700 px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition"
                                >
                                    Reservar para Fecha
                                </button>
                            </div>

                            {/* Guest Search Fields */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1.5"><i className="bi bi-person-fill text-slate-500 mr-1"></i> Huésped Principal</h4>
                                <div className="grid grid-cols-3 gap-3 mb-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Tipo ID</label>
                                        <select 
                                            value={guestIdentType} 
                                            onChange={e => setGuestIdentType(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs bg-white text-slate-800"
                                        >
                                            <option value="05">Cédula</option>
                                            <option value="04">RUC</option>
                                            <option value="06">Pasaporte</option>
                                            <option value="08">ID Exterior</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Identificación</label>
                                        <div className="flex gap-1.5">
                                            <input 
                                                type="text" 
                                                placeholder="1712345678..." 
                                                value={guestIdent}
                                                onChange={e => setGuestIdent(e.target.value)}
                                                className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                                required
                                            />
                                            <button 
                                                type="button" 
                                                onClick={searchGuest}
                                                className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 rounded-xl text-xs font-bold transition"
                                            >
                                                Buscar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Nombre Completo</label>
                                    <input 
                                        type="text" 
                                        placeholder="Nombre y apellido..." 
                                        value={guestName}
                                        onChange={e => setGuestName(e.target.value)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Email</label>
                                        <input 
                                            type="email" 
                                            placeholder="ejemplo@correo.com" 
                                            value={guestEmail}
                                            onChange={e => setGuestEmail(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Teléfono</label>
                                        <input 
                                            type="text" 
                                            placeholder="Celular..." 
                                            value={guestPhone}
                                            onChange={e => setGuestPhone(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Dirección</label>
                                    <input 
                                        type="text" 
                                        placeholder="Dirección fiscal..." 
                                        value={guestAddress}
                                        onChange={e => setGuestAddress(e.target.value)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                    />
                                </div>
                            </div>

                            {/* Details of check-in */}
                            <div>
                                {nextReservation && (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-xl text-xs font-semibold mb-4 flex items-center gap-2">
                                        <i className="bi bi-exclamation-triangle-fill text-amber-600 text-sm"></i>
                                        <span>
                                            Habitación reservada el {new Date(nextReservation.check_in_date).toLocaleDateString()} por {nextReservation.guest_details.name}. La salida debe ser a más tardar el {new Date(nextReservation.check_in_date).toLocaleDateString()}.
                                        </span>
                                    </div>
                                )}
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1.5"><i className="bi bi-clock-fill text-slate-500 mr-1"></i> Detalles de Estadía</h4>
                                <div className="mb-4">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Fecha Programada de Salida</label>
                                    <input 
                                        type="date" 
                                        value={plannedCheckOutDate}
                                        min={getLocalISODate()}
                                        max={nextReservation ? nextReservation.check_in_date.split('T')[0] : undefined}
                                        onChange={e => setPlannedCheckOutDate(e.target.value)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        required
                                    />
                                </div>


                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Adultos (Máx {selectedRoom.adult_capacity})</label>
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max={selectedRoom.adult_capacity}
                                            value={checkInAdults}
                                            onChange={e => setCheckInAdults(parseInt(e.target.value))}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Niños (Máx {selectedRoom.child_capacity})</label>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            max={selectedRoom.child_capacity}
                                            value={checkInChildren}
                                            onChange={e => setCheckInChildren(parseInt(e.target.value))}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Observaciones</label>
                                    <textarea 
                                        rows={2}
                                        placeholder="Comentarios adicionales..."
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                    />
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-xl text-sm font-bold shadow-md transition">
                                Registrar Ingreso
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal: Reserve (Booking Future) Form */}
            {showReserveModal && selectedRoom && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <form onSubmit={handleReserve} className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
                        <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg">Nueva Reserva Anticipada — Hab {selectedRoom.room_number}</h3>
                            <button type="button" onClick={() => setShowReserveModal(false)} className="text-white/80 hover:text-white"><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-5">
                            {/* Toggle switcher */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                                <div>
                                    <span className="text-xs font-bold text-slate-700 block">¿Ingresa hoy el pasajero?</span>
                                    <span className="text-[10px] text-slate-500 block">Cambia para registro inmediato</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowReserveModal(false);
                                        setShowCheckInModal(true);
                                    }}
                                    className="bg-white border border-slate-255 hover:bg-slate-50 text-slate-700 px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition"
                                >
                                    Ingresar Check-In Hoy
                                </button>
                            </div>

                            {/* Guest details */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1.5"><i className="bi bi-person-fill text-slate-500 mr-1"></i> Datos del Huésped</h4>
                                <div className="grid grid-cols-3 gap-3 mb-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Tipo ID</label>
                                        <select 
                                            value={guestIdentType} 
                                            onChange={e => setGuestIdentType(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs bg-white text-slate-800"
                                        >
                                            <option value="05">Cédula</option>
                                            <option value="04">RUC</option>
                                            <option value="06">Pasaporte</option>
                                            <option value="08">ID Exterior</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Identificación</label>
                                        <div className="flex gap-1.5">
                                            <input 
                                                type="text" 
                                                placeholder="Ingresar ID..." 
                                                value={guestIdent}
                                                onChange={e => setGuestIdent(e.target.value)}
                                                className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                                required
                                            />
                                            <button 
                                                type="button" 
                                                onClick={searchGuest}
                                                className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 rounded-xl text-xs font-bold transition"
                                            >
                                                Buscar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Nombre Completo</label>
                                    <input 
                                        type="text" 
                                        placeholder="Razón social..." 
                                        value={guestName}
                                        onChange={e => setGuestName(e.target.value)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Email</label>
                                        <input 
                                            type="email" 
                                            placeholder="ejemplo@correo.com" 
                                            value={guestEmail}
                                            onChange={e => setGuestEmail(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Teléfono</label>
                                        <input 
                                            type="text" 
                                            placeholder="Celular..." 
                                            value={guestPhone}
                                            onChange={e => setGuestPhone(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Dirección</label>
                                    <input 
                                        type="text" 
                                        placeholder="Domicilio..." 
                                        value={guestAddress}
                                        onChange={e => setGuestAddress(e.target.value)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                    />
                                </div>
                            </div>

                            {/* Booking dates */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1.5"><i className="bi bi-clock-fill text-slate-500 mr-1"></i> Período de Reserva</h4>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Fecha Ingreso</label>
                                        <input 
                                            type="date" 
                                            value={reservationCheckInDate}
                                            min={getLocalISODate()}
                                            onChange={e => setReservationCheckInDate(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Fecha Salida</label>
                                        <input 
                                            type="date" 
                                            value={plannedCheckOutDate}
                                            min={reservationCheckInDate || getLocalISODate()}
                                            onChange={e => setPlannedCheckOutDate(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Adultos (Máx {selectedRoom.adult_capacity})</label>
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max={selectedRoom.adult_capacity}
                                            value={checkInAdults}
                                            onChange={e => setCheckInAdults(parseInt(e.target.value))}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Niños (Máx {selectedRoom.child_capacity})</label>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            max={selectedRoom.child_capacity}
                                            value={checkInChildren}
                                            onChange={e => setCheckInChildren(parseInt(e.target.value))}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Advance Payment */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1.5"><i className="bi bi-cash-coin text-slate-500 mr-1"></i> Cobro de Garantía / Depósito</h4>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Monto de Depósito ($)</label>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            min="0"
                                            value={depositAmount}
                                            onChange={e => setDepositAmount(parseFloat(e.target.value) || 0)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Método de Pago</label>
                                        <select 
                                            value={depositPaymentMethod}
                                            disabled={depositAmount <= 0}
                                            onChange={e => setDepositPaymentMethod(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs bg-white text-slate-800"
                                        >
                                            <option value="cash">Efectivo</option>
                                            <option value="card">Tarjeta</option>
                                            <option value="transfer">Transferencia</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Notas especiales</label>
                                    <textarea 
                                        rows={2}
                                        placeholder="Comentarios..."
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                    />
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-xl text-sm font-bold shadow-md transition">
                                Registrar Reservación
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal: Check-Out / Settlement and SRI Invoicing */}
            {showCheckOutModal && selectedRoom && activeReservation && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <form onSubmit={handleCheckOut} className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
                        <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg font-black">Salida de Huésped (Check-Out) — Hab {selectedRoom.room_number}</h3>
                            <button type="button" onClick={() => setShowCheckOutModal(false)} className="text-white/80 hover:text-white" disabled={wsProcessing}>
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>
                        
                        {wsProcessing ? (
                            <div className="p-8 text-center flex flex-col items-center justify-center gap-4">
                                <div className="relative w-20 h-20 flex items-center justify-center">
                                    <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-slate-900 rounded-full border-t-transparent animate-spin"></div>
                                    <i className="bi bi-cloud-arrow-up text-2xl text-slate-700 animate-pulse"></i>
                                </div>
                                <h4 className="font-bold text-slate-800">Procesando Factura Electrónica SRI</h4>
                                <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                                    wsStatusCode === 'AUTHORIZED' ? 'bg-emerald-50 border-emerald-250 text-emerald-800' :
                                    wsStatusCode === 'REJECTED' ? 'bg-rose-50 border-rose-250 text-rose-800' : 'bg-slate-100 border-slate-200 text-slate-700'
                                }`}>
                                    {wsStatusCode || 'ENVIANDO'}
                                </span>
                                <p className="text-xs text-slate-500 italic mt-2">{wsStatusMessage}</p>
                            </div>
                        ) : (
                            <div className="p-6 max-h-[80vh] overflow-y-auto space-y-5">
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-4 text-xs">
                                    <div><span className="text-slate-500 block">Huésped Principal:</span> <strong className="text-slate-800 text-sm block mt-0.5">{activeReservation.guest_details.name}</strong></div>
                                    <div><span className="text-slate-500 block">Check-in inicial:</span> <strong className="text-slate-800 text-sm block mt-0.5">{new Date(activeReservation.check_in_date).toLocaleString()}</strong></div>
                                    <div><span className="text-slate-500 block">Tarifa por Noche:</span> <strong className="text-slate-800 text-sm block mt-0.5">${selectedRoom.price_per_night}</strong></div>
                                    <div><span className="text-slate-500 block">Noches calculadas:</span> <strong className="text-slate-800 text-sm block mt-0.5">{activeReservation.nights_count} noche(s)</strong></div>
                                    <div className="col-span-2 grid grid-cols-2 border-t border-slate-200 pt-3 mt-1">
                                        <div><span className="text-slate-500 block">Depósito previo:</span> <strong className="text-cyan-700 text-sm block mt-0.5">${Number(activeReservation.deposit_amount).toFixed(2)}</strong></div>
                                        <div><span className="text-slate-500 block">Total Estimado:</span> <strong className="text-slate-800 text-sm block mt-0.5">${Number(activeReservation.total_estimated).toFixed(2)}</strong></div>
                                    </div>
                                    <div className="col-span-2 border-t border-slate-200 pt-3 text-right">
                                        {Number(activeReservation.total_estimated) < Number(activeReservation.deposit_amount) ? (
                                            <>
                                                <span className="text-amber-600 text-[10px] font-bold tracking-widest block uppercase">Reembolso / Saldo a Devolver</span>
                                                <strong className="text-2xl font-black text-amber-600">${Math.abs(Number(activeReservation.total_estimated) - Number(activeReservation.deposit_amount)).toFixed(2)}</strong>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-slate-400 text-[10px] font-bold tracking-widest block uppercase">Saldo Pendiente a Cobrar</span>
                                                <strong className="text-2xl font-black text-slate-900">${(Number(activeReservation.total_estimated) - Number(activeReservation.deposit_amount)).toFixed(2)}</strong>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Método de Pago para el Saldo</label>
                                    <select 
                                        value={paymentMethod} 
                                        onChange={e => setPaymentMethod(e.target.value)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs bg-white text-slate-800"
                                    >
                                        <option value="cash">Efectivo</option>
                                        <option value="card">Tarjeta de Crédito/Débito</option>
                                        <option value="transfer">Transferencia Bancaria</option>
                                    </select>
                                </div>

                                {/* Toggle SRI invoicing */}
                                <div className="flex items-center justify-between border-y border-slate-200 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                                            <i className="bi bi-receipt-cutoff text-lg"></i>
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-slate-700 block">Emitir Factura Electrónica (SRI)</span>
                                            <span className="text-[10px] text-slate-500 block">Conectar al portal de SRI FactuExpress</span>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={processSRI} 
                                            onChange={e => setProcessSRI(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                                    </label>
                                </div>

                                {/* SRI billing fields conditionally shown */}
                                {processSRI && (
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 animate-in slide-in-from-top-4 duration-150">
                                        <h4 className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-1.5"><i className="bi bi-person-badge-fill text-slate-500"></i> Datos de Emisión</h4>
                                        
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Tipo ID</label>
                                                <select 
                                                    value={billingIdentType} 
                                                    onChange={e => setBillingIdentType(e.target.value)}
                                                    className="w-full border border-slate-350 rounded-xl p-2 text-xs bg-white text-slate-850"
                                                >
                                                    <option value="05">Cédula</option>
                                                    <option value="04">RUC</option>
                                                    <option value="06">Pasaporte</option>
                                                    <option value="08">ID Exterior</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">N. Identificación</label>
                                                <div className="flex gap-1.5">
                                                    <input 
                                                        type="text" 
                                                        value={billingIdent}
                                                        onChange={e => setBillingIdent(e.target.value)}
                                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                                        required
                                                    />
                                                    <button 
                                                        type="button" 
                                                        onClick={searchBillingGuest}
                                                        className="bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3.5 rounded-xl text-slate-700 text-xs font-bold"
                                                    >
                                                        Buscar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Razón Social / Nombre</label>
                                            <input 
                                                type="text" 
                                                value={billingName}
                                                onChange={e => setBillingName(e.target.value)}
                                                className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                                required
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Email Destinatario</label>
                                                <input 
                                                    type="email" 
                                                    value={billingEmail}
                                                    onChange={e => setBillingEmail(e.target.value)}
                                                    className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Teléfono</label>
                                                <input 
                                                    type="text" 
                                                    value={billingPhone}
                                                    onChange={e => setBillingPhone(e.target.value)}
                                                    className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Dirección Fiscal</label>
                                            <input 
                                                type="text" 
                                                value={billingAddress}
                                                onChange={e => setBillingAddress(e.target.value)}
                                                className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                            />
                                        </div>
                                    </div>
                                )}

                                <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-xl text-sm font-bold shadow-md transition">
                                    Procesar Checkout
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            )}

            {/* Modal: Hotel Settings Form */}
            {showHotelSettingsModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <form onSubmit={saveHotelSettings} className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
                        <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg text-white">Ajustes Generales del Hotel</h3>
                            <button type="button" onClick={() => setShowHotelSettingsModal(false)} className="text-white/80 hover:text-white"><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Nombre Comercial del Hotel</label>
                                <input 
                                    type="text" 
                                    value={hotelSettings.hotel_name} 
                                    onChange={e => setHotelSettings({ ...hotelSettings, hotel_name: e.target.value })}
                                    className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Hora Check-in Std</label>
                                    <input 
                                        type="time" 
                                        value={hotelSettings.default_checkin_time} 
                                        onChange={e => setHotelSettings({ ...hotelSettings, default_checkin_time: e.target.value })}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Hora Check-out Std</label>
                                    <input 
                                        type="time" 
                                        value={hotelSettings.default_checkout_time} 
                                        onChange={e => setHotelSettings({ ...hotelSettings, default_checkout_time: e.target.value })}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Dirección del Establecimiento</label>
                                <input 
                                    type="text" 
                                    value={hotelSettings.hotel_address} 
                                    onChange={e => setHotelSettings({ ...hotelSettings, hotel_address: e.target.value })}
                                    className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Teléfono de Soporte</label>
                                <input 
                                    type="text" 
                                    value={hotelSettings.hotel_phone} 
                                    onChange={e => setHotelSettings({ ...hotelSettings, hotel_phone: e.target.value })}
                                    className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                />
                            </div>

                            <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-xl text-sm font-bold shadow-md transition">
                                Guardar Ajustes
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal: Infrastructure Config */}
            {showConfigModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
                        <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg">Configurar Estructura</h3>
                            <button onClick={() => setShowConfigModal(false)} className="text-white/80 hover:text-white"><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[75vh] overflow-y-auto">
                            {/* Create Floor */}
                            <form onSubmit={handleCreateFloor} className="border-r border-slate-200 pr-0 md:pr-6 space-y-4">
                                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                                    <i className="bi bi-layers-fill text-slate-600"></i> Agregar Piso
                                </h4>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Nombre del Piso</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ej: Piso 1" 
                                        value={newFloorName} 
                                        onChange={e => setNewFloorName(e.target.value)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-850" 
                                        required
                                    />
                                </div>
                                <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white p-2.5 rounded-xl text-xs font-bold shadow-sm transition">
                                    Guardar Piso
                                </button>
                            </form>

                            {/* Create Room */}
                            <form onSubmit={handleCreateRoom} className="space-y-4">
                                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                                    <i className="bi bi-door-closed-fill text-slate-600"></i> Agregar Habitación
                                </h4>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Piso</label>
                                    {floors.length === 0 ? (
                                        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                                            ⚠️ Crea un piso primero a la izquierda.
                                        </p>
                                    ) : (
                                        <select 
                                            value={newRoomFloorId || floors[0]?.id || ''} 
                                            onChange={e => setNewRoomFloorId(Number(e.target.value))}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs bg-white text-slate-800"
                                        >
                                            {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                        </select>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Número de Hab</label>
                                        <input 
                                            type="text" 
                                            placeholder="101" 
                                            value={newRoomNumber}
                                            onChange={e => setNewRoomNumber(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Precio por Noche</label>
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            value={newRoomPrice}
                                            onChange={e => setNewRoomPrice(parseFloat(e.target.value))}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Tipo</label>
                                    <select 
                                        value={newRoomType} 
                                        onChange={e => setNewRoomType(e.target.value as any)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs bg-white text-slate-800"
                                    >
                                        <option value="single">Simple</option>
                                        <option value="double">Doble</option>
                                        <option value="suite">Suite</option>
                                        <option value="matrimonial">Matrimonial</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Capacidad Adultos</label>
                                        <input 
                                            type="number" 
                                            value={newRoomAdults}
                                            onChange={e => setNewRoomAdults(parseInt(e.target.value))}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Capacidad Niños</label>
                                        <input 
                                            type="number" 
                                            value={newRoomChildren}
                                            onChange={e => setNewRoomChildren(parseInt(e.target.value))}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                            required
                                        />
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white p-2.5 rounded-xl text-xs font-bold shadow-md transition">
                                    Agregar Habitación
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: SRI Config Form */}
            {showSRIConfigModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <form onSubmit={saveSRIConfig} className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
                        <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg">Configuración SRI FactuExpress</h3>
                            <button type="button" onClick={() => setShowSRIConfigModal(false)} className="text-white/80 hover:text-white"><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                                <div>
                                    <span className="text-xs font-bold text-slate-700 block">Facturación Activa</span>
                                    <span className="text-[10px] text-slate-500 block">Habilitar/Deshabilitar emisión de comprobantes</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={sriIsActive} 
                                        onChange={e => setSriIsActive(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                                </label>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 mb-1">Token VSR de FactuExpress</label>
                                <input 
                                    type="password" 
                                    placeholder="Dejar vacío para no modificar..." 
                                    value={sriVsrToken}
                                    onChange={e => setSriVsrToken(e.target.value)}
                                    className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-450 mb-1">Ambiente SRI</label>
                                <select 
                                    value={sriEnvironment} 
                                    onChange={e => setSriEnvironment(e.target.value)}
                                    className="w-full border border-slate-350 rounded-xl p-2 text-xs bg-white text-slate-800"
                                >
                                    <option value="TEST">Pruebas / Test</option>
                                    <option value="PRODUCTION">Producción / Oficial</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Establecimiento</label>
                                    <input 
                                        type="text" 
                                        placeholder="001" 
                                        maxLength={3}
                                        value={sriEstCode}
                                        onChange={e => setSriEstCode(e.target.value)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Punto de Emisión</label>
                                    <input 
                                        type="text" 
                                        placeholder="001" 
                                        maxLength={3}
                                        value={sriEmPoint}
                                        onChange={e => setSriEmPoint(e.target.value)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        required
                                    />
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-xl text-sm font-bold shadow-md transition">
                                Guardar Credenciales
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {/* Modal de Escáner QR de Check-In */}
            {showQRScannerModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in text-white">
                    <div className="bg-neutral-900 border border-amber-500/30 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl shadow-black">
                        {/* Header */}
                        <div className="bg-gradient-to-b from-neutral-800 to-neutral-900 p-6 border-b border-amber-500/10 flex justify-between items-center">
                            <h3 className="text-lg font-black text-amber-500 flex items-center gap-2">
                                <i className="bi bi-qr-code-scan animate-pulse text-xl"></i> Escáner de Reservas QR
                            </h3>
                            <button 
                                onClick={() => {
                                    setShowQRScannerModal(false);
                                    setQrCodeInput('');
                                    setScannedRes(null);
                                }} 
                                className="text-neutral-400 hover:text-white"
                            >
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6">
                            {/* Scanning preview / webcam indicator */}
                            <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-amber-500/10 flex items-center justify-center">
                                {/* Visual target overlay */}
                                <div className="absolute inset-0 border-[30px] border-black/40 flex items-center justify-center pointer-events-none">
                                    <div className="w-40 h-40 border-2 border-dashed border-amber-500/60 rounded-xl relative flex items-center justify-center">
                                        <div className="absolute w-full h-0.5 bg-red-500 animate-bounce"></div>
                                    </div>
                                </div>
                                <div className="text-center text-neutral-500 space-y-2 p-4">
                                    <i className="bi bi-camera-fill text-3xl text-neutral-600 block"></i>
                                    <span className="text-xs font-semibold text-neutral-300">Cámara lista para escanear</span>
                                    <span className="block text-[10px] text-neutral-500">Apunte al QR de la reserva o ingrese el código abajo</span>
                                </div>
                            </div>

                            {/* Code input */}
                            <div>
                                <label className="block text-[10px] font-bold text-amber-500/80 uppercase tracking-widest mb-1.5">Código de Reservación (ej: AUR-XXXX)</label>
                                <input
                                    type="text"
                                    placeholder="Ingrese código o escanee..."
                                    value={qrCodeInput}
                                    onChange={e => setQrCodeInput(e.target.value)}
                                    className="w-full bg-black border border-amber-500/20 text-white rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500 text-center placeholder-neutral-600"
                                    autoFocus
                                />
                            </div>

                            {/* Scanned/Entered reservation preview */}
                            {scannedRes ? (
                                <div className="bg-black/40 border border-amber-500/20 p-5 rounded-2xl space-y-4 text-left">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-neutral-400">Reserva Encontrada</span>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${
                                            scannedRes.status === 'reserved' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                            scannedRes.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                            'bg-neutral-800 text-neutral-400 border-neutral-700'
                                        }`}>
                                            {scannedRes.status_display}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div>
                                            <span className="block text-[10px] text-neutral-500 font-bold uppercase">Huésped</span>
                                            <span className="font-extrabold text-neutral-200">{scannedRes.guest_details?.name}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] text-neutral-500 font-bold uppercase">Habitación</span>
                                            <span className="font-extrabold text-neutral-200">Hab {scannedRes.room_details?.room_number} ({scannedRes.room_details?.room_type_display})</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] text-neutral-500 font-bold uppercase">Ingreso</span>
                                            <span className="font-bold text-neutral-300">{new Date(scannedRes.check_in_date).toLocaleDateString()}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] text-neutral-500 font-bold uppercase">Salida</span>
                                            <span className="font-bold text-neutral-300">{scannedRes.planned_check_out ? new Date(scannedRes.planned_check_out).toLocaleDateString() : 'N/A'}</span>
                                        </div>
                                    </div>

                                    {/* Action button inside preview */}
                                    {scannedRes.status === 'reserved' ? (
                                        <button
                                            onClick={handleCheckInFromQR}
                                            className="w-full bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-black py-3 rounded-xl shadow-lg shadow-amber-500/10 transition-all text-xs uppercase tracking-wider mt-2"
                                        >
                                            Hacer Check-In Inmediato
                                        </button>
                                    ) : scannedRes.status === 'active' ? (
                                        <div className="text-center p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold">
                                            Huésped actualmente hospedado (Check-In activo)
                                        </div>
                                    ) : (
                                        <div className="text-center p-2.5 bg-neutral-800 text-neutral-400 rounded-xl text-xs">
                                            Esta reserva no es apta para Check-In (Estado: {scannedRes.status_display})
                                        </div>
                                    )}
                                </div>
                            ) : qrCodeInput.trim() !== '' ? (
                                <div className="text-center p-4 bg-rose-500/5 border border-rose-500/10 text-rose-400 rounded-2xl text-xs font-bold">
                                    No se encontró ninguna reserva activa con el código ingresado.
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PanelHotel;
