import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    RefreshControl,
} from 'react-native';
import * as api from '../api';

const POLL_INTERVAL = 30000;

export default function CharacterMapScreen({ route, navigation }) {
    const { character } = route.params;
    const mapId = character?.CurrentMap;

    const [mapData, setMapData] = useState(null);
    const [mapCharacters, setMapCharacters] = useState([]);
    const [controlScores, setControlScores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [errors, setErrors] = useState({});

    const fetchAll = useCallback(async (showLoading = false) => {
        if (showLoading) setLoading(true);
        const errs = {};

        try {
            const data = await api.getMap(mapId);
            setMapData(data ?? null);
        } catch (e) {
            errs.map = e.message || 'Failed to load map data.';
        }

        try {
            const data = await api.getCharactersInMap(mapId);
            setMapCharacters(data?.Characters ?? []);
        } catch (e) {
            errs.characters = e.message || 'Failed to load characters.';
        }

        try {
            const data = await api.getControlScoresByMapId(mapId);
            setControlScores(Array.isArray(data) ? data : []);
        } catch (e) {
            errs.control = e.message || 'Failed to load control scores.';
        }

        setErrors(errs);
        setLoading(false);
        setRefreshing(false);
    }, [mapId]);

    useEffect(() => {
        fetchAll(true);
        const interval = setInterval(() => fetchAll(), POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchAll]);

    const zoneNameById = Array.isArray(mapData?.Zones)
        ? new Map(
            mapData.Zones
                .map((z) => [z.ZoneId ?? z.Id, z.Name ?? 'Unnamed Zone'])
                .filter(([id]) => typeof id === 'string' && id.length > 0)
          )
        : new Map();

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#e94560" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); fetchAll(); }}
                        tintColor="#e94560"
                    />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <Pressable onPress={() => navigation.goBack()}>
                        <Text style={styles.back}>← Back</Text>
                    </Pressable>
                    <Text style={styles.title}>{mapData?.Name ?? 'Map'}</Text>
                </View>

                {/* Character info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Character</Text>
                    <InfoRow label="Power" value={character.Power} />
                    <InfoRow label="Experience" value={character.Experience} />
                    <InfoRow label="Zone" value={character.CurrentZone} mono />
                    <Pressable
                        style={styles.stepButton}
                        onPress={() => navigation.navigate('StepCount', { character })}
                    >
                        <Text style={styles.stepButtonText}>Submit Steps</Text>
                    </Pressable>
                </View>

                {/* Zones */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        Zones {mapData?.ZoneCount != null ? `(${mapData.ZoneCount})` : ''}
                    </Text>
                    {errors.map && <Text style={styles.error}>{errors.map}</Text>}
                    {!errors.map && Array.isArray(mapData?.Zones) && mapData.Zones.length > 0
                        ? mapData.Zones.map((zone) => {
                            const zoneId = zone.ZoneId ?? zone.Id;
                            const isCurrent = zoneId === character.CurrentZone;
                            return (
                                <View key={zoneId} style={[styles.row, isCurrent && styles.rowHighlight]}>
                                    <Text style={[styles.rowText, isCurrent && styles.rowTextHighlight]}>
                                        {zone.Name ?? 'Unnamed Zone'}{isCurrent ? ' ◀ you' : ''}
                                    </Text>
                                    <Text style={styles.rowSub}>
                                        Pop {zone.CurrentPopulation ?? 0}/{zone.MaxPopulation ?? '?'}
                                    </Text>
                                </View>
                            );
                          })
                        : !errors.map && <Text style={styles.empty}>No zones.</Text>
                    }
                </View>

                {/* Control accumulation scores */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Control Accumulation</Text>
                    {errors.control && <Text style={styles.error}>{errors.control}</Text>}
                    {!errors.control && controlScores.length === 0 && (
                        <Text style={styles.empty}>No scores yet.</Text>
                    )}
                    {!errors.control && controlScores.map((score, i) => (
                        <View key={`${score.TeamId}-${score.ZoneId}-${i}`} style={styles.scoreRow}>
                            <Text style={styles.scoreZone}>
                                {zoneNameById.get(score.ZoneId) ?? 'Zone'}
                            </Text>
                            <Text style={styles.scoreTeam} numberOfLines={1} ellipsizeMode="middle">
                                Team {score.TeamId}
                            </Text>
                            <Text style={styles.scoreValue}>
                                {Number(score.Accumulation ?? 0).toFixed(2)}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Characters in map */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Characters In Map</Text>
                    {errors.characters && <Text style={styles.error}>{errors.characters}</Text>}
                    {!errors.characters && mapCharacters.length === 0 && (
                        <Text style={styles.empty}>No characters in this map.</Text>
                    )}
                    {!errors.characters && mapCharacters.map((c) => {
                        const isSelf = c.CharacterId === character.CharacterId;
                        return (
                            <View key={c.CharacterId} style={[styles.row, isSelf && styles.rowHighlight]}>
                                <Text style={[styles.rowText, isSelf && styles.rowTextHighlight]}
                                    numberOfLines={1} ellipsizeMode="middle">
                                    {isSelf ? '★ ' : ''}{c.CharacterId}
                                </Text>
                                <Text style={styles.rowSub}>Power {c.Power}</Text>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function InfoRow({ label, value, mono }) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={[styles.infoValue, mono && styles.mono]} numberOfLines={1} ellipsizeMode="middle">
                {value}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e' },
    centered: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: 16 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 16 },
    back: { color: '#e94560', fontSize: 16 },
    title: { fontSize: 22, fontWeight: 'bold', color: '#e0e0e0', flex: 1 },
    section: {
        backgroundColor: '#16213e',
        borderRadius: 10,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#0f3460',
    },
    sectionTitle: { color: '#e94560', fontWeight: 'bold', fontSize: 15, marginBottom: 10 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    infoLabel: { color: '#a0a0c0', fontSize: 14 },
    infoValue: { color: '#e0e0e0', fontSize: 14, flex: 1, textAlign: 'right', marginLeft: 8 },
    mono: { fontFamily: 'monospace', fontSize: 12 },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#0f3460',
    },
    rowHighlight: { backgroundColor: '#1a3060', borderRadius: 6, paddingHorizontal: 6 },
    rowText: { color: '#e0e0e0', fontSize: 14, flex: 1 },
    rowTextHighlight: { color: '#e94560', fontWeight: 'bold' },
    rowSub: { color: '#a0a0c0', fontSize: 12, marginLeft: 8 },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#0f3460',
    },
    scoreZone: { color: '#e0e0e0', fontSize: 14, flex: 1 },
    scoreTeam: { color: '#a0a0c0', fontSize: 12, flex: 1 },
    scoreValue: { color: '#4caf50', fontSize: 14, fontWeight: 'bold', minWidth: 60, textAlign: 'right' },
    stepButton: {
        backgroundColor: '#0f3460',
        borderRadius: 8,
        padding: 10,
        alignItems: 'center',
        marginTop: 10,
    },
    stepButtonText: { color: '#e0e0e0', fontWeight: 'bold' },
    error: { color: '#e94560', fontSize: 13, marginBottom: 6 },
    empty: { color: '#a0a0c0', fontSize: 13 },
});
