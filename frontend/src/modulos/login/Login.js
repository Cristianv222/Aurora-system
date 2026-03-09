import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

const Login = () => {
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState('');
    const [loading, setLoading]   = useState(false);
    const [showPass, setShowPass] = useState(false);
    const { login } = useContext(AuthContext);
    const navigate  = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const result = await login(email, password);
        setLoading(false);
        if (result.success) {
            const roleName = result.user.role_details?.name;
            navigate(roleName === 'ADMIN_FAST_FOOD' ? '/fast-food' : '/');
        } else {
            setError(result.error);
        }
    };

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />

            <style>{`
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

                .login-page {
                    min-height: 100vh;
                    display: flex;
                    font-family: 'Sora', sans-serif;
                    background: #f0f4f9;
                }

                /* Panel izquierdo decorativo */
                .login-panel-left {
                    display: none;
                    flex: 1;
                    background: linear-gradient(160deg, #1a2e4a 0%, #243b5e 55%, #2c4f7c 100%);
                    position: relative;
                    overflow: hidden;
                    align-items: center;
                    justify-content: center;
                    flex-direction: column;
                    gap: 32px;
                    padding: 48px;
                }

                /* Círculos decorativos */
                .login-panel-left::before {
                    content: '';
                    position: absolute;
                    width: 500px; height: 500px;
                    border-radius: 50%;
                    border: 80px solid rgba(255,255,255,0.04);
                    top: -120px; right: -120px;
                }
                .login-panel-left::after {
                    content: '';
                    position: absolute;
                    width: 360px; height: 360px;
                    border-radius: 50%;
                    border: 60px solid rgba(255,255,255,0.04);
                    bottom: -80px; left: -80px;
                }

                .login-deco-logo {
                    width: 200px;
                    filter: brightness(0) invert(1);
                    opacity: 0.95;
                    position: relative;
                    z-index: 1;
                }

                .login-deco-text {
                    text-align: center;
                    position: relative;
                    z-index: 1;
                }
                .login-deco-text h1 {
                    font-size: 1.6rem;
                    font-weight: 700;
                    color: #fff;
                    margin-bottom: 10px;
                    letter-spacing: -0.02em;
                }
                .login-deco-text p {
                    font-size: 0.9rem;
                    color: rgba(255,255,255,0.55);
                    line-height: 1.6;
                    max-width: 280px;
                }

                .login-deco-modules {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    position: relative;
                    z-index: 1;
                    width: 100%;
                    max-width: 280px;
                }
                .login-deco-module {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: rgba(255,255,255,0.07);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 10px;
                    padding: 10px 14px;
                    color: rgba(255,255,255,0.75);
                    font-size: 0.78rem;
                    font-weight: 500;
                }
                .login-deco-module i {
                    font-size: 1rem;
                    color: rgba(255,255,255,0.5);
                    width: 20px;
                    text-align: center;
                }

                /* Panel derecho — formulario */
                .login-panel-right {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 32px 24px;
                    background: #f0f4f9;
                }

                .login-card {
                    width: 100%;
                    max-width: 420px;
                    background: #fff;
                    border-radius: 20px;
                    padding: 44px 40px;
                    box-shadow: 0 8px 40px rgba(26,46,74,0.1);
                    border: 1.5px solid #dce8f5;
                }

                .login-card-logo {
                    display: flex;
                    justify-content: center;
                    margin-bottom: 28px;
                }
                .login-card-logo img {
                    width: 160px;
                    filter: none;
                }

                .login-card-title {
                    text-align: center;
                    margin-bottom: 32px;
                }
                .login-card-title h2 {
                    font-size: 1.4rem;
                    font-weight: 700;
                    color: #1a2e4a;
                    margin-bottom: 6px;
                    letter-spacing: -0.02em;
                }
                .login-card-title p {
                    font-size: 0.82rem;
                    color: #6b87a8;
                }

                /* Error */
                .login-error {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: #fef2f2;
                    border: 1.5px solid #fecaca;
                    border-radius: 10px;
                    padding: 10px 14px;
                    margin-bottom: 20px;
                    font-size: 0.8rem;
                    color: #dc2626;
                    font-weight: 500;
                }

                /* Campos */
                .login-field {
                    margin-bottom: 18px;
                }
                .login-field label {
                    display: block;
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: #1a2e4a;
                    margin-bottom: 6px;
                    letter-spacing: 0.01em;
                }
                .login-input-wrap {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .login-input-wrap i.field-icon {
                    position: absolute;
                    left: 13px;
                    color: #6b87a8;
                    font-size: 0.95rem;
                    pointer-events: none;
                }
                .login-input-wrap input {
                    width: 100%;
                    padding: 11px 14px 11px 38px;
                    border: 1.5px solid #dce8f5;
                    border-radius: 10px;
                    font-family: 'Sora', sans-serif;
                    font-size: 0.83rem;
                    color: #1a2e4a;
                    background: #f8fafd;
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
                }
                .login-input-wrap input:focus {
                    border-color: #2c4f7c;
                    background: #fff;
                    box-shadow: 0 0 0 3px rgba(44,79,124,0.1);
                }
                .login-input-wrap input::placeholder { color: #a0b4c8; }

                .btn-show-pass {
                    position: absolute;
                    right: 11px;
                    background: none;
                    border: none;
                    color: #6b87a8;
                    cursor: pointer;
                    font-size: 0.95rem;
                    padding: 4px;
                    display: flex;
                    align-items: center;
                    transition: color 0.15s;
                }
                .btn-show-pass:hover { color: #1a2e4a; }

                /* Botón submit */
                .login-btn {
                    width: 100%;
                    padding: 13px;
                    margin-top: 8px;
                    border: none;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #1a2e4a 0%, #2c4f7c 100%);
                    color: #fff;
                    font-family: 'Sora', sans-serif;
                    font-size: 0.88rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    box-shadow: 0 4px 16px rgba(26,46,74,0.25);
                    letter-spacing: 0.01em;
                }
                .login-btn:hover:not(:disabled) {
                    opacity: 0.92;
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(26,46,74,0.3);
                }
                .login-btn:active:not(:disabled) { transform: translateY(0); }
                .login-btn:disabled { opacity: 0.65; cursor: not-allowed; }

                /* Spinner */
                .spin {
                    width: 16px; height: 16px;
                    border: 2px solid rgba(255,255,255,0.4);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: spin .7s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* Footer */
                .login-footer {
                    text-align: center;
                    margin-top: 28px;
                    font-size: 0.68rem;
                    color: #a0b4c8;
                }

                /* RESPONSIVE */
                @media (min-width: 900px) {
                    .login-panel-left { display: flex; }
                    .login-panel-right { flex: 0 0 480px; }
                }

                @media (max-width: 480px) {
                    .login-card {
                        padding: 32px 24px;
                        border-radius: 16px;
                    }
                }
            `}</style>

            <div className="login-page">
                {/* Panel decorativo izquierdo — solo desktop */}
                <div className="login-panel-left">
                    <img src="/logo-aurora.png" alt="Aurora System" className="login-deco-logo" />
                    <div className="login-deco-text">
                        <h1>Gestión integral<br />en un solo lugar</h1>
                        <p>Administra todos tus negocios desde una plataforma unificada y segura.</p>
                    </div>
                    <div className="login-deco-modules">
                        {[
                            { icon: 'bi-egg-fried',      label: 'Kroky — Comida Rápida' },
                            { icon: 'bi-building-check', label: 'Hotel Park'             },
                            { icon: 'bi-tropical-storm', label: 'Piedras del Caribe'     },
                            { icon: 'bi-award',          label: 'Fortaleza — Restaurante'},
                        ].map(m => (
                            <div key={m.label} className="login-deco-module">
                                <i className={`bi ${m.icon}`}></i>
                                {m.label}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Panel formulario */}
                <div className="login-panel-right">
                    <div className="login-card">
                        <div className="login-card-logo">
                            <img src="/logo-aurora.png" alt="Aurora System" />
                        </div>

                        <div className="login-card-title">
                            <h2>Iniciar Sesión</h2>
                            <p>Ingresa tus credenciales para continuar</p>
                        </div>

                        {error && (
                            <div className="login-error">
                                <i className="bi bi-exclamation-circle-fill"></i>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="login-field">
                                <label htmlFor="email">Correo electrónico</label>
                                <div className="login-input-wrap">
                                    <i className="bi bi-envelope field-icon"></i>
                                    <input
                                        type="email"
                                        id="email"
                                        placeholder="usuario@ejemplo.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            <div className="login-field">
                                <label htmlFor="password">Contraseña</label>
                                <div className="login-input-wrap">
                                    <i className="bi bi-lock field-icon"></i>
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        id="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        className="btn-show-pass"
                                        onClick={() => setShowPass(s => !s)}
                                        tabIndex={-1}
                                    >
                                        <i className={`bi ${showPass ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                                    </button>
                                </div>
                            </div>

                            <button type="submit" className="login-btn" disabled={loading}>
                                {loading
                                    ? <><div className="spin"></div> Verificando...</>
                                    : <><i className="bi bi-box-arrow-in-right"></i> Ingresar</>
                                }
                            </button>
                        </form>

                        <div className="login-footer">
                            Aurora System · v1.0.0
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Login;