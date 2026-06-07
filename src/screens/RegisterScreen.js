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
    ScrollView,
    ImageBackground,
} from 'react-native';
import * as api from '../api';
import { useAlagardFont, MODULE_FONT_FAMILY } from '../hooks/useAlagardFont';

const MENU_BACKGROUND = require('../../assets/menu-background.png');

export default function RegisterScreen({ navigation }) {
    const [fontsLoaded] = useAlagardFont();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [loading, setLoading] = useState(false);

    async function handleRegister() {
        if (!firstName || !lastName || !username || !email || !password) {
            setError('All fields are required.');
            return;
        }
        setError(null);
        setSuccess(null);
        setLoading(true);
        try {
            const data = await api.register(
                firstName.trim(),
                lastName.trim(),
                username.trim().toLowerCase(),
                email.trim().toLowerCase(),
                password
            );
            setSuccess(data?.message ?? 'Registration successful. Check your email to verify your account.');
        } catch (e) {
            setError(e.message || 'Registration failed.');
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
                <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
                    <Text style={styles.title}>Create Account</Text>
                    {error && <Text style={styles.error}>{error}</Text>}
                    {success && <Text style={styles.success}>{success}</Text>}
                    <TextInput style={styles.input} placeholder="First Name" placeholderTextColor="#888"
                        value={firstName} onChangeText={setFirstName} />
                    <TextInput style={styles.input} placeholder="Last Name" placeholderTextColor="#888"
                        value={lastName} onChangeText={setLastName} />
                    <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#888"
                        autoCapitalize="none" autoCorrect={false}
                        value={username} onChangeText={setUsername} />
                    <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#888"
                        autoCapitalize="none" keyboardType="email-address"
                        value={email} onChangeText={setEmail} />
                    <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#888"
                        secureTextEntry value={password} onChangeText={setPassword} />
                    <Pressable style={styles.button} onPress={handleRegister} disabled={loading}>
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.buttonText}>Register</Text>
                        }
                    </Pressable>
                    <Pressable onPress={() => navigation.navigate('Login')}>
                        <Text style={styles.link}>Already have an account? Log in</Text>
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    background: { flex: 1 },
    backgroundImage: { resizeMode: 'cover' },
    container: { flex: 1, backgroundColor: 'transparent' },
    inner: { justifyContent: 'center', padding: 24, flexGrow: 1 },
    title: {
        fontSize: 28,
        color: '#e0e0e0',
        textAlign: 'center',
        marginBottom: 32,
        fontFamily: MODULE_FONT_FAMILY,
    },
    input: {
        backgroundColor: '#16213e',
        color: '#e0e0e0',
        fontFamily: MODULE_FONT_FAMILY,
        borderRadius: 8,
        padding: 14,
        marginBottom: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#0f3460',
    },
    button: {
        backgroundColor: '#e94560',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 16,
    },
    buttonText: { color: '#fff', fontSize: 16, fontFamily: MODULE_FONT_FAMILY },
    error: { color: '#e94560', marginBottom: 12, textAlign: 'center', fontFamily: MODULE_FONT_FAMILY },
    success: { color: '#4caf50', marginBottom: 12, textAlign: 'center', fontFamily: MODULE_FONT_FAMILY },
    link: { color: '#a0a0c0', textAlign: 'center', marginTop: 8, fontFamily: MODULE_FONT_FAMILY },
});
