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

export default function MyTeamsScreen({ navigation }) {
    const [fontsLoaded] = useAlagardFont();
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadTeams = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getMyLedTeams();
            setTeams(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e.message || 'Failed to load your teams.');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadTeams();
        }, [loadTeams])
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
            <Text style={styles.title}>My Teams</Text>

            {error && <Text style={styles.error}>{error}</Text>}

            {!error && teams.length === 0 && (
                <Text style={styles.empty}>You are not a leader of any team yet.</Text>
            )}

            <FlatList
                data={teams}
                keyExtractor={(item) => item.Id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <Text style={styles.cardName} numberOfLines={1} ellipsizeMode="tail">
                            {item.Name || 'Unnamed Team'}
                        </Text>
                        <Text style={styles.cardId} numberOfLines={1} ellipsizeMode="middle">
                            Team ID: {item.Id}
                        </Text>
                    </View>
                )}
                ListFooterComponent={
                    <View>
                        <Pressable style={styles.actionButton} onPress={() => navigation.navigate('TeamRequests')}>
                            <Text style={styles.backButtonText}>Open Join Requests</Text>
                        </Pressable>
                        <Pressable style={styles.actionButton} onPress={() => navigation.navigate('TeamInvites')}>
                            <Text style={styles.backButtonText}>Open Team Invites</Text>
                        </Pressable>
                        <Pressable style={styles.actionButton} onPress={() => navigation.navigate('ActiveLobbies')}>
                            <Text style={styles.backButtonText}>Open Map Lobbies</Text>
                        </Pressable>
                        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
                            <Text style={styles.backButtonText}>Back</Text>
                        </Pressable>
                    </View>
                }
            />
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
    },
    centered: {
        flex: 1,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        color: '#e0e0e0',
        textAlign: 'center',
        paddingTop: 24,
        paddingBottom: 12,
        fontFamily: MODULE_FONT_FAMILY,
    },
    list: {
        padding: 16,
        paddingBottom: 30,
    },
    card: {
        backgroundColor: '#16213e',
        borderRadius: 10,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#0f3460',
    },
    cardName: { color: '#e0e0e0', fontSize: 16, marginBottom: 6, fontFamily: MODULE_FONT_FAMILY },
    cardId: { color: '#a0a0c0', fontSize: 12, fontFamily: MODULE_FONT_FAMILY },
    error: { color: '#e94560', textAlign: 'center', paddingHorizontal: 16, paddingBottom: 8, fontFamily: MODULE_FONT_FAMILY },
    empty: { color: '#a0a0c0', textAlign: 'center', padding: 16, fontFamily: MODULE_FONT_FAMILY },
    backButton: {
        backgroundColor: '#0f3460',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    actionButton: {
        backgroundColor: '#e94560',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    backButtonText: { color: '#fff', fontSize: 15, fontFamily: MODULE_FONT_FAMILY },
});
