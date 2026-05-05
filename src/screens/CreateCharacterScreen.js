import React, { useEffect, useState } from 'react';
import {
    SafeAreaView,
    ScrollView,
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import * as api from '../api';

export default function CreateCharacterScreen({ navigation }) {
    const [characterName, setCharacterName] = useState('');
    const [teams, setTeams] = useState([]);
    const [maps, setMaps] = useState([]);
    const [zones, setZones] = useState([]);

    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [selectedMapId, setSelectedMapId] = useState('');
    const [selectedZoneId, setSelectedZoneId] = useState('');

    const [loading, setLoading] = useState(true);
    const [loadingZones, setLoadingZones] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function loadInitialData() {
            try {
                const [teamData, mapData] = await Promise.all([
                    api.getAllTeams(),
                    api.getAllMaps(),
                ]);

                const loadedTeams = Array.isArray(teamData) ? teamData : [];
                const loadedMaps = Array.isArray(mapData) ? mapData : [];

                setTeams(loadedTeams);
                setMaps(loadedMaps);

                if (loadedTeams.length > 0) {
                    setSelectedTeamId(loadedTeams[0].Id);
                }

                if (loadedMaps.length > 0) {
                    setSelectedMapId(loadedMaps[0].MapId);
                }
            } catch (e) {
                setError(e.message || 'Failed to load create-character data.');
            } finally {
                setLoading(false);
            }
        }

        loadInitialData();
    }, []);

    useEffect(() => {
        async function loadZones() {
            if (!selectedMapId) {
                setZones([]);
                setSelectedZoneId('');
                return;
            }

            setLoadingZones(true);
            setSelectedZoneId('');
            try {
                const zoneData = await api.getZonesByMap(selectedMapId);
                const loadedZones = Array.isArray(zoneData) ? zoneData : [];
                setZones(loadedZones);
                if (loadedZones.length > 0) {
                    setSelectedZoneId(loadedZones[0].Id);
                }
            } catch (e) {
                setError(e.message || 'Failed to load zones for selected map.');
            } finally {
                setLoadingZones(false);
            }
        }

        loadZones();
    }, [selectedMapId]);

    async function handleCreateCharacter() {
        if (!selectedTeamId || !selectedMapId || !selectedZoneId) {
            setError('Pick a team, map, and zone before creating your character.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await api.createCharacter(
                characterName.trim(),
                selectedTeamId,
                selectedZoneId,
                selectedMapId
            );
            navigation.navigate('SelectCharacter', { refreshKey: Date.now() });
        } catch (e) {
            setError(e.message || 'Failed to create character.');
        } finally {
            setSubmitting(false);
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
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Create Character</Text>

                {error && <Text style={styles.error}>{error}</Text>}

                <Text style={styles.label}>Character Name (optional)</Text>
                <TextInput
                    value={characterName}
                    onChangeText={setCharacterName}
                    placeholder="Enter a character name"
                    placeholderTextColor="#6f7390"
                    style={styles.input}
                    maxLength={50}
                />

                <Text style={styles.label}>Team</Text>
                <View style={styles.optionGrid}>
                    {teams.map((team) => (
                        <Pressable
                            key={team.Id}
                            style={[
                                styles.optionButton,
                                selectedTeamId === team.Id && styles.optionButtonActive,
                            ]}
                            onPress={() => setSelectedTeamId(team.Id)}
                        >
                            <Text
                                style={[
                                    styles.optionText,
                                    selectedTeamId === team.Id && styles.optionTextActive,
                                ]}
                                numberOfLines={1}
                            >
                                {team.Name || team.Id}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <Text style={styles.label}>Map</Text>
                <View style={styles.optionGrid}>
                    {maps.map((map) => (
                        <Pressable
                            key={map.MapId}
                            style={[
                                styles.optionButton,
                                selectedMapId === map.MapId && styles.optionButtonActive,
                            ]}
                            onPress={() => setSelectedMapId(map.MapId)}
                        >
                            <Text
                                style={[
                                    styles.optionText,
                                    selectedMapId === map.MapId && styles.optionTextActive,
                                ]}
                                numberOfLines={1}
                            >
                                {map.Name || map.MapId}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <Text style={styles.label}>Starting Zone</Text>
                {loadingZones ? (
                    <ActivityIndicator size="small" color="#e94560" style={styles.zoneLoader} />
                ) : (
                    <View style={styles.optionGrid}>
                        {zones.map((zone) => (
                            <Pressable
                                key={zone.Id}
                                style={[
                                    styles.optionButton,
                                    selectedZoneId === zone.Id && styles.optionButtonActive,
                                ]}
                                onPress={() => setSelectedZoneId(zone.Id)}
                            >
                                <Text
                                    style={[
                                        styles.optionText,
                                        selectedZoneId === zone.Id && styles.optionTextActive,
                                    ]}
                                    numberOfLines={1}
                                >
                                    {zone.Name || zone.Id}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}

                <View style={styles.buttonRow}>
                    <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={() => navigation.goBack()}>
                        <Text style={styles.actionButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.actionButton, styles.submitButton, submitting && styles.buttonDisabled]}
                        onPress={handleCreateCharacter}
                        disabled={submitting}
                    >
                        <Text style={styles.actionButtonText}>{submitting ? 'Creating...' : 'Create'}</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a2e',
    },
    centered: {
        flex: 1,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 16,
        paddingBottom: 32,
    },
    title: {
        color: '#e0e0e0',
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 16,
        textAlign: 'center',
    },
    label: {
        color: '#a0a0c0',
        fontSize: 14,
        marginBottom: 8,
        marginTop: 10,
    },
    input: {
        backgroundColor: '#16213e',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#0f3460',
        color: '#e0e0e0',
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
    },
    optionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    optionButton: {
        backgroundColor: '#16213e',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#0f3460',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 6,
        minWidth: '48%',
    },
    optionButtonActive: {
        borderColor: '#e94560',
        backgroundColor: '#2b1732',
    },
    optionText: {
        color: '#e0e0e0',
        fontSize: 14,
        fontWeight: '600',
    },
    optionTextActive: {
        color: '#ffb3c1',
    },
    zoneLoader: {
        marginTop: 4,
        marginBottom: 8,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 18,
    },
    actionButton: {
        flex: 1,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#0f3460',
        marginRight: 8,
    },
    submitButton: {
        backgroundColor: '#e94560',
        marginLeft: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    actionButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    error: {
        color: '#ff667f',
        marginBottom: 6,
        textAlign: 'center',
    },
});
