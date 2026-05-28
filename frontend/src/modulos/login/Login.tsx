import React, { useState, useContext, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

const Login: React.FC = () => {
    const [email, setEmail]       = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [error, setError]       = useState<string>('');
    const [loading, setLoading]   = useState<boolean>(false);
    const [showPass, setShowPass] = useState<boolean>(false);
    const context = useContext(AuthContext);
    const navigate  = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!context) return;
        
        setError('');
        setLoading(true);
        const result = await context.login(email, password);
        setLoading(false);
        
        if (result.success && result.user) {
            const roleName = (result.user as any).role_details?.name;
            navigate(roleName === 'ADMIN_FAST_FOOD' ? '/fast-food' : '/');
        } else {
            setError(result.error || 'Error al iniciar sesión');
        }
    };

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />

            <div className="min-h-screen flex bg-slate-50 font-sans">
                {/* Panel decorativo izquierdo — solo desktop */}
                <div className="hidden lg:flex flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 relative overflow-hidden items-center justify-center flex-col gap-8 p-12">
                    {/* Círculos decorativos */}
                    <div className="absolute w-[500px] h-[500px] rounded-full border-[80px] border-white/5 -top-[120px] -right-[120px]"></div>
                    <div className="absolute w-[360px] h-[360px] rounded-full border-[60px] border-white/5 -bottom-[80px] -left-[80px]"></div>

                    <img src="/logo-aurora.png" alt="Aurora System" className="w-48 brightness-0 invert opacity-95 relative z-10" />
                    
                    <div className="text-center relative z-10">
                        <h1 className="text-3xl font-bold text-white mb-2.5 tracking-tight leading-tight">
                            Gestión integral<br />en un solo lugar
                        </h1>
                        <p className="text-sm text-white/60 leading-relaxed max-w-[280px] mx-auto">
                            Administra todos tus negocios desde una plataforma unificada y segura.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2.5 relative z-10 w-full max-w-[280px]">
                        {[
                            { icon: 'bi-egg-fried',      label: 'Kroky — Comida Rápida' },
                            { icon: 'bi-building-check', label: 'Hotel Park'             },
                            { icon: 'bi-tropical-storm', label: 'Piedras del Caribe'     },
                            { icon: 'bi-award',          label: 'Fortaleza — Restaurante'},
                        ].map(m => (
                            <div key={m.label} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white/80 text-xs font-medium">
                                <i className={`bi ${m.icon} text-base text-white/50 w-5 text-center`}></i>
                                {m.label}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Panel formulario */}
                <div className="flex-1 lg:flex-initial lg:w-[480px] flex items-center justify-center p-6 sm:p-8 bg-slate-50">
                    <div className="w-full max-w-[420px] bg-white rounded-2xl p-8 sm:p-10 shadow-xl border border-slate-200/60">
                        <div className="flex justify-center mb-7">
                            <img src="/logo-aurora.png" alt="Aurora System" className="w-40" />
                        </div>

                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-slate-800 mb-1.5 tracking-tight">Iniciar Sesión</h2>
                            <p className="text-xs text-slate-500">Ingresa tus credenciales para continuar</p>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3.5 mb-5 text-xs text-red-600 font-semibold">
                                <i className="bi bi-exclamation-circle-fill text-sm"></i>
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Correo electrónico
                                </label>
                                <div className="relative flex items-center">
                                    <i className="bi bi-envelope absolute left-3.5 text-slate-400 text-base pointer-events-none"></i>
                                    <input
                                        type="email"
                                        id="email"
                                        placeholder="usuario@ejemplo.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50 focus:outline-none focus:border-slate-800 focus:bg-white focus:ring-4 focus:ring-slate-800/10 transition-all placeholder:text-slate-400"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Contraseña
                                </label>
                                <div className="relative flex items-center">
                                    <i className="bi bi-lock absolute left-3.5 text-slate-400 text-base pointer-events-none"></i>
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        id="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                        autoComplete="current-password"
                                        className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50 focus:outline-none focus:border-slate-800 focus:bg-white focus:ring-4 focus:ring-slate-800/10 transition-all placeholder:text-slate-400"
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 text-slate-400 hover:text-slate-700 p-1 flex items-center focus:outline-none transition-colors"
                                        onClick={() => setShowPass(s => !s)}
                                        tabIndex={-1}
                                    >
                                        <i className={`bi ${showPass ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                                    </button>
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 active:scale-[0.98] disabled:opacity-65 disabled:cursor-not-allowed"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                                        <span>Verificando...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-box-arrow-in-right text-base"></i>
                                        <span>Ingresar</span>
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="text-center mt-8 text-[10px] text-slate-400 font-medium">
                            Aurora System · v1.0.0
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Login;
