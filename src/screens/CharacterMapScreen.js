import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const TOAST_DURATION_MS = 5000;
const NEUTRALIZE_ANIMATION_MS = 700;
const CAPTURE_ANIMATION_MS = 700;
const NEUTRAL_HOLD_MS = 140;
const ANIMATION_FRAME_MS = 33;
const MAP_BACKGROUND = require('../../assets/testmap.png');
const MODULE_FONT_FAMILY = 'alagard';
const ZONE_PIN_LAYOUTS = [
    { left: '10%', top: '14%' },
    { left: '38%', top: '10%' },
    { left: '68%', top: '16%' },
    { left: '16%', top: '36%' },
    { left: '48%', top: '34%' },
    { left: '74%', top: '44%' },
    { left: '8%', top: '62%' },
    { left: '36%', top: '66%' },
    { left: '66%', top: '70%' },
    { left: '22%', top: '82%' },
    { left: '54%', top: '84%' },
    { left: '78%', top: '86%' },
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
    const [selectedZoneSnapshot, setSelectedZoneSnapshot] = useState(null);
    const [isZoneSelectorVisible, setIsZoneSelectorVisible] = useState(false);
    const [isZoneSwitching, setIsZoneSwitching] = useState(false);
    const [zoneDisplayProgressById, setZoneDisplayProgressById] = useState({});
    const [zoneProgressTrendById, setZoneProgressTrendById] = useState({});
    const [zoneStatusOverrideById, setZoneStatusOverrideById] = useState({});
    const toastTimersRef = useRef({});
    const zoneAnimationIntervalsRef = useRef({});
    const zoneNeutralHoldTimersRef = useRef({});
    const zoneAnimatingRef = useRef({});
    const zonePendingSnapshotRef = useRef({});
    const zonePreviousSnapshotRef = useRef({});
    const zoneDisplayProgressRef = useRef({});
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
        zoneDisplayProgressRef.current = zoneDisplayProgressById;
    }, [zoneDisplayProgressById]);

    useEffect(() => {
        const intervals = zoneAnimationIntervalsRef.current;
        const holdTimers = zoneNeutralHoldTimersRef.current;
        return () => {
            Object.values(intervals).forEach(clearInterval);
            Object.values(holdTimers).forEach(clearTimeout);
        };
    }, []);

    useEffect(() => {
        teamNameLookupRef.current = buildTeamNameLookup(mapCharacters);
    }, [mapCharacters]);

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
    }, [fetchAll]);

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
                    // All map/zone/control updates are now handled via WebSocket
                    if (message?.Map) setMapData(message.Map);

                    if (message?.Type === 'characterUpdated' && message?.Character) {
                        const updatedChar = message.Character;

                        setMapCharacters((prev) => {
                            const existingIndex = prev.findIndex((c) => c?.CharacterId === updatedChar?.CharacterId);
                            if (existingIndex === -1) {
                                return [...prev, updatedChar];
                            }

                            const next = [...prev];
                            next[existingIndex] = { ...next[existingIndex], ...updatedChar };
                            return next;
                        });

                        if (updatedChar.CharacterId === character.CharacterId) {
                            character.Power = updatedChar.Power;
                            character.CurrentZone = updatedChar.CurrentZone;
                            character.CurrentMap = updatedChar.CurrentMap;
                            character.Experience = updatedChar.Experience;
                        }
                    }

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
    const teamNameById = useMemo(() => buildTeamNameLookup(mapCharacters), [mapCharacters]);
    const stableZones = useMemo(() => [...zones].sort((a, b) => compareZonesForStablePins(a, b)), [zones]);
    const winningTeamLabel = formatTeamLabel(mapData?.WinningTeamId, teamNameById);
    const zoneSnapshots = useMemo(() => stableZones.map((zone) => {
        const zoneId = zone.ZoneId ?? zone.Id;
        const isCurrent = zoneId === character.CurrentZone;
        const controllingTeamLabel = formatTeamLabel(zone.ControllingTeamId, teamNameById);
        const capturingTeamLabel = formatTeamLabel(zone.CapturingTeamId, teamNameById);
        const leadingControlRaw = Number(zone.LeadingControlPercentage ?? 0);
        const maxControlPoints = Number(zone.MaxControlPoints ?? 100);
        const normalizedLeadingControl = Number.isFinite(leadingControlRaw)
            ? Math.max(0, Math.min(leadingControlRaw, 100))
            : 0;
        const leadingControl = normalizedLeadingControl;
        const progress = normalizedLeadingControl;

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
    }), [stableZones, character.CurrentZone, teamNameById]);

    const animateZoneProgress = useCallback((zoneKey, from, to, durationMs, onComplete) => {
        const currentIntervals = zoneAnimationIntervalsRef.current;
        if (currentIntervals[zoneKey]) {
            clearInterval(currentIntervals[zoneKey]);
            delete currentIntervals[zoneKey];
        }

        if (!Number.isFinite(from) || !Number.isFinite(to) || durationMs <= 0 || Math.abs(to - from) < 0.01) {
            setZoneProgressTrendById((prev) => {
                const trend = to > from ? 'increasing' : to < from ? 'decreasing' : 'steady';
                if (prev[zoneKey] === trend) return prev;
                return { ...prev, [zoneKey]: trend };
            });

            setZoneDisplayProgressById((prev) => {
                if (prev[zoneKey] === to) return prev;
                return { ...prev, [zoneKey]: to };
            });

            if (onComplete) onComplete();
            return;
        }

        const start = Date.now();
        const totalDelta = to - from;
        setZoneProgressTrendById((prev) => {
            const trend = to > from ? 'increasing' : 'decreasing';
            if (prev[zoneKey] === trend) return prev;
            return { ...prev, [zoneKey]: trend };
        });

        const intervalId = setInterval(() => {
            const elapsed = Date.now() - start;
            const t = Math.min(elapsed / durationMs, 1);
            const nextValue = Math.max(0, Math.min(100, from + totalDelta * t));

            setZoneDisplayProgressById((prev) => {
                if (prev[zoneKey] === nextValue) return prev;
                return { ...prev, [zoneKey]: nextValue };
            });

            if (t >= 1) {
                clearInterval(intervalId);
                delete zoneAnimationIntervalsRef.current[zoneKey];
                if (onComplete) onComplete();
            }
        }, ANIMATION_FRAME_MS);

        zoneAnimationIntervalsRef.current[zoneKey] = intervalId;
    }, []);

    useEffect(() => {
        const activeZoneIds = new Set(zoneSnapshots.map((snapshot) => String(snapshot.zoneId)));

        for (const key of Object.keys(zoneDisplayProgressRef.current)) {
            if (!activeZoneIds.has(key)) {
                if (zoneAnimationIntervalsRef.current[key]) {
                    clearInterval(zoneAnimationIntervalsRef.current[key]);
                    delete zoneAnimationIntervalsRef.current[key];
                }

                if (zoneNeutralHoldTimersRef.current[key]) {
                    clearTimeout(zoneNeutralHoldTimersRef.current[key]);
                    delete zoneNeutralHoldTimersRef.current[key];
                }

                delete zoneAnimatingRef.current[key];
                delete zonePendingSnapshotRef.current[key];
                delete zonePreviousSnapshotRef.current[key];

                setZoneDisplayProgressById((prev) => {
                    if (!(key in prev)) return prev;
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });

                setZoneProgressTrendById((prev) => {
                    if (!(key in prev)) return prev;
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });

                setZoneStatusOverrideById((prev) => {
                    if (!(key in prev)) return prev;
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
            }
        }

        for (const snapshot of zoneSnapshots) {
            const zoneKey = String(snapshot.zoneId);
            const currentOwnerTeamId = snapshot.zone.ControllingTeamId ?? null;
            const previousSnapshot = zonePreviousSnapshotRef.current[zoneKey] ?? null;

            if (zoneAnimatingRef.current[zoneKey]) {
                zonePendingSnapshotRef.current[zoneKey] = snapshot;
                zonePreviousSnapshotRef.current[zoneKey] = {
                    ownerTeamId: currentOwnerTeamId,
                    progress: snapshot.progress,
                };
                continue;
            }

            const hasDirectOwnerFlip = Boolean(
                previousSnapshot?.ownerTeamId
                && currentOwnerTeamId
                && previousSnapshot.ownerTeamId !== currentOwnerTeamId
            );

            if (hasDirectOwnerFlip) {
                const startProgress = Number(zoneDisplayProgressRef.current[zoneKey] ?? previousSnapshot.progress ?? 100);
                const takeoverTeamId = snapshot.zone.CapturingTeamId ?? currentOwnerTeamId;

                zoneAnimatingRef.current[zoneKey] = true;
                zonePendingSnapshotRef.current[zoneKey] = snapshot;

                setZoneStatusOverrideById((prev) => ({
                    ...prev,
                    [zoneKey]: { phase: 'neutralizing', teamId: takeoverTeamId },
                }));

                animateZoneProgress(zoneKey, startProgress, 0, NEUTRALIZE_ANIMATION_MS, () => {
                    setZoneStatusOverrideById((prev) => ({
                        ...prev,
                        [zoneKey]: { phase: 'neutral', teamId: null },
                    }));

                    if (zoneNeutralHoldTimersRef.current[zoneKey]) {
                        clearTimeout(zoneNeutralHoldTimersRef.current[zoneKey]);
                    }

                    zoneNeutralHoldTimersRef.current[zoneKey] = setTimeout(() => {
                        const latestSnapshot = zonePendingSnapshotRef.current[zoneKey] ?? snapshot;
                        const captureTeamId = latestSnapshot.zone.CapturingTeamId ?? latestSnapshot.zone.ControllingTeamId ?? takeoverTeamId;
                        const captureTarget = Number(latestSnapshot.progress ?? 0);

                        setZoneStatusOverrideById((prev) => ({
                            ...prev,
                            [zoneKey]: { phase: 'capturing', teamId: captureTeamId },
                        }));

                        animateZoneProgress(zoneKey, 0, captureTarget, CAPTURE_ANIMATION_MS, () => {
                            zoneAnimatingRef.current[zoneKey] = false;
                            delete zonePendingSnapshotRef.current[zoneKey];

                            setZoneStatusOverrideById((prev) => {
                                if (!(zoneKey in prev)) return prev;
                                const next = { ...prev };
                                delete next[zoneKey];
                                return next;
                            });

                            setZoneDisplayProgressById((prev) => {
                                if (prev[zoneKey] === captureTarget) return prev;
                                return { ...prev, [zoneKey]: captureTarget };
                            });

                            setZoneProgressTrendById((prev) => ({ ...prev, [zoneKey]: 'steady' }));
                        });

                        delete zoneNeutralHoldTimersRef.current[zoneKey];
                    }, NEUTRAL_HOLD_MS);
                });
            } else {
                const previousDisplayedProgress = Number(zoneDisplayProgressRef.current[zoneKey] ?? snapshot.progress);
                const nextTrend = snapshot.progress > previousDisplayedProgress
                    ? 'increasing'
                    : snapshot.progress < previousDisplayedProgress
                        ? 'decreasing'
                        : 'steady';

                setZoneProgressTrendById((prev) => {
                    if (prev[zoneKey] === nextTrend) return prev;
                    return { ...prev, [zoneKey]: nextTrend };
                });

                setZoneDisplayProgressById((prev) => {
                    if (prev[zoneKey] === snapshot.progress) return prev;
                    return { ...prev, [zoneKey]: snapshot.progress };
                });

                setZoneStatusOverrideById((prev) => {
                    if (!(zoneKey in prev)) return prev;
                    const next = { ...prev };
                    delete next[zoneKey];
                    return next;
                });
            }

            zonePreviousSnapshotRef.current[zoneKey] = {
                ownerTeamId: currentOwnerTeamId,
                progress: snapshot.progress,
            };
        }
    }, [animateZoneProgress, zoneSnapshots]);

    const selectedZoneCharacters = selectedZoneSnapshot
        ? mapCharacters.filter((mapCharacter) => isCharacterInZone(mapCharacter, selectedZoneSnapshot.zoneId))
        : [];

    const handleSwitchZone = useCallback(async (zoneId) => {
        setIsZoneSwitching(true);
        try {
            await api.changeCharacterZone(character.CharacterId, zoneId);
            // Update the character's zone in memory to reflect the change immediately
            character.CurrentZone = zoneId;
            const zone = zones.find(z => (z.ZoneId ?? z.Id) === zoneId);
            const zoneName = zone?.Name ?? 'Unknown Zone';
            addToast(`zone-switch-${zoneId}`, 'capture', `Switched to ${zoneName}`);
            setIsZoneSelectorVisible(false);
            // Refresh map data after zone switch to get updated character list for zones
            const data = await api.getMap(mapId);
            setMapData(data ?? null);
            // Force re-render by triggering state update
            setMapData((prev) => (prev ? { ...prev } : null));
        } catch (e) {
            addToast(`zone-switch-error-${Date.now()}`, 'error', e.message || 'Failed to switch zone.');
        } finally {
            setIsZoneSwitching(false);
        }
    }, [character.CharacterId, mapId, zones, addToast]);

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
                                        toast.type === 'win' 
                                            ? styles.toastWin 
                                            : toast.type === 'error'
                                                ? styles.toastError
                                                : styles.toastCapture,
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
                                const zoneKey = String(snapshot.zoneId);
                                const override = zoneStatusOverrideById[zoneKey];
                                const isNeutralizingPhase = override?.phase === 'neutralizing' || snapshot.zone.IsNeutralizing;
                                const isNeutralPhase = override?.phase === 'neutral';

                                const barFillStyle = isNeutralizingPhase
                                    ? styles.zonePinProgressFillNeutralizing
                                    : isNeutralPhase
                                        ? styles.zonePinProgressFillNeutral
                                        : styles.zonePinProgressFillSteady;

                                const barWidth = isNeutralizingPhase || isNeutralPhase
                                    ? '100%'
                                    : `${zoneDisplayProgressById[zoneKey] ?? snapshot.progress}%`;

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
                                                {formatZoneStatusText(
                                                    snapshot,
                                                    zoneStatusOverrideById[String(snapshot.zoneId)],
                                                    teamNameById,
                                                )}
                                            </Text>
                                            <View style={styles.zonePinProgressTrack}>
                                                <View
                                                    style={[
                                                        styles.zonePinProgressFill,
                                                        barFillStyle,
                                                        { width: barWidth },
                                                    ]}
                                                />
                                            </View>
                                            <Text style={styles.zonePinMeta}>
                                                {snapshot.zone.IsContested ? 'Contested' : 'Clear'} | {snapshot.leadingControl.toFixed(1)}%
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
                            style={styles.zoneActionButton}
                            onPress={() => {
                                setIsCharacterOverlayVisible(false);
                                setIsZoneSelectorVisible(true);
                            }}
                        >
                            <Text style={styles.zoneActionButtonText}>Switch Zone</Text>
                        </Pressable>
                        <Pressable style={styles.modalCloseButton} onPress={() => setIsCharacterOverlayVisible(false)}>
                            <Text style={styles.modalCloseText}>Close</Text>
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

            <Modal
                visible={isZoneSelectorVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsZoneSelectorVisible(false)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setIsZoneSelectorVisible(false)}>
                    <Pressable style={styles.zoneModalCard} onPress={() => { }}>
                        <Text style={styles.modalSubtitle}>
                            Select Zone to Switch
                        </Text>

                        <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
                            {zones.length === 0 && (
                                <Text style={styles.empty}>No zones available.</Text>
                            )}
                            {zones.map((zone) => {
                                const isCurrentZone = (zone.ZoneId ?? zone.Id) === character.CurrentZone;
                                return (
                                    <Pressable
                                        key={zone.ZoneId ?? zone.Id}
                                        style={[styles.zoneSelectRow, isCurrentZone && styles.zoneSelectRowActive]}
                                        onPress={() => {
                                            if (!isCurrentZone && !isZoneSwitching) {
                                                handleSwitchZone(zone.ZoneId ?? zone.Id);
                                            }
                                        }}
                                        disabled={isCurrentZone || isZoneSwitching}
                                    >
                                        <Text
                                            style={[styles.zoneSelectRowText, isCurrentZone && styles.zoneSelectRowTextActive]}
                                            numberOfLines={1}
                                        >
                                            {zone.Name ?? 'Unnamed Zone'}{isCurrentZone ? ' (current)' : ''}
                                        </Text>
                                        {isZoneSwitching && (zone.ZoneId ?? zone.Id) === character.CurrentZone && (
                                            <ActivityIndicator size="small" color="#e94560" />
                                        )}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>

                        <Pressable style={styles.modalCloseButton} onPress={() => setIsZoneSelectorVisible(false)}>
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

function formatZoneStatusText(snapshot, override, teamNameById) {
    if (override?.phase === 'neutralizing') {
        return `Neutralizing: ${formatTeamLabel(override.teamId, teamNameById)}`;
    }

    if (override?.phase === 'capturing') {
        return `Capturing: ${formatTeamLabel(override.teamId, teamNameById)}`;
    }

    if (override?.phase === 'neutral') {
        return 'Neutral';
    }

    if (snapshot.zone.ControllingTeamId && snapshot.zone.CapturingTeamId && snapshot.zone.ControllingTeamId !== snapshot.zone.CapturingTeamId) {
        return `Neutralizing: ${snapshot.capturingTeamLabel}`;
    }

    if (snapshot.zone.ControllingTeamId) {
        return `Held: ${snapshot.controllingTeamLabel}`;
    }

    if (snapshot.zone.CapturingTeamId) {
        return `Capturing: ${snapshot.capturingTeamLabel}`;
    }

    return 'Neutral';
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
    toastError: {
        backgroundColor: '#3a1a1a',
        borderWidth: 1,
        borderColor: '#ff6b6b',
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
        borderRadius: 999,
    },
    zonePinProgressFillIncreasing: {
        backgroundColor: '#4ade80',
    },
    zonePinProgressFillDecreasing: {
        backgroundColor: '#f97316',
    },
    zonePinProgressFillNeutralizing: {
        backgroundColor: '#7c3aed',
    },
    zonePinProgressFillNeutral: {
        backgroundColor: '#9ca3af',
    },
    zonePinProgressFillSteady: {
        backgroundColor: '#e94560',
    },
    zonePinMeta: {
        color: '#8ea3c7',
        fontSize: 10,
        marginTop: 4,
        fontFamily: MODULE_FONT_FAMILY,
    },
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
    zoneActionButton: {
        marginTop: 8,
        marginBottom: 8,
        backgroundColor: '#1a5c1a',
        borderWidth: 2,
        borderColor: '#f5c518',
        borderRadius: 0,
        paddingVertical: 10,
        alignItems: 'center',
    },
    zoneActionButtonText: {
        color: '#d8f3dc',
        fontWeight: '600',
        fontFamily: MODULE_FONT_FAMILY,
    },
    zoneSelectRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#0f3460',
    },
    zoneSelectRowActive: {
        backgroundColor: '#1a3060',
        borderRadius: 6,
    },
    zoneSelectRowText: {
        color: '#e0e0e0',
        fontSize: 14,
        flex: 1,
        fontFamily: MODULE_FONT_FAMILY,
    },
    zoneSelectRowTextActive: {
        color: '#95d5b2',
        fontWeight: '600',
    },
});
