import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ImageBackground,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import { useAlagardFont, MODULE_FONT_FAMILY } from '../hooks/useAlagardFont';

const MENU_BACKGROUND = require('../../assets/menu-background.png');

export default function LoginScreen({ navigation }) {
    const { signIn } = useAuth();
    const [fontsLoaded] = useAlagardFont();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    async function handleLogin() {
        if (!identifier || !password) {
            setError('Username/email and password are required.');
            return;
        }
        setError(null);
        setLoading(true);
        try {
            const data = await api.login(identifier.trim().toLowerCase(), password);
            await signIn(data);
        } catch (e) {
            setError(e.message || 'Login failed.');
        } finally {
            setLoading(false);
        }
    }

    if (!fontsLoaded) {
        return null;
    }

    return (
        <ImageBackground source={MENU_BACKGROUND} style={styles.background} imageStyle={styles.backgroundImage}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <Text style={styles.title}>Willbinders</Text>
                {error && <Text style={styles.error}>{error}</Text>}
                <TextInput
                    style={styles.input}
                    placeholder="Username or Email"
                    placeholderTextColor="#ffffff"
                    autoCapitalize="none"
                    value={identifier}
                    onChangeText={setIdentifier}
                />
                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#ffffff"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                />
                <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
                    {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.buttonText}>Log In</Text>
                    }
                </Pressable>
                <Pressable onPress={() => navigation.navigate('Register')}>
                    <Text style={styles.link}>Don't have an account? Register</Text>
                </Pressable>
            </KeyboardAvoidingView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    background: { flex: 1 },
    backgroundImage: { resizeMode: 'cover' },
    container: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        padding: 24,
    },
    title: {
        fontSize: 60,
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: 220,
        fontFamily: MODULE_FONT_FAMILY,
        textShadowColor: '#000',
        textShadowOffset: { width: 3, height: 3 },
        textShadowRadius: 4,
    },
    input: {
        backgroundColor: '#1c55a8'  ,
        color: '#ffffff',
        fontFamily: MODULE_FONT_FAMILY,
        borderRadius: 8,
        padding: 14,
        marginBottom: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#0f3460',
    },
    button: {
        backgroundColor: '#25cc25',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 16,
    },
    buttonText: {
        color: '#fff',
        fontSize: 26,
        fontFamily: MODULE_FONT_FAMILY,
    },
    error: {
        color: '#e94560',
        marginBottom: 12,
        textAlign: 'center',
        fontFamily: MODULE_FONT_FAMILY,
    },
    link: {
        color: '#ffffff',
        textAlign: 'center',
        marginTop: 8,
        fontFamily: MODULE_FONT_FAMILY,
    },
});
