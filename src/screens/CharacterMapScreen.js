import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    Modal,
    StyleSheet,
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    RefreshControl,
    Animated,
    ImageBackground,
} from 'react-native';
import { useFonts } from 'expo-font';
import * as api from '../api';

const POLL_INTERVAL = 30000;
const TOAST_DURATION_MS = 5000;
const MAP_BACKGROUND = require('../../assets/testmap.png');
const MODULE_FONT_FAMILY = 'alagard';
const ZONE_PIN_LAYOUTS = [
    { left: '63%', top: '17%' },
    { left: '47%', top: '64%' },
    { left: '40%', top: '26%' },
    { left: '6%', top: '37%' },
    { left: '33%', top: '8%' },
    { left: '10%', top: '82%' },
    { left: '13%', top: '50%' },
    { left: '8%', top: '66%' },
    { left: '60%', top: '84%' },
    { left: '63%', top: '40%' },
];

export default function CharacterMapScreen({ route, navigation }) {
    const { character } = route.params;
    const mapId = character?.CurrentMap;
    const [fontsLoaded] = useFonts({
        [MODULE_FONT_FAMILY]: require('../../assets/alagard.ttf'),
    });

    const [mapData, setMapData] = useState(null);
    const [mapCharacters, setMapCharacters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [errors, setErrors] = useState({});
    const [socketStatus, setSocketStatus] = useState('disconnected');
    const [toasts, setToasts] = useState([]);
    const [isCharacterOverlayVisible, setIsCharacterOverlayVisible] = useState(false);
    const [isStepOverlayVisible, setIsStepOverlayVisible] = useState(false);
    const [selectedZoneSnapshot, setSelectedZoneSnapshot] = useState(null);
    const toastTimersRef = useRef({});
    const teamNameLookupRef = useRef({});

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

    useEffect(() => {
        teamNameLookupRef.current = buildTeamNameLookup(mapCharacters);
    }, [mapCharacters]);

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

                    const toastTeamLookup = teamNameLookupRef.current;

                    if (message?.Type === 'zoneCaptured' && message.ZoneId && message.ControllingTeamId) {
                        const toastId = `zone-${message.ZoneId}-${message.ControllingTeamId}`;
                        addToast(toastId, 'capture', `Zone captured by ${formatTeamLabel(message.ControllingTeamId, toastTeamLookup)}`);
                    }

                    if (message?.Type === 'mapWon' && message.WinningTeamId) {
                        const toastId = `win-${message.MapId}-${message.WinningTeamId}`;
                        addToast(toastId, 'win', `${formatTeamLabel(message.WinningTeamId, toastTeamLookup)} has won the map!`);
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
    const teamNameById = buildTeamNameLookup(mapCharacters);
    const stableZones = [...zones].sort((a, b) => compareZonesForStablePins(a, b));
    const winningTeamLabel = formatTeamLabel(mapData?.WinningTeamId, teamNameById);
    const zoneSnapshots = stableZones.map((zone) => {
        const zoneId = zone.ZoneId ?? zone.Id;
        const isCurrent = zoneId === character.CurrentZone;
        const controllingTeamLabel = formatTeamLabel(zone.ControllingTeamId, teamNameById);
        const capturingTeamLabel = formatTeamLabel(zone.CapturingTeamId, teamNameById);
        const leadingControl = Number(zone.LeadingControlPercentage ?? 0);
        const maxControlPoints = Number(zone.MaxControlPoints ?? 100);
        const progress = maxControlPoints > 0
            ? Math.min((leadingControl / maxControlPoints) * 1000, 1000)
            : 0;

        return {
            zone,
            zoneId,
            isCurrent,
            controllingTeamLabel,
            capturingTeamLabel,
            leadingControl,
            maxControlPoints,
            progress,
        };
    });

    const selectedZoneCharacters = selectedZoneSnapshot
        ? mapCharacters.filter((mapCharacter) => isCharacterInZone(mapCharacter, selectedZoneSnapshot.zoneId))
        : [];

    if (loading || !fontsLoaded) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#e94560" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ImageBackground source={MAP_BACKGROUND} style={styles.backgroundImage} imageStyle={styles.backgroundImageStyle}>
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
                        {errors.map && <Text style={styles.errorBanner}>{errors.map}</Text>}
                        {errors.characters && <Text style={styles.errorBanner}>{errors.characters}</Text>}
                    </ScrollView>

                    {!errors.map && zones.length > 0 && (
                        <View style={styles.zonePinsLayer} pointerEvents="box-none">
                            {zoneSnapshots.map((snapshot, index) => {
                                const pinLayout = getZonePinLayout(index);

                                return (
                                    <View key={snapshot.zoneId} style={[styles.zonePin, pinLayout]} pointerEvents="box-none">
                                        <Pressable
                                            style={[styles.zonePinLabel, snapshot.isCurrent && styles.zonePinLabelCurrent]}
                                            onPress={() => setSelectedZoneSnapshot(snapshot)}
                                        >
                                            <Text style={styles.zonePinName} numberOfLines={1}>
                                                {snapshot.zone.Name ?? 'Unnamed Zone'}{snapshot.isCurrent ? ' (you)' : ''}
                                            </Text>
                                            <Text style={styles.zonePinStatus} numberOfLines={1}>
                                                {snapshot.zone.ControllingTeamId
                                                    ? `Held: ${snapshot.controllingTeamLabel}`
                                                    : snapshot.zone.CapturingTeamId
                                                        ? `Capturing: ${snapshot.capturingTeamLabel}`
                                                        : 'Neutral'}
                                            </Text>
                                            <View style={styles.zonePinProgressTrack}>
                                                <View style={[styles.zonePinProgressFill, { width: `${snapshot.progress}%` }]} />
                                            </View>
                                            <Text style={styles.zonePinMeta}>
                                                {snapshot.zone.IsContested ? 'Contested' : 'Clear'} | {snapshot.leadingControl.toFixed(0)} / {snapshot.maxControlPoints}
                                            </Text>
                                        </Pressable>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <View style={styles.mapActionContainer} pointerEvents="box-none">
                        <Pressable
                            style={styles.mapActionButton}
                            onPress={() => setIsCharacterOverlayVisible(true)}
                        >
                            <Text style={styles.mapActionButtonText}>Your Character</Text>
                        </Pressable>
                    </View>
            </ImageBackground>

            <Modal
                visible={isCharacterOverlayVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsCharacterOverlayVisible(false)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setIsCharacterOverlayVisible(false)}>
                    <Pressable style={styles.modalCard} onPress={() => { }}>
                        <Text style={styles.modalTitle}>Your Character</Text>
                        <InfoRow label="Name" value={character.CharacterName || character.CharacterId} />
                        <InfoRow label="Team" value={character.TeamName || formatTeamLabel(character.TeamId, teamNameById)} />
                        <InfoRow label="Power" value={character.Power} />
                        <InfoRow label="Experience" value={character.Experience} />
                        <InfoRow label="Zone" value={zones.find(z => z.Id === character.CurrentZone)?.Name ?? character.CurrentZone} />
                        <Pressable
                            style={styles.stepButton}
                            onPress={() => {
                                setIsCharacterOverlayVisible(false);
                                setIsStepOverlayVisible(true);
                            }}
                        >
                            <Text style={styles.stepButtonText}>Open Step Overlay</Text>
                        </Pressable>
                        <Pressable style={styles.modalCloseButton} onPress={() => setIsCharacterOverlayVisible(false)}>
                            <Text style={styles.modalCloseText}>Close</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal
                visible={isStepOverlayVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsStepOverlayVisible(false)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setIsStepOverlayVisible(false)}>
                    <Pressable style={styles.modalCard} onPress={() => { }}>
                        <Text style={styles.modalTitle}>Step Submission</Text>
                        <Text style={styles.modalSubtitle}>
                            Ready to submit your latest step count for this character?
                        </Text>

                        <Pressable
                            style={styles.stepSubmitActionButton}
                            onPress={() => {
                                setIsStepOverlayVisible(false);
                                navigation.navigate('StepCount', { character });
                            }}
                        >
                            <Text style={styles.stepSubmitActionText}>Submit Steps</Text>
                        </Pressable>

                        <Pressable style={styles.modalCloseButton} onPress={() => setIsStepOverlayVisible(false)}>
                            <Text style={styles.modalCloseText}>Cancel</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal
                visible={!!selectedZoneSnapshot}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedZoneSnapshot(null)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setSelectedZoneSnapshot(null)}>
                    <Pressable style={styles.zoneModalCard} onPress={() => { }}>
                        <Text style={styles.modalSubtitle}>
                            Characters in zone: {selectedZoneCharacters.length}
                        </Text>

                        <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
                            {selectedZoneCharacters.length === 0 && (
                                <Text style={styles.empty}>No characters currently in this zone.</Text>
                            )}
                            {selectedZoneCharacters.map((c) => {
                                const isSelf = c.CharacterId === character.CharacterId;
                                return (
                                    <View key={c.CharacterId} style={[styles.row, isSelf && styles.rowHighlight]}>
                                        <Text
                                            style={[styles.rowText, isSelf && styles.rowTextHighlight]}
                                            numberOfLines={1}
                                            ellipsizeMode="middle"
                                        >
                                            {isSelf ? '★ ' : ''}{c.CharacterName || c.CharacterId}
                                        </Text>
                                        <Text style={styles.rowSub}>{c.TeamName || formatTeamLabel(c.TeamId, teamNameById)} | Power {formatPowerValue(c.Power)}</Text>
                                    </View>
                                );
                            })}
                        </ScrollView>

                        <Pressable style={styles.modalCloseButton} onPress={() => setSelectedZoneSnapshot(null)}>
                            <Text style={styles.modalCloseText}>Close</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

function formatTeamLabel(teamId, teamNameById = null) {
    if (!teamId || typeof teamId !== 'string') {
        return 'None';
    }

    if (teamNameById && teamNameById[teamId]) {
        return teamNameById[teamId];
    }

    return `Team ${teamId.slice(0, 8)}`;
}

function buildTeamNameLookup(characters) {
    const lookup = {};
    for (const character of characters ?? []) {
        const teamId = character?.TeamId;
        const teamName = character?.TeamName;
        if (typeof teamId === 'string' && teamId.length > 0 && typeof teamName === 'string' && teamName.trim().length > 0) {
            lookup[teamId] = teamName.trim();
        }
    }

    return lookup;
}

function getZonePinLayout(index) {
    return ZONE_PIN_LAYOUTS[index % ZONE_PIN_LAYOUTS.length];
}

function isCharacterInZone(mapCharacter, zoneId) {
    const characterZoneId = mapCharacter?.CurrentZone
        ?? mapCharacter?.currentZone
        ?? mapCharacter?.ZoneId
        ?? mapCharacter?.zoneId;

    return String(characterZoneId) === String(zoneId);
}

function formatPowerValue(power) {
    const numericPower = Number(power);
    if (!Number.isFinite(numericPower)) return '0';
    return numericPower.toFixed(0);
}

function compareZonesForStablePins(zoneA, zoneB) {
    const nameA = String(zoneA?.Name ?? '').toLowerCase();
    const nameB = String(zoneB?.Name ?? '').toLowerCase();
    const nameComparison = nameA.localeCompare(nameB);
    if (nameComparison !== 0) return nameComparison;

    const idA = String(zoneA?.ZoneId ?? zoneA?.Id ?? '');
    const idB = String(zoneB?.ZoneId ?? zoneB?.Id ?? '');
    return idA.localeCompare(idB);
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
    backgroundImage: {
        flex: 1,
    },
    backgroundImageStyle: {
        resizeMode: 'cover',
    },

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
    toastText: { color: '#e0e0e0', fontSize: 14, fontWeight: '600', fontFamily: MODULE_FONT_FAMILY },
    socketBadge: { color: '#8ea3c7', fontSize: 11 },
    socketBadgeLive: { color: '#86efac' },
    scroll: { padding: 16 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 16 },
    back: { color: '#e94560', fontSize: 16, fontFamily: MODULE_FONT_FAMILY },
    title: { fontSize: 22, fontWeight: 'bold', color: '#e0e0e0', flex: 1, fontFamily: MODULE_FONT_FAMILY },
    winnerBanner: {
        backgroundColor: '#203a2d',
        borderRadius: 0,
        borderWidth: 2,
        borderColor: '#f5c518',
        padding: 14,
        marginBottom: 14,
    },
    winnerLabel: { color: '#95d5b2', fontSize: 12, textTransform: 'uppercase', marginBottom: 4, fontFamily: MODULE_FONT_FAMILY },
    winnerValue: { color: '#d8f3dc', fontSize: 18, fontWeight: 'bold', fontFamily: MODULE_FONT_FAMILY },
    section: {
        backgroundColor: '#16213e',
        borderRadius: 0,
        padding: 14,
        marginBottom: 14,
        borderWidth: 2,
        borderColor: '#f5c518',
    },
    sectionTitle: { color: '#e94560', fontWeight: 'bold', fontSize: 15, marginBottom: 10, fontFamily: MODULE_FONT_FAMILY },
    errorBanner: {
        color: '#ffd8df',
        backgroundColor: 'rgba(233, 69, 96, 0.28)',
        borderWidth: 2,
        borderColor: '#f5c518',
        borderRadius: 0,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 10,
        fontFamily: MODULE_FONT_FAMILY,
    },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    infoLabel: { color: '#a0a0c0', fontSize: 14, fontFamily: MODULE_FONT_FAMILY },
    infoValue: { color: '#e0e0e0', fontSize: 14, flex: 1, textAlign: 'right', marginLeft: 8, fontFamily: MODULE_FONT_FAMILY },
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
    rowText: { color: '#e0e0e0', fontSize: 14, flex: 1, fontFamily: MODULE_FONT_FAMILY },
    rowTextHighlight: { color: '#e94560', fontWeight: 'bold', fontFamily: MODULE_FONT_FAMILY },
    rowSub: { color: '#a0a0c0', fontSize: 12, marginLeft: 8, fontFamily: MODULE_FONT_FAMILY },
    zonePinsLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 5,
    },
    mapActionContainer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9,
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingBottom: 18,
    },
    mapActionButton: {
        backgroundColor: '#1a5c1a',
        borderWidth: 2,
        borderColor: '#f5c518',
        borderRadius: 0,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    mapActionButtonText: {
        color: '#ffd8df',
        fontSize: 13,
        fontWeight: '600',
        fontFamily: MODULE_FONT_FAMILY,
    },
    zonePin: {
        position: 'absolute',
        width: 130,
    },
    zonePinDot: {
        width: 10,
        height: 10,
        borderRadius: 0,
        backgroundColor: '#95d5b2',
        borderWidth: 1,
        borderColor: '#f5c518',
        marginBottom: 4,
        marginLeft: 2,
    },
    zonePinDotCurrent: {
        backgroundColor: '#e94560',
        borderColor: '#ffd8df',
    },
    zonePinLabel: {
        backgroundColor: 'rgba(88, 52, 132, 0.9)',
        borderWidth: 1,
        borderColor: '#facc15',
        borderRadius: 0,
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    zonePinLabelCurrent: {
        backgroundColor: '#1a5c1a',
        borderColor: '#fde047',
    },
    zonePinName: {
        color: '#f0f4ff',
        fontSize: 12,
        fontFamily: MODULE_FONT_FAMILY,
    },
    zonePinStatus: {
        color: '#95d5b2',
        fontSize: 11,
        marginTop: 2,
        fontFamily: MODULE_FONT_FAMILY,
    },
    zonePinProgressTrack: {
        height: 6,
        backgroundColor: '#0f3460',
        borderRadius: 999,
        marginTop: 6,
        overflow: 'hidden',
    },
    zonePinProgressFill: {
        height: '100%',
        backgroundColor: '#e94560',
        borderRadius: 999,
    },
    zonePinMeta: {
        color: '#8ea3c7',
        fontSize: 10,
        marginTop: 4,
        fontFamily: MODULE_FONT_FAMILY,
    },
    stepButton: {
        backgroundColor: '#0f3460',
        borderRadius: 8,
        padding: 10,
        alignItems: 'center',
        marginTop: 10,
    },
    stepButtonText: { color: '#e0e0e0', fontWeight: 'bold', fontFamily: MODULE_FONT_FAMILY },
    error: { color: '#e94560', fontSize: 13, marginBottom: 6, fontFamily: MODULE_FONT_FAMILY },
    empty: { color: '#a0a0c0', fontSize: 13, fontFamily: MODULE_FONT_FAMILY },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(2, 8, 20, 0.72)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 18,
    },
    modalCard: {
        width: '100%',
        maxWidth: 420,
        maxHeight: '78%',
        backgroundColor: '#16213e',
        borderRadius: 0,
        borderWidth: 2,
        borderColor: '#f5c518',
        padding: 14,
    },
    zoneModalCard: {
        width: '100%',
        maxWidth: 420,
        maxHeight: '78%',
        backgroundColor: '#3b1f5e',
        borderRadius: 0,
        borderWidth: 2,
        borderColor: '#f5c518',
        padding: 14,
    },
    modalTitle: {
        color: '#f0f4ff',
        fontSize: 18,
        fontWeight: '600',
        fontFamily: MODULE_FONT_FAMILY,
    },
    modalSubtitle: {
        color: '#8ea3c7',
        fontSize: 13,
        marginTop: 4,
        marginBottom: 10,
        fontFamily: MODULE_FONT_FAMILY,
    },
    modalList: {
        flexGrow: 0,
    },
    modalListContent: {
        paddingBottom: 8,
    },
    modalCloseButton: {
        marginTop: 12,
        backgroundColor: '#0f3460',
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
    },
    modalCloseText: {
        color: '#e0e0e0',
        fontWeight: '600',
        fontFamily: MODULE_FONT_FAMILY,
    },
    stepSubmitActionButton: {
        marginTop: 4,
        backgroundColor: '#e94560',
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
    },
    stepSubmitActionText: {
        color: '#ffffff',
        fontWeight: '600',
        fontFamily: MODULE_FONT_FAMILY,
    },
});
