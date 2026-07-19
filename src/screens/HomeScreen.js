import React from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAlagardFont, MODULE_FONT_FAMILY } from '../hooks/useAlagardFont';

const MENU_BACKGROUND = require('../../assets/menu-background2.png');

export default function HomeScreen({ navigation }) {
    const { signOut } = useAuth();
    const [fontsLoaded] = useAlagardFont();

    if (!fontsLoaded) {
        return null; // or a loading indicator
    }

    return (
        <ImageBackground source={MENU_BACKGROUND} style={styles.background} imageStyle={styles.backgroundImage}>
            <View style={styles.container}>
                <Text style={styles.title}>Main Menu</Text>
                <Pressable style={styles.button} onPress={() => navigation.navigate('SelectCharacter')}>
                    <Text style={styles.buttonText}>Select Character</Text>
                </Pressable>
                <Pressable style={styles.button} onPress={() => navigation.navigate('ActiveLobbies')}>
                    <Text style={styles.buttonText}>Map Lobbies</Text>
                </Pressable>
                <Pressable style={styles.button} onPress={() => navigation.navigate('CreateTeam')}>
                    <Text style={styles.buttonText}>Create Team</Text>
                </Pressable>
                <Pressable style={styles.button} onPress={() => navigation.navigate('MyTeams')}>
                    <Text style={styles.buttonText}>My Teams</Text>
                </Pressable>
                <Pressable style={styles.button} onPress={() => navigation.navigate('TeamInvites')}>
                    <Text style={styles.buttonText}>Team Invites</Text>
                </Pressable>
                <Pressable style={styles.button} onPress={() => navigation.navigate('TeamRequests')}>
                    <Text style={styles.buttonText}>Join Requests</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.signOutButton]} onPress={signOut}>
                    <Text style={styles.buttonText}>Sign Out</Text>
                </Pressable>
            </View>
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
        alignItems: 'center',
        padding: 24,
        fontFamily: MODULE_FONT_FAMILY,
    },
    title: {
        fontSize: 48,
        color: '#e0e0e0',
        textAlign: 'center',
        marginBottom: 40,
        fontFamily: MODULE_FONT_FAMILY,
        textShadowColor: '#000',
        textShadowOffset: { width: 3, height: 3 },
        textShadowRadius: 4,
    },
    button: {
        backgroundColor: '#1c55a8',
        borderRadius: 8,
        paddingVertical: 14,
        paddingHorizontal: 40,
        marginBottom: 14,
        width: '100%',
        alignItems: 'center',
    },
    signOutButton: { backgroundColor: '#e94560' },
    buttonText: { color: '#fff', fontSize: 26, fontFamily: MODULE_FONT_FAMILY },
});
