import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    RefreshControl,
    Animated,
} from 'react-native';
import * as api from '../api';

const POLL_INTERVAL = 30000;
const TOAST_DURATION_MS = 5000;

export default function CharacterMapScreen({ route, navigation }) {
    const { character } = route.params;
    const mapId = character?.CurrentMap;

    const [mapData, setMapData] = useState(null);
    const [mapCharacters, setMapCharacters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [errors, setErrors] = useState({});
    const [socketStatus, setSocketStatus] = useState('disconnected');
    const [toasts, setToasts] = useState([]);
    const toastTimersRef = useRef({});

    const addToast = useCallback((id, type, text) => {
        setToasts((prev) => {
            if (prev.some((t) => t.id === id)) return prev;
            return [...prev, { id, type, text, opacity: new Animated.Value(0) }];
        });

        toastTimersRef.current[id] = setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
            delete toastTimersRef.current[id];
        }, TOAST_DURATION_MS);
    }, []);

    useEffect(() => {
        const timers = toastTimersRef.current;
        return () => { Object.values(timers).forEach(clearTimeout); };
    }, []);

    const fetchCharactersInMap = useCallback(async () => {
        try {
            const data = await api.getCharactersInMap(mapId);
            setMapCharacters(data?.Characters ?? []);
            setErrors((prev) => ({ ...prev, characters: undefined }));
        } catch (e) {
            setErrors((prev) => ({ ...prev, characters: e.message || 'Failed to load characters.' }));
        }
    }, [mapId]);

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

        setErrors(errs);
        setLoading(false);
        setRefreshing(false);
    }, [mapId]);

    useEffect(() => {
        fetchAll(true);
        const interval = setInterval(() => fetchCharactersInMap(), POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchAll, fetchCharactersInMap]);

    useEffect(() => {
        if (!mapId) return undefined;

        let isActive = true;
        let reconnectTimerId;
        let socket;

        const connect = async () => {
            if (!isActive) return;
            setSocketStatus('connecting');
            try {
                socket = await api.createMapControlSocket(mapId);
            } catch {
                if (isActive) {
                    setSocketStatus('error');
                    reconnectTimerId = setTimeout(connect, 3000);
                }
                return;
            }

            socket.onopen = () => {
                if (isActive) setSocketStatus('live');
            };

            socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message?.Map) setMapData(message.Map);

                    if (message?.Type === 'zoneCaptured' && message.ZoneId && message.ControllingTeamId) {
                        const toastId = `zone-${message.ZoneId}-${message.ControllingTeamId}`;
                        addToast(toastId, 'capture', `Zone captured by ${formatTeamLabel(message.ControllingTeamId)}`);
                    }

                    if (message?.Type === 'mapWon' && message.WinningTeamId) {
                        const toastId = `win-${message.MapId}-${message.WinningTeamId}`;
                        addToast(toastId, 'win', `${formatTeamLabel(message.WinningTeamId)} has won the map!`);
                    }
                } catch {
                    // Ignore malformed payloads.
                }
            };

            socket.onerror = () => {
                if (isActive) setSocketStatus('error');
            };

            socket.onclose = () => {
                if (!isActive) return;
                setSocketStatus('disconnected');
                reconnectTimerId = setTimeout(connect, 3000);
            };
        };

        connect();

        return () => {
            isActive = false;
            if (reconnectTimerId) clearTimeout(reconnectTimerId);
            if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
                socket.close();
            }
        };
    }, [mapId, addToast]);

    const zones = Array.isArray(mapData?.Zones) ? mapData.Zones : [];
    const winningTeamLabel = formatTeamLabel(mapData?.WinningTeamId);

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#e94560" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {toasts.length > 0 && (
                <View style={styles.toastContainer} pointerEvents="none">
                    {toasts.map((toast) => (
                        <View
                            key={toast.id}
                            style={[
                                styles.toast,
                                toast.type === 'win' ? styles.toastWin : styles.toastCapture,
                            ]}
                        >
                            <Text style={styles.toastText}>{toast.text}</Text>
                        </View>
                    ))}
                </View>
            )}
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
                    <Text style={[styles.socketBadge, socketStatus === 'live' && styles.socketBadgeLive]}>
                        {socketStatus === 'live' ? '● live' : '○ ' + socketStatus}
                    </Text>
                </View>

                {mapData?.WinningTeamId && (
                    <View style={styles.winnerBanner}>
                        <Text style={styles.winnerLabel}>Map Winner</Text>
                        <Text style={styles.winnerValue}>{winningTeamLabel}</Text>
                    </View>
                )}

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
                    {!errors.map && zones.length > 0
                        ? zones.map((zone) => {
                            const zoneId = zone.ZoneId ?? zone.Id;
                            const isCurrent = zoneId === character.CurrentZone;
                            const controllingTeamLabel = formatTeamLabel(zone.ControllingTeamId);
                            const capturingTeamLabel = formatTeamLabel(zone.CapturingTeamId);
                            const leadingControl = Number(zone.LeadingControlPercentage ?? 0);
                            const captureThreshold = Number(zone.CaptureThresholdPercentage ?? 100);
                            const progress = captureThreshold > 0
                                ? Math.min((leadingControl / captureThreshold) * 100, 100)
                                : 0;
                            return (
                                <View key={zoneId} style={[styles.zoneCard, isCurrent && styles.rowHighlight]}>
                                    <View style={styles.zoneHeaderRow}>
                                        <Text style={[styles.rowText, isCurrent && styles.rowTextHighlight]}>
                                            {zone.Name ?? 'Unnamed Zone'}{isCurrent ? ' ◀ you' : ''}
                                        </Text>
                                        <Text style={styles.zoneStatus}>
                                            {zone.ControllingTeamId
                                                ? `Held by ${controllingTeamLabel}`
                                                : zone.CapturingTeamId
                                                    ? `Capturing: ${capturingTeamLabel}`
                                                    : 'Neutral'}
                                        </Text>
                                    </View>
                                    <Text style={styles.rowSub}>
                                        Pop {zone.Characters?.length ?? 0}
                                    </Text>
                                    <Text style={styles.zoneMeta}>
                                        {zone.IsContested ? 'Contested' : 'Not contested'}
                                    </Text>
                                    <Text style={styles.zoneMeta}>
                                        Control {leadingControl.toFixed(1)} / {captureThreshold.toFixed(1)}
                                    </Text>
                                    <View style={styles.progressTrack}>
                                        <View style={[styles.progressFill, { width: `${progress}%` }]} />
                                    </View>
                                    {Array.isArray(zone.ControlPercentages) && zone.ControlPercentages.length > 0 && (
                                        <View style={styles.controlBreakdown}>
                                            {zone.ControlPercentages
                                                .slice()
                                                .sort((a, b) => (b.Percentage ?? 0) - (a.Percentage ?? 0))
                                                .map((control) => {
                                                    const teamControl = Number(control.Percentage ?? 0);
                                                    const captureProgress = captureThreshold > 0
                                                        ? Math.min((teamControl / captureThreshold) * 100, 100)
                                                        : 0;

                                                    return (
                                                        <View key={`${zoneId}-${control.TeamId}`} style={styles.scoreRow}>
                                                            <Text style={styles.scoreZone}>{formatTeamLabel(control.TeamId)}</Text>
                                                            <Text style={styles.scoreValue}>
                                                                {captureProgress.toFixed(1)}%
                                                            </Text>
                                                        </View>
                                                    );
                                                })}
                                        </View>
                                    )}
                                </View>
                            );
                          })
                        : !errors.map && <Text style={styles.empty}>No zones.</Text>
                    }
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

function formatTeamLabel(teamId) {
    if (!teamId || typeof teamId !== 'string') {
        return 'None';
    }

    return `Team ${teamId.slice(0, 8)}`;
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
    toastContainer: {
        position: 'absolute',
        top: 52,
        left: 16,
        right: 16,
        zIndex: 100,
        gap: 8,
    },
    toast: {
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginBottom: 6,
    },
    toastCapture: {
        backgroundColor: '#0f3460',
        borderWidth: 1,
        borderColor: '#7f9cff',
    },
    toastWin: {
        backgroundColor: '#203a2d',
        borderWidth: 1,
        borderColor: '#95d5b2',
    },
    toastText: { color: '#e0e0e0', fontSize: 14, fontWeight: '600' },
    socketBadge: { color: '#8ea3c7', fontSize: 11 },
    socketBadgeLive: { color: '#86efac' },
    scroll: { padding: 16 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 16 },
    back: { color: '#e94560', fontSize: 16 },
    title: { fontSize: 22, fontWeight: 'bold', color: '#e0e0e0', flex: 1 },
    winnerBanner: {
        backgroundColor: '#203a2d',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#2d6a4f',
        padding: 14,
        marginBottom: 14,
    },
    winnerLabel: { color: '#95d5b2', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },
    winnerValue: { color: '#d8f3dc', fontSize: 18, fontWeight: 'bold' },
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
    zoneCard: {
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#0f3460',
    },
    zoneHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    zoneStatus: { color: '#95d5b2', fontSize: 12 },
    zoneMeta: { color: '#8ea3c7', fontSize: 12, marginTop: 4 },
    progressTrack: {
        height: 8,
        backgroundColor: '#0f3460',
        borderRadius: 999,
        marginTop: 10,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#e94560',
        borderRadius: 999,
    },
    controlBreakdown: { marginTop: 10 },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
    },
    scoreZone: { color: '#e0e0e0', fontSize: 14, flex: 1 },
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
