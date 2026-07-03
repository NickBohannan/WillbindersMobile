import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    SafeAreaView,
    Modal,
    ScrollView,
    ImageBackground,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import { useAlagardFont, MODULE_FONT_FAMILY } from '../hooks/useAlagardFont';

const MENU_BACKGROUND = require('../../assets/menu-background2.png');

export default function SelectCharacterScreen({ navigation, route }) {
    const { userId } = useAuth();
    const [fontsLoaded] = useAlagardFont();
    const [characters, setCharacters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hallVisible, setHallVisible] = useState(false);
    const [hallLoading, setHallLoading] = useState(false);
    const [hallError, setHallError] = useState(null);
    const [champions, setChampions] = useState([]);

    async function loadCharacters() {
        try {
            const data = await api.getCharactersByUserId(userId);
            setCharacters(data?.Characters ?? []);
            setError(null);
        } catch (e) {
            setError(e.message || 'Failed to load characters.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        setLoading(true);
        loadCharacters();
    }, [userId]);

    useFocusEffect(
        React.useCallback(() => {
            loadCharacters();
        }, [userId, route?.params?.refreshKey])
    );

    function handleEnterMap(character) {
        navigation.navigate('CharacterMap', { character });
    }

    async function openHallOfLegends() {
        setHallVisible(true);

        if (champions.length > 0 || hallLoading) {
            return;
        }

        setHallLoading(true);
        setHallError(null);

        try {
            const data = await api.getHallOfLegends(userId);
            const historyRecords = Array.isArray(data) ? data : [];
            const championStats = new Map();

            historyRecords.forEach((record) => {
                const characterWins = Array.isArray(record?.CharacterMapWins) ? record.CharacterMapWins : [];

                characterWins.forEach((win) => {
                    const characterId = win?.CharacterId;
                    if (!characterId) {
                        return;
                    }

                    if (!championStats.has(characterId)) {
                        championStats.set(characterId, {
                            characterId,
                            wins: 0,
                            mostRecentMapId: null,
                            mostRecentWinTime: null,
                        });
                    }

                    const existing = championStats.get(characterId);
                    existing.wins += 1;

                    const recordWinTime = record?.WinTime ? new Date(record.WinTime) : null;
                    const existingWinTime = existing.mostRecentWinTime ? new Date(existing.mostRecentWinTime) : null;

                    if (recordWinTime && (!existingWinTime || recordWinTime > existingWinTime)) {
                        existing.mostRecentMapId = record?.MapId ?? null;
                        existing.mostRecentWinTime = record.WinTime;
                    }
                });
            });

            const sortedChampions = Array.from(championStats.values()).sort((a, b) => {
                if (b.wins !== a.wins) {
                    return b.wins - a.wins;
                }

                const aTime = a.mostRecentWinTime ? new Date(a.mostRecentWinTime).getTime() : 0;
                const bTime = b.mostRecentWinTime ? new Date(b.mostRecentWinTime).getTime() : 0;
                return bTime - aTime;
            });

            setChampions(sortedChampions);
        } catch (e) {
            setHallError(e.message || 'Failed to load Hall of Legends.');
        } finally {
            setHallLoading(false);
        }
    }

    function closeHallOfLegends() {
        setHallVisible(false);
    }

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
            <Text style={styles.title}>Your Characters</Text>
            <View style={styles.actionsRow}>
                <Pressable style={styles.hallButton} onPress={openHallOfLegends}>
                    <Text style={styles.hallButtonText}>Hall of Legends</Text>
                </Pressable>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            {!error && characters.length === 0 && (
                <Text style={styles.empty}>No characters found for your account.</Text>
            )}

            <FlatList
                data={characters}
                keyExtractor={(item) => item.CharacterId}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <Text style={styles.cardName} numberOfLines={1} ellipsizeMode="tail">
                            {item.CharacterName || 'Unnamed Character'}
                        </Text>
                        <View style={styles.row}>
                            <Text style={styles.label}>Team</Text>
                            <Text style={styles.value} numberOfLines={1} ellipsizeMode="middle">
                                {item.TeamName || item.TeamId}
                            </Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Power</Text>
                            <Text style={styles.value}>{item.Power}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Zone</Text>
                            <Text style={styles.value} numberOfLines={1} ellipsizeMode="middle">{item.CurrentZone}</Text>
                        </View>
                        <Pressable style={styles.button} onPress={() => handleEnterMap(item)}>
                            <Text style={styles.buttonText}>Enter Map</Text>
                        </Pressable>
                    </View>
                )}
            />

            <Modal
                visible={hallVisible}
                animationType="slide"
                transparent
                onRequestClose={closeHallOfLegends}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Hall of Legends</Text>
                            <Pressable style={styles.modalCloseButton} onPress={closeHallOfLegends}>
                                <Text style={styles.modalCloseText}>Close</Text>
                            </Pressable>
                        </View>

                        {hallLoading && <ActivityIndicator size="small" color="#e3c15d" style={styles.modalLoading} />}
                        {!hallLoading && hallError && <Text style={styles.error}>{hallError}</Text>}
                        {!hallLoading && !hallError && champions.length === 0 && (
                            <Text style={styles.empty}>No champions yet.</Text>
                        )}

                        {!hallLoading && !hallError && champions.length > 0 && (
                            <ScrollView contentContainerStyle={styles.modalList}>
                                {champions.map((champion, index) => (
                                    <View key={champion.characterId} style={styles.modalItem}>
                                        <Text style={styles.modalItemTitle} numberOfLines={1} ellipsizeMode="middle">
                                            #{index + 1} Character {champion.characterId}
                                        </Text>
                                        <Text style={styles.modalItemLine}>Total Map Wins: {champion.wins}</Text>
                                        <Text style={styles.modalItemLine} numberOfLines={1} ellipsizeMode="middle">
                                            Most Recent Map: {champion.mostRecentMapId || 'N/A'}
                                        </Text>
                                        <Text style={styles.modalItemLine}>
                                            Most Recent Win:{' '}
                                            {champion.mostRecentWinTime
                                                ? new Date(champion.mostRecentWinTime).toLocaleString()
                                                : 'N/A'}
                                        </Text>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
            </SafeAreaView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    background: { flex: 1 },
    backgroundImage: { resizeMode: 'cover' },
    container: { flex: 1, backgroundColor: 'transparent' },
    centered: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
    title: {
        fontSize: 24,
        color: '#e0e0e0',
        textAlign: 'center',
        paddingTop: 24,
        paddingBottom: 12,
        fontFamily: MODULE_FONT_FAMILY,
    },
    actionsRow: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    hallButton: {
        backgroundColor: '#5f5123',
        borderWidth: 1,
        borderColor: '#e3c15d',
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
    },
    hallButtonText: {
        color: '#f6df87',
        fontFamily: MODULE_FONT_FAMILY,
    },
    list: { padding: 16 },
    card: {
        backgroundColor: '#16213e',
        borderRadius: 10,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#0f3460',
    },
    cardName: { color: '#e0e0e0', fontSize: 16, marginBottom: 6, fontFamily: MODULE_FONT_FAMILY },
    cardId: { color: '#a0a0c0', fontSize: 12, marginBottom: 8, fontFamily: MODULE_FONT_FAMILY },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    label: { color: '#a0a0c0', fontSize: 14, fontFamily: MODULE_FONT_FAMILY },
    value: { color: '#e0e0e0', fontSize: 14, flexShrink: 1, marginLeft: 8, textAlign: 'right', fontFamily: MODULE_FONT_FAMILY },
    button: {
        backgroundColor: '#25cc25',
        borderRadius: 8,
        padding: 10,
        alignItems: 'center',
        marginTop: 12,
    },
    buttonText: { color: '#fff', fontSize: 20, fontFamily: MODULE_FONT_FAMILY },
    error: { color: '#e94560', textAlign: 'center', padding: 16, fontFamily: MODULE_FONT_FAMILY },
    empty: { color: '#a0a0c0', textAlign: 'center', padding: 16, fontFamily: MODULE_FONT_FAMILY },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        padding: 16,
    },
    modalCard: {
        backgroundColor: '#111a30',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#264571',
        maxHeight: '85%',
        padding: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    modalTitle: {
        color: '#f0f0f8',
        fontSize: 20,
        fontFamily: MODULE_FONT_FAMILY,
    },
    modalCloseButton: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#7993bf',
    },
    modalCloseText: {
        color: '#d9e4ff',
        fontFamily: MODULE_FONT_FAMILY,
    },
    modalLoading: {
        marginVertical: 20,
    },
    modalList: {
        gap: 8,
        paddingVertical: 4,
    },
    modalItem: {
        borderWidth: 1,
        borderColor: '#35598d',
        borderRadius: 8,
        padding: 10,
        backgroundColor: '#172743',
    },
    modalItemTitle: {
        color: '#f0f0f8',
        marginBottom: 4,
        fontFamily: MODULE_FONT_FAMILY,
    },
    modalItemLine: { color: '#c3d3f3', marginBottom: 2, fontFamily: MODULE_FONT_FAMILY },
});
