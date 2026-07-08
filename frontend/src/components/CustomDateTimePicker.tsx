import React, { useState, useEffect, useRef } from 'react';

interface DatePickerProps {
    value: string; // "YYYY-MM-DD"
    onChange: (val: string) => void;
    min?: string;  // "YYYY-MM-DD"
    max?: string;  // "YYYY-MM-DD"
    required?: boolean;
    placeholder?: string;
}

export const CustomDatePicker: React.FC<DatePickerProps> = ({
    value,
    onChange,
    min,
    max,
    required = false,
    placeholder = "Seleccione fecha"
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse value to Date
    const selectedDate = value ? new Date(value + 'T00:00:00') : null;

    useEffect(() => {
        if (value) {
            setCurrentMonth(new Date(value + 'T00:00:00'));
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Get days of the month
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday=0, Monday=1...
        // Adjust Sunday=0 to make Monday=0, Sunday=6
        const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
        const totalDays = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        // Pad previous month days
        for (let i = 0; i < adjustedFirstDay; i++) {
            days.push(null);
        }
        // Current month days
        for (let i = 1; i <= totalDays; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    const days = getDaysInMonth(currentMonth);
    const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const changeMonth = (offset: number) => {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
        setCurrentMonth(newDate);
    };

    const handleSelectDay = (day: Date) => {
        if (!day) return;
        
        // Format to YYYY-MM-DD
        const yyyy = day.getFullYear();
        const mm = String(day.getMonth() + 1).padStart(2, '0');
        const dd = String(day.getDate()).padStart(2, '0');
        const formatted = `${yyyy}-${mm}-${dd}`;

        // Min/Max validations
        if (min && formatted < min) return;
        if (max && formatted > max) return;

        onChange(formatted);
        setIsOpen(false);
    };

    const formatDateStringDisplay = (val: string) => {
        if (!val) return '';
        const parts = val.split('-');
        if (parts.length !== 3) return val;
        return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            <div className="relative cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <input
                    type="text"
                    readOnly
                    placeholder={placeholder}
                    required={required}
                    value={formatDateStringDisplay(value)}
                    className="w-full border border-slate-350 rounded-xl p-2.5 pr-10 text-xs text-slate-800 bg-white cursor-pointer focus:outline-none focus:border-indigo-500 font-semibold"
                />
                <i className="bi bi-calendar-event absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
            </div>

            {isOpen && (
                <div className="absolute left-0 mt-2 z-50 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 animate-in fade-in zoom-in-95 duration-100">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-3">
                        <button 
                            type="button" 
                            onClick={() => changeMonth(-1)}
                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition"
                        >
                            <i className="bi bi-chevron-left"></i>
                        </button>
                        <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </span>
                        <button 
                            type="button" 
                            onClick={() => changeMonth(1)}
                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition"
                        >
                            <i className="bi bi-chevron-right"></i>
                        </button>
                    </div>

                    {/* Day Names */}
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-450 uppercase mb-2">
                        <span>Lu</span><span>Ma</span><span>Mi</span><span>Ju</span><span>Vi</span><span>Sá</span><span>Do</span>
                    </div>

                    {/* Grid of Days */}
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day, index) => {
                            if (!day) return <div key={`empty-${index}`} />;

                            const yyyy = day.getFullYear();
                            const mm = String(day.getMonth() + 1).padStart(2, '0');
                            const dd = String(day.getDate()).padStart(2, '0');
                            const formatted = `${yyyy}-${mm}-${dd}`;

                            const isSelected = selectedDate && 
                                selectedDate.getFullYear() === yyyy &&
                                selectedDate.getMonth() === day.getMonth() &&
                                selectedDate.getDate() === day.getDate();

                            const isToday = new Date().toDateString() === day.toDateString();

                            let isDisabled = false;
                            if (min && formatted < min) isDisabled = true;
                            if (max && formatted > max) isDisabled = true;

                            return (
                                <button
                                    key={index}
                                    type="button"
                                    disabled={isDisabled}
                                    onClick={() => handleSelectDay(day)}
                                    className={`h-8 w-8 text-xs font-semibold rounded-lg flex items-center justify-center transition-all ${
                                        isSelected 
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : isToday
                                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                : 'text-slate-700 hover:bg-slate-100'
                                    } ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                                >
                                    {day.getDate()}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

interface TimePickerProps {
    value: string; // "HH:MM"
    onChange: (val: string) => void;
    required?: boolean;
}

export const CustomTimePicker: React.FC<TimePickerProps> = ({
    value,
    onChange,
    required = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initial parse of hours/minutes
    const defaultParts = value ? value.split(':') : ['12', '00'];
    const selectedHour = defaultParts[0] || '12';
    const selectedMinute = defaultParts[1] || '00';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutes = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

    const handleSelectHour = (hr: string) => {
        onChange(`${hr}:${selectedMinute}`);
    };

    const handleSelectMinute = (min: string) => {
        onChange(`${selectedHour}:${min}`);
        setIsOpen(false); // Close when minute is selected
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            <div className="relative cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <input
                    type="text"
                    readOnly
                    required={required}
                    value={value || "12:00"}
                    className="w-full border border-slate-350 rounded-xl p-2.5 pr-10 text-xs text-slate-800 bg-white cursor-pointer focus:outline-none focus:border-indigo-500 font-semibold"
                />
                <i className="bi bi-clock absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
            </div>

            {isOpen && (
                <div className="absolute left-0 mt-2 z-50 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
                    <div className="grid grid-cols-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">
                        <span>Hora</span>
                        <span>Minutos</span>
                    </div>

                    <div className="flex gap-2 h-44">
                        {/* Hours list */}
                        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
                            <div className="flex flex-col gap-1">
                                {hours.map(hr => (
                                    <button
                                        key={hr}
                                        type="button"
                                        onClick={() => handleSelectHour(hr)}
                                        className={`py-1 rounded-lg text-xs font-bold transition ${
                                            selectedHour === hr 
                                                ? 'bg-indigo-600 text-white' 
                                                : 'text-slate-700 hover:bg-slate-100'
                                        }`}
                                    >
                                        {hr}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Minutes list */}
                        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
                            <div className="flex flex-col gap-1">
                                {minutes.map(min => (
                                    <button
                                        key={min}
                                        type="button"
                                        onClick={() => handleSelectMinute(min)}
                                        className={`py-1 rounded-lg text-xs font-bold transition ${
                                            selectedMinute === min 
                                                ? 'bg-indigo-600 text-white' 
                                                : 'text-slate-700 hover:bg-slate-100'
                                        }`}
                                    >
                                        {min}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
