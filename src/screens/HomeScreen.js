import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen({ navigation }) {
    const { signOut } = useAuth();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Willbinders</Text>
            <Pressable style={styles.button} onPress={() => navigation.navigate('SelectCharacter')}>
                <Text style={styles.buttonText}>Select Character</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.signOutButton]} onPress={signOut}>
                <Text style={styles.buttonText}>Sign Out</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#e0e0e0',
        marginBottom: 40,
    },
    button: {
        backgroundColor: '#e94560',
        borderRadius: 8,
        paddingVertical: 14,
        paddingHorizontal: 40,
        marginBottom: 14,
        width: '100%',
        alignItems: 'center',
    },
    signOutButton: { backgroundColor: '#0f3460' },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
