import React, { useCallback, useState } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    FlatList,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    ImageBackground,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../api';
import { useAlagardFont, MODULE_FONT_FAMILY } from '../hooks/useAlagardFont';

const MENU_BACKGROUND = require('../../assets/menu-background2.png');

export default function ActiveLobbiesScreen({ navigation, route }) {
    const initialTeamId = route?.params?.initialTeamId ?? null;
    const [fontsLoaded] = useAlagardFont();
    const [lobbies, setLobbies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadLobbies = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await api.getActiveMapLobbies();
            setLobbies(Array.isArray(result) ? result : []);
        } catch (e) {
            setError(e.message || 'Failed to load active lobbies.');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadLobbies();
        }, [loadLobbies])
    );

    if (!fontsLoaded) {
        return null;
    }

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#e94560" />
            </View>
        );
    }

    return (
        <ImageBackground source={MENU_BACKGROUND} style={styles.background} imageStyle={styles.backgroundImage}>
            <SafeAreaView style={styles.container}>
                <Text style={styles.title}>Active Lobbies</Text>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                {!error && lobbies.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Text style={styles.empty}>No active lobbies yet.</Text>
                        <Text style={styles.emptyHint}>Create a new lobby or wait for invites.</Text>
                    </View>
                ) : null}

                <FlatList
                    data={lobbies}
                    keyExtractor={(item) => item.LobbyId}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>{item.MapName || 'Unnamed Lobby Map'}</Text>
                            <Text style={styles.meta}>Lobby ID: {item.LobbyId}</Text>
                            <Text style={styles.meta}>State: {item.State}</Text>
                            <Text style={styles.meta}>Members: {Array.isArray(item.Members) ? item.Members.length : 0}</Text>

                            <Pressable
                                style={styles.primaryButton}
                                onPress={() => navigation.navigate('MapLobby', { lobbyId: item.LobbyId })}
                            >
                                <Text style={styles.buttonText}>Open Lobby</Text>
                            </Pressable>
                        </View>
                    )}
                />

                <Pressable
                    style={styles.secondaryButton}
                    onPress={() => navigation.navigate('MapChallenges', { initialTeamId })}
                >
                    <Text style={styles.buttonText}>Create New Lobby</Text>
                </Pressable>

                <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.buttonText}>Back</Text>
                </Pressable>
            </SafeAreaView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    background: { flex: 1 },
    backgroundImage: { resizeMode: 'cover' },
    container: {
        flex: 1,
        backgroundColor: 'transparent',
        padding: 16,
    },
    centered: {
        flex: 1,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        color: '#e0e0e0',
        fontSize: 26,
        marginBottom: 12,
        textAlign: 'center',
        fontFamily: MODULE_FONT_FAMILY,
    },
    list: {
        paddingBottom: 10,
    },
    card: {
        backgroundColor: '#16213e',
        borderWidth: 1,
        borderColor: '#0f3460',
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
    },
    cardTitle: {
        color: '#e0e0e0',
        fontSize: 16,
        marginBottom: 6,
        fontFamily: MODULE_FONT_FAMILY,
    },
    meta: {
        color: '#a0a0c0',
        fontSize: 12,
        marginBottom: 2,
        fontFamily: MODULE_FONT_FAMILY,
    },
    primaryButton: {
        backgroundColor: '#e94560',
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
        marginTop: 8,
    },
    secondaryButton: {
        backgroundColor: '#0f3460',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonText: { color: '#fff', fontSize: 14, fontFamily: MODULE_FONT_FAMILY },
    error: { color: '#ff667f', marginBottom: 6, textAlign: 'center', fontFamily: MODULE_FONT_FAMILY },
    emptyBox: {
        backgroundColor: '#16213e',
        borderWidth: 1,
        borderColor: '#0f3460',
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
    },
    empty: { color: '#e0e0e0', fontSize: 14, fontFamily: MODULE_FONT_FAMILY },
    emptyHint: { color: '#a0a0c0', fontSize: 12, marginTop: 4, fontFamily: MODULE_FONT_FAMILY },
});
