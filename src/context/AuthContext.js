import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(null);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadStoredAuth() {
            const storedToken = await SecureStore.getItemAsync('token');
            const storedUserId = await SecureStore.getItemAsync('userId');
            if (storedToken) setToken(storedToken);
            if (storedUserId) setUserId(storedUserId);
            setLoading(false);
        }
        loadStoredAuth();
    }, []);

    async function signIn(responseData) {
        const token = responseData.Token ?? responseData.token;
        const userId = String(responseData.UserId ?? responseData.userId ?? '');
        await SecureStore.setItemAsync('token', token);
        await SecureStore.setItemAsync('userId', userId);
        setToken(token);
        setUserId(userId);
    }

    async function signOut() {
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('userId');
        setToken(null);
        setUserId(null);
    }

    return (
        <AuthContext.Provider value={{ token, userId, loading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
