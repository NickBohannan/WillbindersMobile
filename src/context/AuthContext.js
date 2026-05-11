import React, { createContext, useContext, useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { setAuthToken, clearAuthToken } from '../api';
import { syncStepsOnLogin } from '../services/stepSyncService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(null);
    const [userId, setUserId] = useState(null);
    const [accountCreatedAt, setAccountCreatedAt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stepSyncResult, setStepSyncResult] = useState(null);

    useEffect(() => {
        async function loadStoredAuth() {
            const storedToken = await SecureStore.getItemAsync('token');
            const storedUserId = await SecureStore.getItemAsync('userId');
            const storedAccountCreatedAt = await SecureStore.getItemAsync('accountCreatedAt');
            if (storedToken) {
                setAuthToken(storedToken);
                setToken(storedToken);
                const result = await syncStepsOnLogin(storedAccountCreatedAt ?? null);
                if (result.outcome === 'success' || result.outcome === 'error') {
                    setStepSyncResult(result);
                }
            } else {
                clearAuthToken();
            }
            if (storedUserId) setUserId(storedUserId);
            if (storedAccountCreatedAt) setAccountCreatedAt(storedAccountCreatedAt);
            setLoading(false);
        }
        loadStoredAuth();
    }, []);

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

        const result = await syncStepsOnLogin(createdAt ? String(createdAt) : null);
        if (result.outcome === 'success' || result.outcome === 'error') {
            setStepSyncResult(result);
        }
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

    function clearStepSyncResult() {
        setStepSyncResult(null);
    }

    const isSuccess = stepSyncResult?.outcome === 'success';

    return (
        <AuthContext.Provider value={{ token, userId, loading, signIn, signOut }}>
            {children}
            <Modal
                visible={stepSyncResult !== null}
                transparent
                animationType="fade"
                onRequestClose={clearStepSyncResult}
            >
                <View style={styles.overlay}>
                    <View style={styles.card}>
                        {isSuccess ? (
                            <>
                                <Text style={styles.emoji}>🎉</Text>
                                <Text style={styles.title}>Steps Synced!</Text>
                                <Text style={styles.body}>
                                    {'You walked '}
                                    <Text style={styles.highlight}>{stepSyncResult.stepCount}</Text>
                                    {' steps yesterday'}
                                    {stepSyncResult.powerGained > 0
                                        ? (', gaining ' + stepSyncResult.powerGained + ' power for your characters!')
                                        : '!'}
                                </Text>
                            </>
                        ) : (
                            <>
                                <Text style={styles.emoji}>⚠️</Text>
                                <Text style={styles.title}>Sync Failed</Text>
                                <Text style={styles.body}>{stepSyncResult?.message}</Text>
                            </>
                        )}
                        <Pressable style={styles.button} onPress={clearStepSyncResult}>
                            <Text style={styles.buttonText}>OK</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#16213e',
        borderRadius: 16,
        padding: 28,
        alignItems: 'center',
        width: '100%',
        borderWidth: 1,
        borderColor: '#0f3460',
    },
    emoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#e0e0e0',
        marginBottom: 12,
        textAlign: 'center',
    },
    body: {
        fontSize: 16,
        color: '#a0a0c0',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    highlight: {
        color: '#e94560',
        fontWeight: 'bold',
    },
    button: {
        backgroundColor: '#e94560',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 32,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
