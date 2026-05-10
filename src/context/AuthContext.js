import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { setAuthToken, clearAuthToken } from '../api';
import { startAutoStepSync, stopAutoStepSync } from '../services/stepSyncService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(null);
    const [userId, setUserId] = useState(null);
    const [accountCreatedAt, setAccountCreatedAt] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadStoredAuth() {
            const storedToken = await SecureStore.getItemAsync('token');
            const storedUserId = await SecureStore.getItemAsync('userId');
            const storedAccountCreatedAt = await SecureStore.getItemAsync('accountCreatedAt');
            if (storedToken) {
                setAuthToken(storedToken);
                setToken(storedToken);
            } else {
                clearAuthToken();
            }
            if (storedUserId) setUserId(storedUserId);
            if (storedAccountCreatedAt) setAccountCreatedAt(storedAccountCreatedAt);
            setLoading(false);
        }
        loadStoredAuth();
    }, []);

    useEffect(() => {
        if (!loading && token) {
            startAutoStepSync(accountCreatedAt);
            return () => {
                stopAutoStepSync();
            };
        }

        stopAutoStepSync();
        return undefined;
    }, [loading, token, accountCreatedAt]);

    async function signIn(responseData) {
        const token = String(responseData.Token ?? responseData.token ?? '').trim();
        const userId = String(responseData.UserId ?? responseData.userId ?? '');
        const createdAt = responseData.CreatedAt ?? responseData.createdAt ?? null;
        if (!token) {
            throw new Error('Login response did not include a token.');
        }

        setAuthToken(token);
        await SecureStore.setItemAsync('token', token);
        await SecureStore.setItemAsync('userId', userId);
        if (createdAt) {
            await SecureStore.setItemAsync('accountCreatedAt', String(createdAt));
        }
        setToken(token);
        setUserId(userId);
        setAccountCreatedAt(createdAt ? String(createdAt) : null);
    }

    async function signOut() {
        clearAuthToken();
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('userId');
        await SecureStore.deleteItemAsync('accountCreatedAt');
        setToken(null);
        setUserId(null);
        setAccountCreatedAt(null);
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
