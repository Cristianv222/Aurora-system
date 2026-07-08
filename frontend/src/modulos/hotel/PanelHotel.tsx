import React, { useState, useEffect } from 'react';
import { showToast } from '../../utils/toast';
import '../../App.css';
import ShiftManager from './ShiftManager';
import Reportes from './Reportes';
import { CustomDatePicker, CustomTimePicker } from '../../components/CustomDateTimePicker';

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

interface RoomType {
    id: number;
    name: string;
    price_per_adult: number | string;
    price_per_child: number | string;
    adult_capacity: number;
    child_capacity: number;
}

interface Room {
    id: number;
    floor: number;
    room_number: string;
    room_type: number;
    room_type_display: string;
    price_per_adult?: number;
    price_per_child?: number;
    price_per_night?: number;
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
    nationality?: string;
    origin_city?: string;
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
    children_over_2?: number;
    children_under_2?: number;
    checked_in_by?: string | null;
    checked_out_by?: string | null;
    checkout_notes?: string | null;
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
    price_per_night?: number | null;
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

    const [activeViewTab, setActiveViewTab] = useState<'croquis' | 'reservas' | 'calendario' | 'turnos' | 'reportes'>('croquis');
    const [isShiftActive, setIsShiftActive] = useState<boolean>(true);
    const [activeShift, setActiveShift] = useState<any>(null);
    const [floors, setFloors] = useState<Floor[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [activeFloorTab, setActiveFloorTab] = useState<number | null>(null);
    const [isSavingFloor, setIsSavingFloor] = useState<boolean>(false);
    const [isSavingRoom, setIsSavingRoom] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);

    // Filter states
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Calendar filter states
    const [calendarFloorFilter, setCalendarFloorFilter] = useState<string>('all');
    const [calendarRoomTypeFilter, setCalendarRoomTypeFilter] = useState<string>('all');
    const [calendarRoomSearch, setCalendarRoomSearch] = useState<string>('');
    const [calendarGuestSearch, setCalendarGuestSearch] = useState<string>('');
    const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
    const [showDayReservationsModal, setShowDayReservationsModal] = useState<boolean>(false);
    const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);

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
    const [newRoomType, setNewRoomType] = useState<number | ''>('');
    const [newRoomFloorId, setNewRoomFloorId] = useState<number>(0);
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [configModalTab, setConfigModalTab] = useState<'structure' | 'types'>('structure');
    
    // Room Type Form states
    const [rtName, setRtName] = useState<string>('');
    const [rtPriceAdult, setRtPriceAdult] = useState<number>(15.00);
    const [rtPriceChild, setRtPriceChild] = useState<number>(8.00);
    const [rtCapAdult, setRtCapAdult] = useState<number>(2);
    const [rtCapChild, setRtCapChild] = useState<number>(2);
    const [editingRtId, setEditingRtId] = useState<number | null>(null);
    const [isSavingRt, setIsSavingRt] = useState<boolean>(false);

    // Form inputs: Check-In / Reservation Guest
    const [guestIdent, setGuestIdent] = useState<string>('');
    const [guestIdentType, setGuestIdentType] = useState<string>('05');
    const [guestName, setGuestName] = useState<string>('');
    const [guestEmail, setGuestEmail] = useState<string>('');
    const [guestPhone, setGuestPhone] = useState<string>('');
    const [guestAddress, setGuestAddress] = useState<string>('');
    const [guestNationality, setGuestNationality] = useState<string>('');
    const [guestOriginCity, setGuestOriginCity] = useState<string>('');
    const [checkInAdults, setCheckInAdults] = useState<number>(1);
    const [checkInChildren, setCheckInChildren] = useState<number>(0);
    const [childrenOver2, setChildrenOver2] = useState<number>(0);
    const [childrenUnder2, setChildrenUnder2] = useState<number>(0);
    const [checkInDateOverride, setCheckInDateOverride] = useState<string>('');
    const [checkInTimeOverride, setCheckInTimeOverride] = useState<string>('');
    const [plannedCheckOutDate, setPlannedCheckOutDate] = useState<string>('');
    const [checkInPaymentMethod, setCheckInPaymentMethod] = useState<string>('cash');
    const [pricePerNightOverride, setPricePerNightOverride] = useState<number | string>('');
    const [reservationCheckInDate, setReservationCheckInDate] = useState<string>('');
    const [depositAmount, setDepositAmount] = useState<number | string>(0);
    const [depositPaymentMethod, setDepositPaymentMethod] = useState<string>('cash');
    const [notes, setNotes] = useState<string>('');
    const [showCheckInConfirm, setShowCheckInConfirm] = useState<boolean>(false);

    // Form inputs: Check-Out
    const [paymentMethod, setPaymentMethod] = useState<string>('cash');
    const [checkoutTotalOverride, setCheckoutTotalOverride] = useState<string>('');
    const [showRefundSection, setShowRefundSection] = useState<boolean>(false);
    const [refundAmount, setRefundAmount] = useState<string>('');
    const [refundReason, setRefundReason] = useState<string>('');
    const [processSRI, setProcessSRI] = useState<boolean>(false);
    const [billingIdentType, setBillingIdentType] = useState<string>('05');
    const [billingIdent, setBillingIdent] = useState<string>('');
    const [billingName, setBillingName] = useState<string>('');
    const [billingEmail, setBillingEmail] = useState<string>('');
    const [billingPhone, setBillingPhone] = useState<string>('');
    const [billingAddress, setBillingAddress] = useState<string>('');
    const [checkOutDateOverride, setCheckOutDateOverride] = useState<string>('');
    const [checkOutTimeOverride, setCheckOutTimeOverride] = useState<string>('');
    const [checkoutNotes, setCheckoutNotes] = useState<string>('');

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
            const roomTypesRes = await fetch(`${API_BASE}/api/rooms/room-types/?_=${t}`, { headers });

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

            if (roomTypesRes.ok) {
                const roomTypesJson = await roomTypesRes.json();
                const roomTypesData: RoomType[] = Array.isArray(roomTypesJson) ? roomTypesJson : (roomTypesJson.results ?? []);
                setRoomTypes(roomTypesData);
                if (roomTypesData.length > 0) {
                    setNewRoomType(roomTypesData[0].id);
                }
            }

            if (settingsRes.ok) {
                const settingsJson = await settingsRes.json();
                setHotelSettings(settingsJson);
            }

            if (alertsRes.ok) {
                const alertsJson = await alertsRes.json();
                setTodayAlerts(alertsJson);
            }

            const shiftRes = await fetch(`${API_BASE}/api/reports/shifts/current/?_=${t}`, { headers });
            if (shiftRes.ok) {
                const shiftJson = await shiftRes.json();
                setIsShiftActive(!!(shiftJson && shiftJson.shift));
                setActiveShift(shiftJson?.shift || null);
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

    useEffect(() => {
        if (selectedRoom) {
            const typeObj = roomTypes.find(t => t.id === selectedRoom.room_type);
            const pricePerAdult = typeObj ? Number(typeObj.price_per_adult) : 15.00;
            const pricePerChild = typeObj ? Number(typeObj.price_per_child) : 8.00;
            
            let calcPrice = (checkInAdults * pricePerAdult) + (childrenOver2 * pricePerChild);
            if (typeObj && (typeObj.name.toLowerCase() === 'matrimonial' || typeObj.name.toLowerCase().includes('matri')) && checkInAdults === 1 && childrenOver2 === 0) {
                calcPrice = 25.00;
            }
            setPricePerNightOverride(calcPrice);
        } else {
            setPricePerNightOverride('');
        }
    }, [selectedRoom, checkInAdults, childrenOver2, roomTypes]);

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
                setGuestNationality(data.nationality || '');
                setGuestOriginCity(data.origin_city || '');
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
        if (isSavingFloor) return;
        setIsSavingFloor(true);
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
        } finally {
            setIsSavingFloor(false);
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
        if (isSavingRoom) return;
        setIsSavingRoom(true);
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
            };
            const payload = {
                floor: floorId,
                room_number: newRoomNumber,
                room_type: newRoomType
            };
            const res = await fetch(`${API_BASE}/api/rooms/rooms/`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                toast('Habitación agregada', 'success');
                setNewRoomNumber('');
                await loadHotelData();
            } else {
                const errData = await res.json();
                toast(`Error: ${JSON.stringify(errData)}`, 'error');
            }
        } catch (err) {
            console.error(err);
            toast('Error de red al crear habitación', 'error');
        } finally {
            setIsSavingRoom(false);
        }
    };

    // Handle Save/Edit Room Type
    const handleSaveRoomType = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rtName.trim()) {
            toast('El nombre del tipo es requerido', 'error');
            return;
        }
        if (isSavingRt) return;
        setIsSavingRt(true);
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
            };
            const payload = {
                name: rtName.trim(),
                price_per_adult: rtPriceAdult,
                price_per_child: rtPriceChild,
                adult_capacity: rtCapAdult,
                child_capacity: rtCapChild
            };
            
            const url = editingRtId 
                ? `${API_BASE}/api/rooms/room-types/${editingRtId}/`
                : `${API_BASE}/api/rooms/room-types/`;
            const method = editingRtId ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers,
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                toast(editingRtId ? 'Tipo de habitación actualizado' : 'Tipo de habitación creado', 'success');
                setRtName('');
                setRtPriceAdult(15.00);
                setRtPriceChild(8.00);
                setRtCapAdult(2);
                setRtCapChild(2);
                setEditingRtId(null);
                await loadHotelData();
            } else {
                const err = await res.json();
                toast(`Error: ${JSON.stringify(err)}`, 'error');
            }
        } catch (err) {
            console.error(err);
            toast('Error de red al guardar tipo de habitación', 'error');
        } finally {
            setIsSavingRt(false);
        }
    };

    const handleDeleteRoomType = async (id: number) => {
        if (!window.confirm('¿Está seguro de que desea eliminar este tipo de habitación? Esta acción puede fallar si está asignado a habitaciones existentes.')) return;
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
            };
            const res = await fetch(`${API_BASE}/api/rooms/room-types/${id}/`, {
                method: 'DELETE',
                headers
            });
            if (res.ok) {
                toast('Tipo de habitación eliminado', 'success');
                await loadHotelData();
            } else {
                toast('Error al eliminar. Verifique que no esté asignado a ninguna habitación.', 'error');
            }
        } catch (err) {
            console.error(err);
            toast('Error de red al eliminar tipo de habitación', 'error');
        }
    };

    // Intercept Check-In and show Confirmation Dialog
    const handleCheckIn = (e: React.FormEvent) => {
        e.preventDefault();
        setShowCheckInConfirm(true);
    };

    // Actual Check-in submit
    const submitCheckIn = async () => {
        if (!selectedRoom) return;
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
            };
            
            const checkOutDateTime = plannedCheckOutDate ? `${plannedCheckOutDate}T${hotelSettings.default_checkout_time}:00` : null;
            const checkInDateTime = `${checkInDateOverride}T${checkInTimeOverride}:00`;

            const payload = {
                room: selectedRoom.id,
                number_of_adults: checkInAdults,
                number_of_children: childrenOver2 + childrenUnder2,
                children_over_2: childrenOver2,
                children_under_2: childrenUnder2,
                check_in_date: checkInDateTime,
                planned_check_out: checkOutDateTime,
                notes: notes,
                payment_method: checkInPaymentMethod,
                price_per_night: pricePerNightOverride ? Number(pricePerNightOverride) : null,
                guest_data: {
                    identification_type: guestIdentType,
                    identification: guestIdent,
                    name: guestName,
                    email: guestEmail,
                    phone: guestPhone,
                    address: guestAddress,
                    nationality: guestNationality,
                    origin_city: guestOriginCity
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
                setShowCheckInConfirm(false);
                clearForms();
                loadHotelData();
            } else {
                const data = await res.json();
                toast(data.error || data.non_field_errors?.[0] || 'Error al registrar check-in', 'error');
            }
        } catch (err) {
            console.error("Error submitting check-in:", err);
            toast('Fallo en la conexión', 'error');
        }
    };

    // Handle Check-in of a Reserved Booking
    const handleCheckInReserved = async (resId: number) => {
        try {
            const paymentMethodInput = window.prompt("Ingrese el método de pago para el ingreso (cash: Efectivo, card: Tarjeta, transfer: Transferencia):", "cash");
            if (paymentMethodInput === null) return;
            const cleanPM = paymentMethodInput.trim().toLowerCase();
            const pMethod = ['cash', 'card', 'transfer'].includes(cleanPM) ? cleanPM : 'cash';

            const priceInput = window.prompt("Precio por noche para esta estadía (Deje en blanco para mantener la tarifa actual):", "");
            const payload: any = { reservation_id: resId, payment_method: pMethod };
            if (priceInput && !isNaN(Number(priceInput))) {
                payload.price_per_night = Number(priceInput);
            }

            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                'Content-Type': 'application/json'
            };
            const res = await fetch(`${API_BASE}/api/reservations/check-in/`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
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
            const checkOutDateTime = plannedCheckOutDate ? `${plannedCheckOutDate}T${hotelSettings.default_checkout_time}:00` : null;

            const payload = {
                room: selectedRoom.id,
                check_in_date: checkInDateTime,
                planned_check_out: checkOutDateTime,
                number_of_adults: checkInAdults,
                number_of_children: childrenOver2 + childrenUnder2,
                children_over_2: childrenOver2,
                children_under_2: childrenUnder2,
                deposit_amount: depositAmount === '' ? 0 : Number(depositAmount),
                payment_method: depositPaymentMethod,
                price_per_night: pricePerNightOverride ? Number(pricePerNightOverride) : null,
                notes: notes,
                guest_data: {
                    identification_type: guestIdentType,
                    identification: guestIdent,
                    name: guestName,
                    email: guestEmail,
                    phone: guestPhone,
                    address: guestAddress,
                    nationality: guestNationality,
                    origin_city: guestOriginCity
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
        setGuestNationality('');
        setGuestOriginCity('');
        setCheckInAdults(1);
        setCheckInChildren(0);
        setChildrenOver2(0);
        setChildrenUnder2(0);
        setCheckInDateOverride(getLocalISODate());
        setCheckInTimeOverride(new Date().toTimeString().slice(0, 5));
        setCheckOutDateOverride(getLocalISODate());
        setCheckOutTimeOverride(new Date().toTimeString().slice(0, 5));
        setCheckoutNotes('');
        setPlannedCheckOutDate('');
        setReservationCheckInDate('');
        setDepositAmount(0);
        setDepositPaymentMethod('cash');
        setCheckInPaymentMethod('cash');
        setNotes('');
        setShowCheckInConfirm(false);
        setCheckoutTotalOverride('');
        setShowRefundSection(false);
        setRefundAmount('');
        setRefundReason('');
    };

    // Action Room Click
    const handleRoomClick = async (room: Room) => {
        if (!isShiftActive) {
            toast('Debe abrir un turno de caja para poder operar las habitaciones (reservar, registrar entrada o procesar salida).', 'error');
            return;
        }
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
                        setCheckOutDateOverride(getLocalISODate());
                        setCheckOutTimeOverride(new Date().toTimeString().slice(0, 5));
                        setCheckoutNotes(activeRes.checkout_notes || '');
                        
                        setBillingIdentType(activeRes.guest_details.identification_type);
                        setBillingIdent(activeRes.guest_details.identification);
                        setBillingName(activeRes.guest_details.name);
                        setBillingEmail(activeRes.guest_details.email || '');
                        setBillingPhone(activeRes.guest_details.phone || '');
                        setBillingAddress(activeRes.guest_details.address || '');

                        const mainPayment = activeRes.payments?.find((p: any) => !p.is_deposit);
                        if (mainPayment) {
                            setPaymentMethod(mainPayment.payment_method);
                        } else {
                            setPaymentMethod('cash');
                        }

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
            const checkOutDateTime = `${checkOutDateOverride}T${checkOutTimeOverride}:00`;
            const payload = {
                payment_method: paymentMethod,
                process_sri: processSRI,
                check_out_date: checkOutDateTime,
                checkout_notes: checkoutNotes,
                total_amount: checkoutTotalOverride,
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
        if (calendarRoomTypeFilter !== 'all' && String(room.room_type) !== calendarRoomTypeFilter) {
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

    const getDynamicNightsAndTotal = () => {
        if (!activeReservation) return { nights: 1, total: 0, pricePerNight: 0 };
        
        const checkIn = new Date(activeReservation.check_in_date);
        const checkOut = checkOutDateOverride && checkOutTimeOverride
            ? new Date(`${checkOutDateOverride}T${checkOutTimeOverride}:00`)
            : new Date();
            
        const checkInDateOnly = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
        const checkOutDateOnly = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
        
        let nights = Math.round((checkOutDateOnly.getTime() - checkInDateOnly.getTime()) / (1000 * 60 * 60 * 24));
        if (nights <= 0) nights = 1;
        
        const typeObj = roomTypes.find(t => t.id === selectedRoom?.room_type);
        const pricePerAdult = typeObj ? Number(typeObj.price_per_adult) : 15.00;
        const pricePerChild = typeObj ? Number(typeObj.price_per_child) : 8.00;
        
        const resChildrenOver2 = activeReservation.children_over_2 || 0;
        const resChildrenUnder2 = activeReservation.children_under_2 || 0;
        const totalChildren = resChildrenOver2 + resChildrenUnder2;
        const adults = activeReservation.number_of_adults || 1;
        
        let pricePerNight = activeReservation.price_per_night ? Number(activeReservation.price_per_night) : 0;
        if (pricePerNight === 0) {
            if (typeObj && (typeObj.name.toLowerCase() === 'matrimonial' || typeObj.name.toLowerCase().includes('matri')) && adults === 1 && totalChildren === 0) {
                pricePerNight = 25.00;
            } else {
                pricePerNight = (adults * pricePerAdult) + (resChildrenOver2 * pricePerChild);
            }
        }
        
        const total = pricePerNight * nights;
        return { nights, total, pricePerNight };
    };

    const calculateNewBookingPrice = (
        room: Room | null,
        adultsNum: number,
        childOver2Num: number,
        inDateStr: string,
        outDateStr: string
    ) => {
        if (!room) return { nights: 1, total: 0, pricePerNight: 0 };
        
        const inDate = inDateStr ? new Date(inDateStr) : new Date();
        const outDate = outDateStr ? new Date(outDateStr) : new Date();
        
        const inDateOnly = new Date(inDate.getFullYear(), inDate.getMonth(), inDate.getDate());
        const outDateOnly = new Date(outDate.getFullYear(), outDate.getMonth(), outDate.getDate());
        
        let nights = Math.round((outDateOnly.getTime() - inDateOnly.getTime()) / (1000 * 60 * 60 * 24));
        if (nights <= 0) nights = 1;
        
        const typeObj = roomTypes.find(t => t.id === room.room_type);
        const pricePerAdult = typeObj ? Number(typeObj.price_per_adult) : 15.00;
        const pricePerChild = typeObj ? Number(typeObj.price_per_child) : 8.00;
        
        let pricePerNight = 0;
        if (typeObj && (typeObj.name.toLowerCase() === 'matrimonial' || typeObj.name.toLowerCase().includes('matri')) && adultsNum === 1 && childOver2Num === 0) {
            pricePerNight = 25.00;
        } else {
            pricePerNight = (adultsNum * pricePerAdult) + (childOver2Num * pricePerChild);
        }
        
        return {
            nights,
            pricePerNight,
            total: pricePerNight * nights
        };
    };

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
                        onClick={() => {
                            if (!isShiftActive) {
                                toast('Debe abrir un turno de caja para cambiar los ajustes del hotel.', 'error');
                                return;
                            }
                            setShowHotelSettingsModal(true);
                        }} 
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 font-semibold shadow-sm transition-all text-xs"
                    >
                        <i className="bi bi-gear-fill text-slate-500"></i> Ajustes Hotel
                    </button>
                    <button 
                        onClick={() => {
                            if (!isShiftActive) {
                                toast('Debe abrir un turno de caja para configurar credenciales SRI.', 'error');
                                return;
                            }
                            setShowSRIConfigModal(true);
                        }} 
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 font-semibold shadow-sm transition-all text-xs"
                    >
                        <i className="bi bi-shield-fill-check text-emerald-600"></i> Credenciales SRI
                    </button>
                    <button 
                        onClick={() => {
                            if (!isShiftActive) {
                                toast('Debe abrir un turno de caja para configurar tarifas.', 'error');
                                return;
                            }
                            setConfigModalTab('types');
                            setShowConfigModal(true);
                        }} 
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 font-semibold shadow-sm transition-all text-xs"
                    >
                        <i className="bi bi-currency-dollar text-indigo-600"></i> Configurar Tarifas
                    </button>
                    <button 
                        onClick={() => {
                            if (!isShiftActive) {
                                toast('Debe abrir un turno de caja para agregar pisos y habitaciones.', 'error');
                                return;
                            }
                            if (floors.length > 0) setNewRoomFloorId(floors[0].id);
                            setConfigModalTab('structure');
                            setShowConfigModal(true);
                        }} 
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-semibold shadow-sm transition-all text-xs"
                    >
                        <i className="bi bi-plus-circle-fill"></i> Pisos & Habitaciones
                    </button>
                    <button 
                        onClick={() => {
                            if (!isShiftActive) {
                                toast('Debe abrir un turno de caja para procesar ingresos por QR.', 'error');
                                return;
                            }
                            setShowQRScannerModal(true);
                        }} 
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
                    <i className="bi bi-calendar3-event-fill mr-1.5"></i> Ocupación de Habitaciones
                </button>
                 <button
                    onClick={() => setActiveViewTab('calendario')}
                    className={`px-5 py-2.5 font-bold text-xs transition-all border-b-2 rounded-t-xl ${
                        activeViewTab === 'calendario' ? 'border-slate-900 text-slate-900 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <i className="bi bi-calendar-range-fill mr-1.5"></i> Calendario de Reservas
                </button>
                <button
                    onClick={() => setActiveViewTab('turnos')}
                    className={`px-5 py-2.5 font-bold text-xs transition-all border-b-2 rounded-t-xl ${
                        activeViewTab === 'turnos' ? 'border-slate-900 text-slate-900 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <i className="bi bi-wallet2 mr-1.5"></i> Turnos de Recepcionistas
                </button>
                <button
                    onClick={() => setActiveViewTab('reportes')}
                    className={`px-5 py-2.5 font-bold text-xs transition-all border-b-2 rounded-t-xl ${
                        activeViewTab === 'reportes' ? 'border-slate-900 text-slate-900 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <i className="bi bi-bar-chart-line-fill mr-1.5"></i> Reportes y Estadísticas
                </button>
            </div>

            {/* View Render */}
            {activeViewTab === 'croquis' && (
                <div>
                    {!isShiftActive && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl text-xs font-semibold mb-6 flex justify-between items-center animate-in slide-in-from-top-3 duration-200 shadow-sm">
                            <div className="flex items-center gap-2">
                                <i className="bi bi-exclamation-triangle-fill text-amber-600 text-base"></i>
                                <span>No tiene un turno de caja abierto. Debe abrir un turno para registrar reservas con depósito o procesar check-outs.</span>
                            </div>
                            <button 
                                onClick={() => setActiveViewTab('turnos')} 
                                className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-sm border-none cursor-pointer"
                            >
                                Abrir Turno de Caja
                            </button>
                        </div>
                    )}
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
                                            <td className="p-4 font-medium text-slate-800">
                                                {res.guest_details?.name}
                                                <span className="block text-[10px] text-slate-400 font-normal">{res.guest_details?.nationality || 'N/A'} • Procedente de: {res.guest_details?.origin_city || 'N/A'}</span>
                                            </td>
                                            <td className="p-4">
                                                {new Date(res.check_in_date).toLocaleDateString()}
                                                <span className="block text-[10px] text-slate-400 font-normal">Ingreso por: {res.checked_in_by || 'Sistema'}</span>
                                            </td>
                                            <td className="p-4">
                                                {(res.planned_check_out || res.check_out_date) ? new Date(res.planned_check_out || res.check_out_date!).toLocaleDateString() : 'N/A'}
                                                {res.checked_out_by ? (
                                                    <span className="block text-[10px] text-slate-400 font-normal">Salida por: {res.checked_out_by}</span>
                                                ) : (
                                                    <span className="block text-[10px] text-slate-450 font-normal">Planeada</span>
                                                )}
                                                {res.checkout_notes && (
                                                    <span className="block text-[10px] text-amber-700 italic max-w-xs truncate" title={res.checkout_notes}>Salida: {res.checkout_notes}</span>
                                                )}
                                            </td>
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

            {activeViewTab === 'calendario' && (() => {
                // Calendar calculations
                const getDaysInMonth = (monthDate: Date) => {
                    const year = monthDate.getFullYear();
                    const month = monthDate.getMonth();
                    
                    const firstDay = new Date(year, month, 1);
                    const startDayOfWeek = firstDay.getDay(); 
                    
                    const days = [];
                    const prevMonth = new Date(year, month, 0);
                    const prevMonthDays = prevMonth.getDate();
                    
                    // Previous month pad
                    for (let i = startDayOfWeek - 1; i >= 0; i--) {
                        days.push(new Date(year, month - 1, prevMonthDays - i));
                    }
                    
                    // Current month days
                    const totalDays = new Date(year, month + 1, 0).getDate();
                    for (let i = 1; i <= totalDays; i++) {
                        days.push(new Date(year, month, i));
                    }
                    
                    // Next month pad
                    const remaining = 42 - days.length;
                    for (let i = 1; i <= remaining; i++) {
                        days.push(new Date(year, month + 1, i));
                    }
                    
                    return days;
                };

                const getReservationsForDate = (date: Date) => {
                    return reservations.filter(res => {
                        if (res.status === 'cancelled') return false;
                        
                        if (calendarFloorFilter !== 'all' && String(res.room_details?.floor) !== calendarFloorFilter) return false;
                        if (calendarRoomTypeFilter !== 'all' && String(res.room_details?.room_type) !== calendarRoomTypeFilter) return false;
                        if (calendarRoomSearch.trim() !== '' && !res.room_details?.room_number.toLowerCase().includes(calendarRoomSearch.toLowerCase())) return false;
                        if (calendarGuestSearch.trim() !== '' && !res.guest_details?.name.toLowerCase().includes(calendarGuestSearch.toLowerCase()) && !res.reservation_code.toLowerCase().includes(calendarGuestSearch.toLowerCase())) return false;

                        const checkIn = new Date(res.check_in_date);
                        
                        let checkOut;
                        if (res.planned_check_out || res.check_out_date) {
                            checkOut = new Date(res.planned_check_out || res.check_out_date);
                        } else {
                            // If checkout date is open/NA, represent it as 1 day from check-in for visualization
                            checkOut = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);
                        }
                        
                        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                        const start = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
                        const end = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
                        
                        return d >= start && d < end;
                    });
                };

                const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                const days = getDaysInMonth(calendarMonth);
                const today = new Date();

                return (
                    <div className="space-y-6">
                        {/* Filters bar */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Filtrar por Piso</label>
                                <select
                                    value={calendarFloorFilter}
                                    onChange={e => setCalendarFloorFilter(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-455 shadow-sm"
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
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-455 shadow-sm"
                                >
                                    <option value="all">Todos los Tipos</option>
                                    {roomTypes.map(t => (
                                        <option key={t.id} value={String(t.id)}>{t.name}</option>
                                    ))}
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
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-455 shadow-sm"
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
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-455 shadow-sm"
                                    />
                                    <i className="bi bi-person-fill absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Main Panels */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {/* Calendar Panel */}
                            <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                            <i className="bi bi-calendar3 text-indigo-650"></i> Calendario de Ocupación
                                        </h3>
                                        <p className="text-xs text-slate-500">Visualiza de forma mensual las reservas activas y programadas.</p>
                                    </div>
                                    <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 items-center">
                                        <button 
                                            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} 
                                            className="hover:bg-white text-slate-700 font-extrabold px-3 py-1.5 rounded-lg text-xs transition shadow-sm"
                                        >
                                            <i className="bi bi-chevron-left"></i> Anterior
                                        </button>
                                        <span className="font-extrabold px-4 text-xs text-slate-800 capitalize">
                                            {calendarMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                        </span>
                                        <button 
                                            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} 
                                            className="hover:bg-white text-slate-700 font-extrabold px-3 py-1.5 rounded-lg text-xs transition shadow-sm"
                                        >
                                            Siguiente <i className="bi bi-chevron-right"></i>
                                        </button>
                                    </div>
                                </div>

                                {/* Calendar Monthly Grid */}
                                <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-400 mb-2">
                                    {weekdays.map((w, idx) => (
                                        <div key={idx} className="py-2 border-b border-slate-100">{w}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1.5">
                                    {days.map((day, idx) => {
                                        const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                                        const isToday = day.getDate() === today.getDate() && day.getMonth() === today.getMonth() && day.getFullYear() === today.getFullYear();
                                        const dateRes = getReservationsForDate(day);
                                        const hasActive = dateRes.some(r => r.status === 'active');
                                        const hasReserved = dateRes.some(r => r.status === 'reserved');
                                        const cellBg = !isCurrentMonth 
                                            ? 'bg-slate-50 border-slate-100 opacity-25'
                                            : dateRes.length === 0
                                                ? 'bg-white border-slate-200'
                                                : hasActive && hasReserved
                                                    ? 'bg-indigo-50/70 border-indigo-250 hover:border-indigo-400 cursor-pointer shadow-sm text-indigo-950 font-bold'
                                                    : hasActive
                                                        ? 'bg-rose-50/70 border-rose-250 hover:border-rose-400 cursor-pointer shadow-sm text-rose-950 font-bold'
                                                        : 'bg-cyan-50/70 border-cyan-250 hover:border-cyan-400 cursor-pointer shadow-sm text-cyan-950 font-bold';

                                        return (
                                            <div 
                                                key={idx} 
                                                onClick={() => {
                                                    if (dateRes.length > 0) {
                                                        setSelectedCalendarDate(day);
                                                        setShowDayReservationsModal(true);
                                                    }
                                                }}
                                                className={`min-h-[90px] rounded-xl border p-2 flex flex-col justify-between transition hover:scale-[1.01] ${cellBg}`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className={`text-[11px] font-black w-6 h-6 flex items-center justify-center rounded-full ${
                                                        isToday ? 'bg-indigo-600 text-white shadow' : 'text-slate-700'
                                                    }`}>
                                                        {day.getDate()}
                                                    </span>
                                                    {dateRes.length > 0 && (
                                                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-900 text-white">
                                                            {dateRes.length}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Clean visual indicators of rooms inside the cell */}
                                                <div className="space-y-1 mt-1 overflow-y-auto max-h-16 pr-0.5 scrollbar-thin">
                                                    {dateRes.map(res => (
                                                        <div
                                                            key={res.id}
                                                            className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold truncate ${
                                                                res.status === 'active'
                                                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                                    : 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                                                            }`}
                                                        >
                                                            Hab {res.room_details?.room_number}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Timeline/Upcoming Column */}
                            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
                                    <i className="bi bi-bell-fill text-amber-500"></i> Próximas Estadías ({
                                        reservations.filter(r => r.status === 'reserved' || r.status === 'active').length
                                    })
                                </h4>
                                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                                    {(() => {
                                        const upcoming = reservations
                                            .filter(r => r.status === 'reserved' || r.status === 'active')
                                            .sort((a, b) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime());

                                        if (upcoming.length === 0) {
                                            return (
                                                <div className="text-center py-10 text-slate-400 italic text-[11px] border border-dashed border-slate-200 rounded-xl bg-slate-50">
                                                    Sin reservaciones próximas
                                                </div>
                                            );
                                        }

                                        return upcoming.slice(0, 10).map(res => (
                                            <div 
                                                key={res.id} 
                                                onClick={() => {
                                                    setActiveReservation(res);
                                                    if (res.status === 'active') {
                                                        setShowCheckOutModal(true);
                                                    } else {
                                                        setShowReserveModal(true);
                                                    }
                                                }}
                                                className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm hover:border-slate-350 cursor-pointer transition space-y-2 text-xs"
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <strong className="text-slate-900 text-xs block">Hab {res.room_details?.room_number}</strong>
                                                        <span className="text-[10px] text-slate-500">{res.room_details?.room_type_display}</span>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                                                        res.status === 'active' 
                                                            ? 'bg-rose-50 border-rose-250 text-rose-800' 
                                                            : 'bg-cyan-50 border-cyan-250 text-cyan-800'
                                                    }`}>
                                                        {res.status_display}
                                                    </span>
                                                </div>
                                                
                                                <div className="text-[11px] text-slate-700">
                                                    <div className="flex items-center gap-1 font-bold text-slate-800">
                                                        <i className="bi bi-person"></i> {res.guest_details?.name}
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-1 text-slate-500">
                                                        <i className="bi bi-calendar3"></i> 
                                                        {new Date(res.check_in_date).toLocaleDateString()} — {
                                                            res.planned_check_out || res.check_out_date
                                                                ? new Date(res.planned_check_out || res.check_out_date).toLocaleDateString()
                                                                : 'N/A (Salida abierta)'
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {activeViewTab === 'turnos' && (
                <ShiftManager onShiftActive={setIsShiftActive} />
            )}

            {activeViewTab === 'reportes' && (
                <Reportes />
            )}

            {/* Modal Check-In Form (styled with glass backdrop and system color inputs) */}
            {showCheckInModal && selectedRoom && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <form onSubmit={handleCheckIn} className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
                        <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg">Ingreso Inmediato (Check-In) — Hab {selectedRoom.room_number} ({roomTypes.find(t => t.id === selectedRoom.room_type)?.name || ''})</h3>
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
                                <div className="mb-3">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Dirección</label>
                                    <input 
                                        type="text" 
                                        placeholder="Dirección fiscal..." 
                                        value={guestAddress}
                                        onChange={e => setGuestAddress(e.target.value)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Nacionalidad</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ecuatoriano, Colombiano, etc..." 
                                            value={guestNationality}
                                            onChange={e => setGuestNationality(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">De qué parte viaja (Procedencia)</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ciudad o país..." 
                                            value={guestOriginCity}
                                            onChange={e => setGuestOriginCity(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        />
                                    </div>
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
                                
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Fecha de Check-In</label>
                                        <CustomDatePicker 
                                            value={checkInDateOverride}
                                            onChange={setCheckInDateOverride}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Hora de Check-In</label>
                                        <CustomTimePicker 
                                            value={checkInTimeOverride}
                                            onChange={setCheckInTimeOverride}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Fecha Programada de Salida (Opcional)</label>
                                        <CustomDatePicker 
                                            value={plannedCheckOutDate}
                                            min={getLocalISODate()}
                                            max={nextReservation ? nextReservation.check_in_date.split('T')[0] : undefined}
                                            onChange={setPlannedCheckOutDate}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Precio por Noche ($)</label>
                                        <input 
                                            type="number"
                                            step="0.01" 
                                            value={pricePerNightOverride}
                                            onChange={e => setPricePerNightOverride(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800 font-bold" 
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3 mb-4">
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
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Niños mayores a 2 años ($8) (Máx {selectedRoom.child_capacity - childrenUnder2})</label>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            max={selectedRoom.child_capacity - childrenUnder2}
                                            value={childrenOver2}
                                            onChange={e => {
                                                const val = parseInt(e.target.value) || 0;
                                                const maxAllowed = selectedRoom.child_capacity - childrenUnder2;
                                                const clampedVal = Math.min(val, maxAllowed >= 0 ? maxAllowed : 0);
                                                setChildrenOver2(clampedVal);
                                                setCheckInChildren(clampedVal + childrenUnder2);
                                            }}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Niños ≤ 2a ($0) (Máx {selectedRoom.child_capacity - childrenOver2})</label>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            max={selectedRoom.child_capacity - childrenOver2}
                                            value={childrenUnder2}
                                            onChange={e => {
                                                const val = parseInt(e.target.value) || 0;
                                                const maxAllowed = selectedRoom.child_capacity - childrenOver2;
                                                const clampedVal = Math.min(val, maxAllowed >= 0 ? maxAllowed : 0);
                                                setChildrenUnder2(clampedVal);
                                                setCheckInChildren(childrenOver2 + clampedVal);
                                            }}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Observaciones de Ingreso</label>
                                    <textarea 
                                        rows={2}
                                        placeholder="Comentarios adicionales al check-in..."
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                    />
                                </div>

                                <div className="mb-3">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Método de Pago</label>
                                    <select 
                                        value={checkInPaymentMethod} 
                                        onChange={e => setCheckInPaymentMethod(e.target.value)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs bg-white text-slate-800"
                                    >
                                        <option value="cash">Efectivo</option>
                                        <option value="card">Tarjeta de Crédito/Débito</option>
                                        <option value="transfer">Transferencia Bancaria</option>
                                    </select>
                                </div>

                                {selectedRoom && plannedCheckOutDate && (
                                    (() => {
                                        const { nights } = calculateNewBookingPrice(
                                            selectedRoom, 
                                            checkInAdults, 
                                            childrenOver2, 
                                            checkInDateOverride || getLocalISODate(), 
                                            plannedCheckOutDate
                                        );
                                        const pricePerNightVal = Number(pricePerNightOverride) || 0;
                                        const totalVal = pricePerNightVal * nights;
                                        return (
                                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900 mt-3 mb-2 flex justify-between items-center">
                                                <div>
                                                    <span className="block font-bold">Resumen de Tarifa:</span>
                                                    <span className="text-[10px] text-indigo-750 block">Calculado para {nights} noche(s)</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block font-mono text-[10px] text-indigo-750">${pricePerNightVal.toFixed(2)} / noche</span>
                                                    <strong className="text-sm font-mono text-indigo-900">${totalVal.toFixed(2)}</strong>
                                                </div>
                                            </div>
                                        );
                                    })()
                                )}
                            </div>

                            <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-xl text-sm font-bold shadow-md transition">
                                Registrar Ingreso
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal: Check-In Confirmation Dialog */}
            {showCheckInConfirm && selectedRoom && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden text-slate-800 animate-in zoom-in-95 duration-150">
                        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-bold text-xs uppercase tracking-wider"><i className="bi bi-shield-fill-check text-emerald-450 mr-1.5"></i> Confirmar Ingreso (Check-In)</h3>
                            <button type="button" onClick={() => setShowCheckInConfirm(false)} className="text-white/80 hover:text-white"><i className="bi bi-x-lg"></i></button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <p className="text-xs text-slate-500 font-medium">
                                Por favor, verifique que los detalles de facturación y estadía sean correctos antes de registrar el ingreso:
                            </p>

                            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-3 text-xs">
                                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                                    <span className="text-slate-450 font-medium">Habitación:</span>
                                    <strong className="text-slate-800 font-bold">Hab {selectedRoom.room_number} ({roomTypes.find(t => t.id === selectedRoom.room_type)?.name || ''})</strong>
                                </div>
                                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                                    <span className="text-slate-450 font-medium">Huésped:</span>
                                    <strong className="text-slate-800 font-bold">{guestName || 'Sin Nombre'}</strong>
                                </div>
                                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                                    <span className="text-slate-450 font-medium">Identificación:</span>
                                    <strong className="text-slate-800 font-mono font-bold">{guestIdent}</strong>
                                </div>
                                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                                    <span className="text-slate-450 font-medium">Precio por Noche:</span>
                                    <strong className="text-slate-900 font-mono font-extrabold">${Number(pricePerNightOverride).toFixed(2)}</strong>
                                </div>
                                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                                    <span className="text-slate-450 font-medium">Noches:</span>
                                    <strong className="text-slate-800 font-bold">
                                        {(() => {
                                            const { nights } = calculateNewBookingPrice(
                                                selectedRoom, 
                                                checkInAdults, 
                                                childrenOver2, 
                                                checkInDateOverride || getLocalISODate(), 
                                                plannedCheckOutDate
                                            );
                                            return `${nights} noche(s)`;
                                        })()}
                                    </strong>
                                </div>
                                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                                    <span className="text-slate-450 font-medium">Método de Pago:</span>
                                    <strong className="text-slate-800 font-bold">
                                        {checkInPaymentMethod === 'cash' ? 'Efectivo' : checkInPaymentMethod === 'card' ? 'Tarjeta' : 'Transferencia Bancaria'}
                                    </strong>
                                </div>
                                <div className="flex justify-between pt-1">
                                    <span className="text-slate-500 font-semibold">Total a Cobrar:</span>
                                    <strong className="text-indigo-750 font-mono font-black text-sm">
                                        {(() => {
                                            const { nights } = calculateNewBookingPrice(
                                                selectedRoom, 
                                                checkInAdults, 
                                                childrenOver2, 
                                                checkInDateOverride || getLocalISODate(), 
                                                plannedCheckOutDate
                                            );
                                            const pricePerNightVal = Number(pricePerNightOverride) || 0;
                                            return `$${(pricePerNightVal * nights).toFixed(2)}`;
                                        })()}
                                    </strong>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={submitCheckIn}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition"
                                >
                                    Confirmar e Ingresar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCheckInConfirm(false)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs transition"
                                >
                                    Modificar Datos
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Reserve (Booking Future) Form */}
            {showReserveModal && selectedRoom && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <form onSubmit={handleReserve} className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
                        <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg">Nueva Reserva Anticipada — Hab {selectedRoom.room_number} ({roomTypes.find(t => t.id === selectedRoom.room_type)?.name || ''})</h3>
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
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Nacionalidad</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ecuatoriano, Colombiano, etc..." 
                                            value={guestNationality}
                                            onChange={e => setGuestNationality(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Procedencia</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ciudad o país..." 
                                            value={guestOriginCity}
                                            onChange={e => setGuestOriginCity(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Booking dates */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1.5"><i className="bi bi-clock-fill text-slate-500 mr-1"></i> Período de Reserva</h4>
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Fecha Ingreso</label>
                                        <CustomDatePicker 
                                            value={reservationCheckInDate}
                                            min={getLocalISODate()}
                                            onChange={setReservationCheckInDate}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Fecha Salida (Opcional)</label>
                                        <CustomDatePicker 
                                            value={plannedCheckOutDate}
                                            min={reservationCheckInDate || getLocalISODate()}
                                            onChange={setPlannedCheckOutDate}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Precio por Noche ($)</label>
                                        <input 
                                            type="number"
                                            step="0.01" 
                                            value={pricePerNightOverride}
                                            onChange={e => setPricePerNightOverride(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800 font-bold" 
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3 mb-4">
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
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Niños mayores a 2 años ($8) (Máx {selectedRoom.child_capacity - childrenUnder2})</label>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            max={selectedRoom.child_capacity - childrenUnder2}
                                            value={childrenOver2}
                                            onChange={e => {
                                                const val = parseInt(e.target.value) || 0;
                                                const maxAllowed = selectedRoom.child_capacity - childrenUnder2;
                                                const clampedVal = Math.min(val, maxAllowed >= 0 ? maxAllowed : 0);
                                                setChildrenOver2(clampedVal);
                                                setCheckInChildren(clampedVal + childrenUnder2);
                                            }}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Niños ≤ 2a ($0) (Máx {selectedRoom.child_capacity - childrenOver2})</label>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            max={selectedRoom.child_capacity - childrenOver2}
                                            value={childrenUnder2}
                                            onChange={e => {
                                                const val = parseInt(e.target.value) || 0;
                                                const maxAllowed = selectedRoom.child_capacity - childrenOver2;
                                                const clampedVal = Math.min(val, maxAllowed >= 0 ? maxAllowed : 0);
                                                setChildrenUnder2(clampedVal);
                                                setCheckInChildren(childrenOver2 + clampedVal);
                                            }}
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
                                            onChange={e => {
                                                const val = e.target.value;
                                                setDepositAmount(val === '' ? '' : parseFloat(val));
                                            }}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Método de Pago</label>
                                        <select 
                                            value={depositPaymentMethod}
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

                                {selectedRoom && reservationCheckInDate && plannedCheckOutDate && (
                                    (() => {
                                        const { nights } = calculateNewBookingPrice(
                                            selectedRoom, 
                                            checkInAdults, 
                                            childrenOver2, 
                                            reservationCheckInDate, 
                                            plannedCheckOutDate
                                        );
                                        const pricePerNightVal = Number(pricePerNightOverride) || 0;
                                        const totalVal = pricePerNightVal * nights;
                                        return (
                                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900 mt-3 mb-2 flex justify-between items-center">
                                                <div>
                                                    <span className="block font-bold">Resumen de Tarifa:</span>
                                                    <span className="text-[10px] text-indigo-750 block">Calculado para {nights} noche(s)</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block font-mono text-[10px] text-indigo-750">${pricePerNightVal.toFixed(2)} / noche</span>
                                                    <strong className="text-sm font-mono text-indigo-900">${totalVal.toFixed(2)}</strong>
                                                </div>
                                            </div>
                                        );
                                    })()
                                )}
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
                                {showRefundSection ? (
                                    /* Dedicated Refund Sub-View */
                                    <div className="space-y-4">
                                        <div className="bg-emerald-50 border border-emerald-250 rounded-2xl p-4 space-y-3 text-xs text-emerald-950 animate-in fade-in duration-200">
                                            <h4 className="font-bold text-emerald-900 flex items-center gap-1.5 text-sm"><i className="bi bi-cash-coin text-emerald-600 text-base"></i> Registrar Devolución de Dinero</h4>
                                            
                                            <div className="grid grid-cols-2 gap-3 pt-1 text-slate-700">
                                                <div>
                                                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Check-In Registrado Por</span>
                                                    <strong className="text-slate-800 font-bold text-xs">{activeReservation.checked_in_by || 'Sistema'}</strong>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Devolución Procesada Por</span>
                                                    <strong className="text-slate-800 font-bold text-xs">{activeShift ? activeShift.user_name : 'Recepcionista en Turno'}</strong>
                                                </div>
                                                <div className="col-span-2 border-t border-emerald-200/50 pt-2 mt-1 flex justify-between items-center">
                                                    <span className="text-slate-500 font-medium">Total pagado por el huésped al ingresar:</span>
                                                    <strong className="text-emerald-800 font-mono text-sm font-extrabold">${(() => {
                                                        const payments = activeReservation.payments || [];
                                                        return payments.reduce((acc: number, p: any) => acc + Number(p.amount), 0).toFixed(2);
                                                    })()}</strong>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Monto a Devolver ($)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    max={(() => {
                                                        const payments = activeReservation.payments || [];
                                                        return payments.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
                                                    })()}
                                                    value={refundAmount}
                                                    onChange={e => setRefundAmount(e.target.value)}
                                                    className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800 font-bold"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Método de Devolución</label>
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
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Motivo de la Devolución (Obligatorio)</label>
                                            <textarea
                                                rows={2}
                                                placeholder="Ej. Huésped cancela estadía por motivos personales..."
                                                value={refundReason}
                                                onChange={e => setRefundReason(e.target.value)}
                                                className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800"
                                                required
                                            />
                                        </div>

                                        <div className="flex gap-2 pt-2 border-t border-slate-100">
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (!refundAmount || Number(refundAmount) <= 0) {
                                                        toast('Por favor ingrese un monto válido a devolver', 'error');
                                                        return;
                                                    }
                                                    if (!refundReason.trim()) {
                                                        toast('Por favor ingrese el motivo del reembolso', 'error');
                                                        return;
                                                    }
                                                    const payments = activeReservation.payments || [];
                                                    const alreadyPaid = payments.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
                                                    const finalTotal = alreadyPaid - Number(refundAmount);
                                                    
                                                    // Add details to notes
                                                    const fullNotes = `[DEVOLUCIÓN de $${Number(refundAmount).toFixed(2)} por ${activeShift ? activeShift.user_name : 'Recepcionista'}] Motivo: ${refundReason}`;
                                                    
                                                    setWsProcessing(true);
                                                    setWsStatusCode('');
                                                    setWsStatusMessage('Procesando devolución en caja y liberando habitación...');

                                                    const headers = {
                                                        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                                                        'Content-Type': 'application/json'
                                                    };
                                                    const checkOutDateTime = `${checkOutDateOverride}T${checkOutTimeOverride}:00`;

                                                    const res = await fetch(`${API_BASE}/api/reservations/${activeReservation.id}/check-out/`, {
                                                        method: 'POST',
                                                        headers,
                                                        body: JSON.stringify({
                                                            payment_method: paymentMethod,
                                                            process_sri: false,
                                                            check_out_date: checkOutDateTime,
                                                            checkout_notes: fullNotes,
                                                            total_amount: finalTotal.toString()
                                                        })
                                                    });

                                                    if (res.ok) {
                                                        toast('Devolución registrada con éxito', 'success');
                                                        setTimeout(() => {
                                                            setWsProcessing(false);
                                                            setShowCheckOutModal(false);
                                                            loadHotelData();
                                                        }, 1500);
                                                    } else {
                                                        toast('Error al procesar devolución', 'error');
                                                        setWsProcessing(false);
                                                    }
                                                }}
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition"
                                            >
                                                Confirmar y Devolver Dinero
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowRefundSection(false);
                                                    setCheckoutTotalOverride('');
                                                }}
                                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs transition"
                                            >
                                                Regresar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Standard Check-Out View */
                                    <>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-4 text-xs">
                                            <div><span className="text-slate-500 block">Huésped Principal:</span> <strong className="text-slate-800 text-sm block mt-0.5">{activeReservation.guest_details.name}</strong></div>
                                            <div><span className="text-slate-500 block">Check-in inicial:</span> <strong className="text-slate-800 text-sm block mt-0.5">{new Date(activeReservation.check_in_date).toLocaleString()} ({activeReservation.checked_in_by || 'Sistema'})</strong></div>
                                            <div><span className="text-slate-500 block">Tarifa por Noche:</span> <strong className="text-slate-800 text-sm block mt-0.5">${getDynamicNightsAndTotal().pricePerNight.toFixed(2)}</strong></div>
                                            <div><span className="text-slate-500 block">Noches de estadía:</span> <strong className="text-slate-800 text-sm block mt-0.5">{getDynamicNightsAndTotal().nights} noche(s)</strong></div>
                                        </div>

                                        {(() => {
                                            const { total } = getDynamicNightsAndTotal();
                                            const payments = activeReservation.payments || [];
                                            const alreadyPaid = payments.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
                                            const difference = total - alreadyPaid;
                                            
                                            return (
                                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Monto total real:</span>
                                                        <span className="font-bold text-slate-800 font-mono">${total.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Monto ya pagado (Ingreso + Depósitos):</span>
                                                        <span className="font-bold text-slate-850 font-mono">${alreadyPaid.toFixed(2)}</span>
                                                    </div>
                                                    
                                                    {difference > 0 ? (
                                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 mt-2 space-y-2">
                                                            <div className="flex justify-between items-center font-bold">
                                                                <span>Saldo pendiente a cobrar (Extensión):</span>
                                                                <span className="font-mono text-sm">${difference.toFixed(2)}</span>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-amber-800 mb-1">Método de pago del saldo</label>
                                                                <select
                                                                    value={paymentMethod}
                                                                    onChange={e => setPaymentMethod(e.target.value)}
                                                                    className="w-full border border-amber-300 rounded-lg p-2 text-xs bg-white text-slate-850 font-medium focus:ring-1 focus:ring-amber-500"
                                                                >
                                                                    <option value="cash">Efectivo</option>
                                                                    <option value="card">Tarjeta de Crédito/Débito</option>
                                                                    <option value="transfer">Transferencia Bancaria</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                    ) : difference < 0 ? (
                                                        <div className="bg-emerald-50 border border-emerald-250 rounded-xl p-3 text-emerald-950 text-center font-bold mt-2 flex flex-col items-center gap-1.5 animate-in fade-in duration-200">
                                                            <span className="text-emerald-800 text-[11px]"><i className="bi bi-info-circle-fill mr-1"></i> Reembolso de ${Math.abs(difference).toFixed(2)} disponible.</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setShowRefundSection(true);
                                                                    setRefundAmount(Math.abs(difference).toString());
                                                                }}
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] transition shadow"
                                                            >
                                                                Procesar Reembolso
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-slate-700 text-center font-bold mt-2">
                                                            Estadía al día (Sin saldos pendientes)
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Fecha de Check-Out</label>
                                                <CustomDatePicker 
                                                    value={checkOutDateOverride}
                                                    onChange={setCheckOutDateOverride}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Hora de Check-Out</label>
                                                <CustomTimePicker 
                                                    value={checkOutTimeOverride}
                                                    onChange={setCheckOutTimeOverride}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Observaciones de Salida (p.ej. toalla, etc.)</label>
                                            <textarea 
                                                rows={2}
                                                placeholder="Se entregó toallas, control de TV, etc..."
                                                value={checkoutNotes}
                                                onChange={e => setCheckoutNotes(e.target.value)}
                                                className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                            />
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
                                                                className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800 font-bold font-mono"
                                                            />
                                                            <button 
                                                                type="button" 
                                                                onClick={searchBillingGuest}
                                                                className="bg-slate-900 hover:bg-slate-800 text-white px-3 rounded-xl text-xs font-bold"
                                                            >
                                                                Buscar
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Razón Social / Nombre Completo</label>
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

                                        <div className="flex gap-2">
                                            <button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-xl text-sm font-bold shadow-md transition">
                                                Procesar Checkout
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    setShowRefundSection(true);
                                                    const payments = activeReservation.payments || [];
                                                    const alreadyPaid = payments.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
                                                    setRefundAmount(alreadyPaid.toString());
                                                }}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-md transition flex items-center gap-1"
                                            >
                                                <i className="bi bi-cash-coin"></i> Devolución
                                            </button>
                                        </div>
                                    </>
                                )}
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
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-slate-800">
                        <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg text-white">Configurar Estructura del Hotel</h3>
                            <button onClick={() => setShowConfigModal(false)} className="text-white/80 hover:text-white"><i className="bi bi-x-lg"></i></button>
                        </div>
                        
                        {/* Tab Switcher */}
                        <div className="flex border-b border-slate-200 bg-slate-50">
                            <button 
                                onClick={() => setConfigModalTab('structure')} 
                                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                                    configModalTab === 'structure' ? 'border-slate-900 text-slate-900 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Pisos y Habitaciones
                            </button>
                            <button 
                                onClick={() => setConfigModalTab('types')} 
                                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                                    configModalTab === 'types' ? 'border-slate-900 text-slate-900 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Configurar Tipos de Habitación
                            </button>
                        </div>

                        {configModalTab === 'structure' ? (
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
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
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Número de Habitación</label>
                                            <input 
                                                type="text" 
                                                placeholder="101" 
                                                value={newRoomNumber}
                                                onChange={e => setNewRoomNumber(e.target.value)}
                                                className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-800" 
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Tipo de Habitación</label>
                                        {roomTypes.length === 0 ? (
                                            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-250 p-2 rounded-lg">
                                                No hay tipos definidos. Créelos en la pestaña superior.
                                            </p>
                                        ) : (
                                            <select 
                                                value={newRoomType} 
                                                onChange={e => setNewRoomType(Number(e.target.value))}
                                                className="w-full border border-slate-350 rounded-xl p-2 text-xs bg-white text-slate-800"
                                                required
                                            >
                                                <option value="">-- Seleccionar Tipo --</option>
                                                {roomTypes.map(t => (
                                                    <option key={t.id} value={t.id}>
                                                        {t.name} (Ad: ${Number(t.price_per_adult).toFixed(2)} / Ni: ${Number(t.price_per_child).toFixed(2)})
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <button 
                                        type="submit" 
                                        disabled={roomTypes.length === 0}
                                        className="w-full bg-slate-900 hover:bg-slate-800 text-white p-2.5 rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
                                    >
                                        Agregar Habitación
                                    </button>
                                </form>
                            </div>
                        ) : (
                            /* Config Modal Tab: Room Types list and creation form */
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
                                {/* Left column: Room Type form */}
                                <form onSubmit={handleSaveRoomType} className="border-r border-slate-200 pr-0 md:pr-6 space-y-3.5">
                                    <h4 className="font-bold text-slate-900 flex items-center gap-2 text-xs uppercase tracking-wider">
                                        {editingRtId ? 'Editar Tipo' : 'Crear Tipo de Habitación'}
                                    </h4>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Nombre del Tipo</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ej: Suite Deluxe" 
                                            value={rtName} 
                                            onChange={e => setRtName(e.target.value)}
                                            className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-850" 
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Precio por Adulto ($)</label>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                min="0"
                                                value={rtPriceAdult} 
                                                onChange={e => setRtPriceAdult(parseFloat(e.target.value) || 0)}
                                                className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-850" 
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Precio por Niño ($)</label>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                min="0"
                                                value={rtPriceChild} 
                                                onChange={e => setRtPriceChild(parseFloat(e.target.value) || 0)}
                                                className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-850" 
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Capacidad Adultos</label>
                                            <input 
                                                type="number" 
                                                min="1"
                                                value={rtCapAdult} 
                                                onChange={e => setRtCapAdult(parseInt(e.target.value) || 1)}
                                                className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-855" 
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Capacidad Niños</label>
                                            <input 
                                                type="number" 
                                                min="0"
                                                value={rtCapChild} 
                                                onChange={e => setRtCapChild(parseInt(e.target.value) || 0)}
                                                className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-855" 
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-1.5">
                                        <button type="submit" disabled={isSavingRt} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white p-2.5 rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50">
                                            {isSavingRt ? 'Guardando...' : editingRtId ? 'Actualizar' : 'Guardar Tipo'}
                                        </button>
                                        {editingRtId && (
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    setEditingRtId(null);
                                                    setRtName('');
                                                    setRtPriceAdult(15.00);
                                                    setRtPriceChild(8.00);
                                                    setRtCapAdult(2);
                                                    setRtCapChild(2);
                                                }}
                                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-xl text-xs font-bold transition"
                                            >
                                                Cancelar
                                            </button>
                                        )}
                                    </div>
                                </form>

                                {/* Right column: List of Room Types */}
                                <div className="space-y-3">
                                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">Tipos Guardados</h4>
                                    {roomTypes.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic">No hay tipos de habitación configurados.</p>
                                    ) : (
                                        <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                                            {roomTypes.map(t => (
                                                <div key={t.id} className="p-3 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100/50 transition flex justify-between items-center text-xs">
                                                    <div>
                                                        <strong className="text-slate-800 font-bold block">{t.name}</strong>
                                                        <span className="text-[10px] text-slate-500 block mt-0.5">
                                                            Capacidad: {t.adult_capacity} Ad / {t.child_capacity} Ni
                                                        </span>
                                                        <span className="text-[10px] text-indigo-600 font-semibold block mt-0.5">
                                                            Tarifa: ${Number(t.price_per_adult).toFixed(2)} Ad / ${Number(t.price_per_child).toFixed(2)} Ni
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-1.5">
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingRtId(t.id);
                                                                setRtName(t.name);
                                                                setRtPriceAdult(Number(t.price_per_adult));
                                                                setRtPriceChild(Number(t.price_per_child));
                                                                setRtCapAdult(t.adult_capacity);
                                                                setRtCapChild(t.child_capacity);
                                                            }}
                                                            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition"
                                                        >
                                                            Editar
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleDeleteRoomType(t.id)}
                                                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition"
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
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
            {/* Modal de Detalle de Reservas por Día */}
            {showDayReservationsModal && selectedCalendarDate && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
                        {/* Header */}
                        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-extrabold text-sm uppercase tracking-wider">Reservaciones Ocupadas</h3>
                                <span className="text-[10px] text-slate-350 capitalize font-bold">
                                    {selectedCalendarDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                            <button 
                                onClick={() => setShowDayReservationsModal(false)} 
                                className="text-white/80 hover:text-white"
                            >
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3.5">
                            {(() => {
                                // Re-evaluate inside render scope
                                const getReservationsForDate = (date: Date) => {
                                    return reservations.filter(res => {
                                        if (res.status === 'cancelled') return false;
                                        
                                        if (calendarFloorFilter !== 'all' && String(res.room_details?.floor) !== calendarFloorFilter) return false;
                                        if (calendarRoomTypeFilter !== 'all' && String(res.room_details?.room_type) !== calendarRoomTypeFilter) return false;
                                        if (calendarRoomSearch.trim() !== '' && !res.room_details?.room_number.toLowerCase().includes(calendarRoomSearch.toLowerCase())) return false;
                                        if (calendarGuestSearch.trim() !== '' && !res.guest_details?.name.toLowerCase().includes(calendarGuestSearch.toLowerCase()) && !res.reservation_code.toLowerCase().includes(calendarGuestSearch.toLowerCase())) return false;

                                        const checkIn = new Date(res.check_in_date);
                                        
                                        let checkOut;
                                        if (res.planned_check_out || res.check_out_date) {
                                            checkOut = new Date(res.planned_check_out || res.check_out_date);
                                        } else {
                                            checkOut = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);
                                        }
                                        
                                        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                                        const start = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
                                        const end = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
                                        
                                        return d >= start && d < end;
                                    });
                                };

                                const dayReservations = getReservationsForDate(selectedCalendarDate);
                                if (dayReservations.length === 0) {
                                    return (
                                        <div className="text-center py-8 text-slate-400 italic text-xs">
                                            No hay reservas registradas para este día.
                                        </div>
                                    );
                                }

                                return dayReservations.map(res => (
                                    <div 
                                        key={res.id}
                                        onClick={() => {
                                            setShowDayReservationsModal(false);
                                            setActiveReservation(res);
                                            if (res.status === 'active') {
                                                setShowCheckOutModal(true);
                                            } else {
                                                setShowReserveModal(true);
                                            }
                                        }}
                                        className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-slate-350 cursor-pointer transition-all hover:scale-[1.01] flex justify-between items-center text-xs"
                                    >
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-extrabold text-xs text-slate-900 bg-slate-200/60 px-2 py-0.5 rounded-lg">Hab {res.room_details?.room_number}</span>
                                                <span className="text-[10px] text-slate-500 font-semibold">{res.room_details?.room_type_display}</span>
                                            </div>
                                            <div className="text-[11px] text-slate-700">
                                                <strong className="text-slate-800 font-black"><i className="bi bi-person mr-0.5"></i> {res.guest_details?.name}</strong>
                                                <span className="block text-slate-500 mt-0.5 font-mono text-[9px]"><i className="bi bi-key mr-0.5"></i> Código: {res.reservation_code}</span>
                                            </div>
                                        </div>

                                        <div className="text-right space-y-1.5">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider block text-center ${
                                                res.status === 'active' 
                                                    ? 'bg-rose-50 border-rose-250 text-rose-800' 
                                                    : 'bg-cyan-50 border-cyan-250 text-cyan-800'
                                            }`}>
                                                {res.status_display}
                                            </span>
                                            <span className="text-[9px] text-slate-400 block font-semibold">Ver detalles <i className="bi bi-arrow-right"></i></span>
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PanelHotel;
