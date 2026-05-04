import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    SafeAreaView,
    Alert,
    Platform,
    AppState,
    Linking,
} from 'react-native';
import { Pedometer } from 'expo-sensors';
import * as api from '../api';

function generateRequestId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

export default function StepCountScreen({ route, navigation }) {
    const { character } = route.params;

    const [isPedometerAvailable, setIsPedometerAvailable] = useState(null);
    const [permissionGranted, setPermissionGranted] = useState(null);
    const [stepsSinceOpen, setStepsSinceOpen] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [lastResult, setLastResult] = useState(null);

    const subscriptionRef = useRef(null);
    const sessionStartRef = useRef(new Date());

    async function checkMotionPermission() {
        const available = await Pedometer.isAvailableAsync();
        setIsPedometerAvailable(available);

        if (!available) {
            setPermissionGranted(false);
            return false;
        }

        try {
            const currentPermission = await Pedometer.getPermissionsAsync();
            setPermissionGranted(currentPermission.granted);
            return currentPermission.granted;
        } catch {
            setPermissionGranted(true);
            return true;
        }
    }

    async function requestMotionPermission() {
        try {
            const requestedPermission = await Pedometer.requestPermissionsAsync();
            setPermissionGranted(requestedPermission.granted);
            return requestedPermission.granted;
        } catch {
            return false;
        }
    }

    function startTracking() {
        sessionStartRef.current = new Date();
        subscriptionRef.current?.remove();
        subscriptionRef.current = Pedometer.watchStepCount((result) => {
            setStepsSinceOpen(result.steps);
        });

        const intervalId = setInterval(async () => {
            try {
                const sampled = await Pedometer.getStepCountAsync(sessionStartRef.current, new Date());
                setStepsSinceOpen((prev) => Math.max(prev, sampled.steps));
            } catch {
                // Ignore polling errors on platforms where this API is limited.
            }
        }, 5000);

        return () => {
            clearInterval(intervalId);
            subscriptionRef.current?.remove();
        };
    }

    useEffect(() => {
        async function setup() {
            const granted = await checkMotionPermission();
            if (granted) {
                return startTracking();
            }

            const requested = await requestMotionPermission();
            if (requested) {
                return startTracking();
            }
        }

        let cleanup;
        setup().then((fn) => {
            cleanup = fn;
        });

        const appStateSub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                checkMotionPermission();
            }
        });

        return () => {
            appStateSub.remove();
            if (typeof cleanup === 'function') cleanup();
        };
    }, []);

    async function handleRetryPermission() {
        const granted = await requestMotionPermission();
        if (granted) {
            startTracking();
        }
    }

    async function handleSubmit() {
        if (stepsSinceOpen <= 0) {
            Alert.alert('No steps', 'Walk a bit before submitting.');
            return;
        }

        if (stepsSinceOpen > 100000) {
            Alert.alert('Too many steps', 'Maximum 100,000 steps per submission.');
            return;
        }

        setSubmitting(true);
        setLastResult(null);
        try {
            await api.postStepCount(character.CharacterId, stepsSinceOpen, generateRequestId());
            setLastResult({ success: true, message: `${stepsSinceOpen} steps submitted!` });
            setStepsSinceOpen(0);
        } catch (e) {
            setLastResult({ success: false, message: e.message || 'Submission failed.' });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.inner}>
                <Pressable onPress={() => navigation.goBack()}>
                    <Text style={styles.back}>← Back</Text>
                </Pressable>

                <Text style={styles.title}>Submit Steps</Text>
                <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="middle">
                    Character: {character.CharacterName || character.CharacterId}
                </Text>

                {isPedometerAvailable === null && (
                    <ActivityIndicator size="large" color="#e94560" style={{ marginTop: 40 }} />
                )}

                {isPedometerAvailable === false && (
                    <Text style={styles.warning}>
                        Pedometer is not available on this device.{'\n'}
                        {Platform.OS === 'android'
                            ? 'Make sure the ACTIVITY_RECOGNITION permission is granted.'
                            : 'Make sure Motion & Fitness access is enabled in Settings.'}
                    </Text>
                )}

                {isPedometerAvailable === true && permissionGranted === false && (
                    <View>
                        <Text style={styles.warning}>
                            Motion permission is required to count steps.{"\n"}
                            {Platform.OS === 'android'
                                ? 'Enable Physical Activity permission in App Settings.'
                                : 'Enable Motion & Fitness in iOS Settings.'}
                        </Text>
                        <Pressable style={styles.secondaryButton} onPress={handleRetryPermission}>
                            <Text style={styles.secondaryButtonText}>Retry Permission</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryButton} onPress={() => Linking.openSettings()}>
                            <Text style={styles.secondaryButtonText}>Open App Settings</Text>
                        </Pressable>
                    </View>
                )}

                {isPedometerAvailable === true && permissionGranted !== false && (
                    <>
                        <View style={styles.counterBox}>
                            <Text style={styles.counterLabel}>Steps since opening this screen</Text>
                            <Text style={styles.counterValue}>{stepsSinceOpen.toLocaleString()}</Text>
                        </View>

                        <Pressable
                            style={[styles.button, (submitting || stepsSinceOpen <= 0) && styles.buttonDisabled]}
                            onPress={handleSubmit}
                            disabled={submitting || stepsSinceOpen <= 0}
                        >
                            {submitting
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.buttonText}>Submit {stepsSinceOpen.toLocaleString()} Steps</Text>
                            }
                        </Pressable>

                        {lastResult && (
                            <Text style={lastResult.success ? styles.success : styles.error}>
                                {lastResult.message}
                            </Text>
                        )}

                        <Text style={styles.hint}>
                            Steps are counted from when you opened this screen.{'\n'}
                            Each submission is deduplicated by the server.
                        </Text>
                    </>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e' },
    inner: { flex: 1, padding: 24 },
    back: { color: '#e94560', fontSize: 16, marginBottom: 16 },
    title: { fontSize: 26, fontWeight: 'bold', color: '#e0e0e0', marginBottom: 6 },
    subtitle: { color: '#a0a0c0', fontSize: 12, marginBottom: 32 },
    counterBox: {
        backgroundColor: '#16213e',
        borderRadius: 16,
        padding: 32,
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#0f3460',
    },
    counterLabel: { color: '#a0a0c0', fontSize: 14, marginBottom: 12, textAlign: 'center' },
    counterValue: { color: '#e0e0e0', fontSize: 64, fontWeight: 'bold' },
    button: {
        backgroundColor: '#e94560',
        borderRadius: 10,
        padding: 16,
        alignItems: 'center',
        marginBottom: 16,
    },
    buttonDisabled: { backgroundColor: '#5a2030', opacity: 0.6 },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    success: { color: '#4caf50', textAlign: 'center', marginBottom: 12, fontSize: 15 },
    error: { color: '#e94560', textAlign: 'center', marginBottom: 12, fontSize: 15 },
    warning: { color: '#f0a500', textAlign: 'center', marginTop: 40, fontSize: 14, lineHeight: 22 },
    secondaryButton: {
        borderWidth: 1,
        borderColor: '#a0a0c0',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    secondaryButtonText: { color: '#e0e0e0', fontWeight: '600' },
    hint: { color: '#606080', fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
});
