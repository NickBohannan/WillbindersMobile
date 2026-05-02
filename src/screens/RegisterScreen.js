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
} from 'react-native';
import * as api from '../api';

export default function RegisterScreen({ navigation }) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [loading, setLoading] = useState(false);

    async function handleRegister() {
        if (!firstName || !lastName || !email || !password) {
            setError('All fields are required.');
            return;
        }
        setError(null);
        setSuccess(null);
        setLoading(true);
        try {
            const data = await api.register(firstName.trim(), lastName.trim(), email.trim().toLowerCase(), password);
            setSuccess(data?.message ?? 'Registration successful. Check your email to verify your account.');
        } catch (e) {
            setError(e.message || 'Registration failed.');
        } finally {
            setLoading(false);
        }
    }

    return (
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
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e' },
    inner: { justifyContent: 'center', padding: 24, flexGrow: 1 },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#e0e0e0',
        textAlign: 'center',
        marginBottom: 32,
    },
    input: {
        backgroundColor: '#16213e',
        color: '#e0e0e0',
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
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    error: { color: '#e94560', marginBottom: 12, textAlign: 'center' },
    success: { color: '#4caf50', marginBottom: 12, textAlign: 'center' },
    link: { color: '#a0a0c0', textAlign: 'center', marginTop: 8 },
});
