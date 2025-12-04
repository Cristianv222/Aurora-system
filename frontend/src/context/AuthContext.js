import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadUser = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const response = await api.get('/api/authentication/me/');
                    setUser(response.data);
                } catch (error) {
                    console.error("Error cargando usuario", error);
                    localStorage.removeItem('token');
                    localStorage.removeItem('refresh_token');
                }
            }
            setLoading(false);
        };

        loadUser();
    }, []);

    const login = async (email, password) => {
        try {
            const response = await api.post('/api/authentication/login/', {
                email,
                password,
            });

            const { access, refresh } = response.data;

            localStorage.setItem('token', access);
            localStorage.setItem('refresh_token', refresh);

            // Obtener datos del usuario inmediatamente después del login
            const userResponse = await api.get('/api/authentication/me/');
            setUser(userResponse.data);

            return { success: true, user: userResponse.data };
        } catch (error) {
            console.error("Login error", error);
            return {
                success: false,
                error: error.response?.data?.detail || 'Error al iniciar sesión'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
