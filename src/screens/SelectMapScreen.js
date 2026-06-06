import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    SafeAreaView,
} from 'react-native';
import * as api from '../api';

export default function SelectMapScreen({ route, navigation }) {
    const { character } = route.params ?? {};
    const [maps, setMaps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMapId, setSelectedMapId] = useState(null);
    const [starting, setStarting] = useState(false);
    const [validationMessage, setValidationMessage] = useState('');

    useEffect(() => {
        let active = true;

        async function loadMaps() {
            setLoading(true);
            try {
                const data = await api.getTestMaps();
                const nextMaps = Array.isArray(data) ? data : [];
                if (!active) return;

                setMaps(nextMaps);
                setError(null);
                if (nextMaps.length > 0) {
                    const currentMapId = character?.CurrentMap;
                    const preferredMap = currentMapId
                        ? nextMaps.find((map) => map.MapId === currentMapId)
                        : null;
                    setSelectedMapId(preferredMap?.MapId ?? nextMaps[0].MapId);
                }
            } catch (e) {
                if (!active) return;
                setError(e.message || 'Failed to load test maps.');
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadMaps();
        return () => {
            active = false;
        };
    }, []);

    const selectedMap = useMemo(() => maps.find((m) => m.MapId === selectedMapId) || null, [maps, selectedMapId]);
    const selectedMapLocked = Boolean(selectedMap?.RosterLocked);
    const selectedMapIsCurrentCharacterMap = Boolean(character?.CurrentMap && selectedMapId === character.CurrentMap);

    async function handleStart() {
        if (!character?.CharacterId || !selectedMapId || starting || (selectedMapLocked && !selectedMapIsCurrentCharacterMap)) {
            return;
        }

        if (selectedMapIsCurrentCharacterMap) {
            navigation.navigate('CharacterMap', {
                character,
                mapId: selectedMapId,
            });
            return;
        }

        setStarting(true);
        setError(null);
        setValidationMessage('');

        try {
            if (character.CurrentMap !== selectedMapId) {
                await api.changeCharacterMap(character.CharacterId, selectedMapId);
            }

            const validation = await api.validateMapStart(selectedMapId);
            if (!validation?.CanStart) {
                setValidationMessage(validation?.Reason || 'Map cannot be started yet.');
                setStarting(false);
                return;
            }

            const startResult = await api.startMap(selectedMapId);
            if (!startResult?.Started) {
                setValidationMessage(startResult?.Message || 'Map cannot be started yet.');
                setStarting(false);
                return;
            }

            const nextCharacter = {
                ...character,
                CurrentMap: selectedMapId,
            };

            navigation.navigate('CharacterMap', {
                character: nextCharacter,
                mapId: selectedMapId,
            });
        } catch (e) {
            if (e?.code === 'MAP_ROSTER_LOCKED') {
                setError('This map is already in progress and roster-locked. Pick a different test map.');
            } else {
                const messageFromResponse = extractErrorMessage(e?.message);
                setError(messageFromResponse || 'Failed to start map.');
            }
        } finally {
            setStarting(false);
        }
    }

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#e94560" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.title}>Select Test Map</Text>
            <Text style={styles.subtitle}>Only test maps are available for map start.</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {validationMessage ? <Text style={styles.warning}>{validationMessage}</Text> : null}
            {selectedMapLocked && !selectedMapIsCurrentCharacterMap ? (
                <Text style={styles.warning}>Selected map is roster-locked and cannot accept new entries.</Text>
            ) : null}

            {!error && maps.length === 0 ? <Text style={styles.empty}>No test maps are available.</Text> : null}

            <FlatList
                data={maps}
                keyExtractor={(item) => item.MapId}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => {
                    const selected = item.MapId === selectedMapId;
                    return (
                        <Pressable
                            style={[styles.card, selected ? styles.cardSelected : null]}
                            onPress={() => setSelectedMapId(item.MapId)}
                        >
                            <Text style={styles.cardName}>{item.Name || 'Unnamed Map'}</Text>
                            <Text style={styles.cardMeta}>Map ID: {item.MapId}</Text>
                            {item.RosterLocked ? <Text style={styles.cardLocked}>Roster Locked</Text> : null}
                        </Pressable>
                    );
                }}
            />

            <Pressable
                style={[
                    styles.button,
                    (!selectedMap || starting || (selectedMapLocked && !selectedMapIsCurrentCharacterMap)) ? styles.buttonDisabled : null,
                ]}
                onPress={handleStart}
                disabled={!selectedMap || starting || (selectedMapLocked && !selectedMapIsCurrentCharacterMap)}
            >
                <Text style={styles.buttonText}>{starting ? 'Starting...' : 'Start Map'}</Text>
            </Pressable>
        </SafeAreaView>
    );
}

function extractErrorMessage(rawMessage) {
    if (!rawMessage || typeof rawMessage !== 'string') {
        return '';
    }

    try {
        const parsed = JSON.parse(rawMessage);
        if (parsed?.Message) {
            return parsed.Message;
        }
    } catch {
        // Not a JSON payload.
    }

    return rawMessage;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e', paddingHorizontal: 16 },
    centered: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
    title: {
        color: '#e0e0e0',
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        paddingTop: 24,
    },
    subtitle: {
        color: '#a0a0c0',
        fontSize: 14,
        textAlign: 'center',
        paddingTop: 8,
        paddingBottom: 12,
    },
    list: {
        paddingTop: 8,
        paddingBottom: 20,
    },
    card: {
        backgroundColor: '#16213e',
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#0f3460',
    },
    cardSelected: {
        borderColor: '#e94560',
        shadowColor: '#e94560',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    cardName: {
        color: '#f2f2f2',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    cardMeta: {
        color: '#a0a0c0',
        fontSize: 12,
    },
    cardLocked: {
        color: '#f6df87',
        fontSize: 12,
        marginTop: 6,
        fontWeight: '700',
    },
    button: {
        backgroundColor: '#e94560',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 16,
    },
    buttonDisabled: {
        opacity: 0.55,
    },
    buttonText: {
        color: '#ffffff',
        fontWeight: '700',
    },
    error: {
        color: '#ff7b7b',
        textAlign: 'center',
        paddingVertical: 8,
    },
    warning: {
        color: '#f6df87',
        textAlign: 'center',
        paddingVertical: 8,
    },
    empty: {
        color: '#a0a0c0',
        textAlign: 'center',
        paddingTop: 24,
    },
});
