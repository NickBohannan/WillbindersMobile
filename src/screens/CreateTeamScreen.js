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
    ImageBackground,
} from 'react-native';
import * as api from '../api';
import { useAlagardFont, MODULE_FONT_FAMILY } from '../hooks/useAlagardFont';

const MENU_BACKGROUND = require('../../assets/menu-background2.png');

export default function CreateTeamScreen({ navigation }) {
    const [fontsLoaded] = useAlagardFont();
    const [teamName, setTeamName] = useState('');
    const [characterName, setCharacterName] = useState('');
    const [maps, setMaps] = useState([]);
    const [zones, setZones] = useState([]);
    const [selectedMapId, setSelectedMapId] = useState('');
    const [selectedZoneId, setSelectedZoneId] = useState('');
    const [loadingSetup, setLoadingSetup] = useState(true);
    const [loadingZones, setLoadingZones] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState('');
    const [createdTeam, setCreatedTeam] = useState(null);

    useEffect(() => {
        async function loadInitialData() {
            try {
                const mapData = await api.getAllMaps();
                const loadedMaps = Array.isArray(mapData) ? mapData : [];

                setMaps(loadedMaps);
                if (loadedMaps.length > 0) {
                    setSelectedMapId(loadedMaps[0].MapId);
                }
            } catch (e) {
                setError(e.message || 'Failed to load maps.');
            } finally {
                setLoadingSetup(false);
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

    async function handleCreateTeamAndCharacter() {
        const trimmedName = teamName.trim();
        if (!createdTeam && !trimmedName) {
            setError('Team name is required.');
            return;
        }

        if (!selectedMapId || !selectedZoneId) {
            setError('Pick a map and zone before creating your team character.');
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccess('');
        let teamForSubmission = createdTeam;

        try {
            if (!teamForSubmission?.TeamId) {
                teamForSubmission = await api.createTeam(trimmedName);
                setCreatedTeam(teamForSubmission);
            }

            if (!teamForSubmission?.TeamId) {
                throw new Error('Team was created but no team ID was returned.');
            }

            await api.createCharacter(characterName.trim(), teamForSubmission.TeamId, selectedZoneId, selectedMapId);
            setSuccess('Team and character created successfully.');
            setTeamName('');
            setCharacterName('');
            navigation.navigate('SelectCharacter', { refreshKey: Date.now() });
        } catch (e) {
            if (teamForSubmission?.TeamId) {
                setError(`Team created, but character creation failed: ${e.message || 'Unknown error.'}`);
            } else {
                setError(e.message || 'Failed to create team and character.');
            }
        } finally {
            setSubmitting(false);
        }
    }

    if (!fontsLoaded) {
        return null;
    }

    if (loadingSetup) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#e94560" />
            </View>
        );
    }

    return (
        <ImageBackground source={MENU_BACKGROUND} style={styles.background} imageStyle={styles.backgroundImage}>
            <SafeAreaView style={styles.container}>
                <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Create Team</Text>

                {error && <Text style={styles.error}>{error}</Text>}
                {success ? <Text style={styles.statusSuccessText}>{success}</Text> : null}

                {createdTeam?.TeamId && (
                    <View style={styles.successBox}>
                        <Text style={styles.successTitle}>Team Created</Text>
                        <Text style={styles.successText}>Name: {createdTeam.Name}</Text>
                        <Text style={styles.successText}>Team ID: {createdTeam.TeamId}</Text>
                        <Text style={styles.successHint}>Now choose map and zone to finish creating your character.</Text>
                    </View>
                )}

                <Text style={styles.label}>Team Name</Text>
                <TextInput
                    value={teamName}
                    onChangeText={setTeamName}
                    placeholder="Enter team name"
                    placeholderTextColor="#6f7390"
                    style={styles.input}
                    maxLength={60}
                    editable={!submitting && !createdTeam?.TeamId}
                />

                <Text style={styles.label}>Character Name (optional)</Text>
                <TextInput
                    value={characterName}
                    onChangeText={setCharacterName}
                    placeholder="Enter a character name"
                    placeholderTextColor="#6f7390"
                    style={styles.input}
                    maxLength={50}
                    editable={!submitting}
                />

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
                            disabled={submitting}
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
                                style={[styles.optionButton, selectedZoneId === zone.Id && styles.optionButtonActive]}
                                onPress={() => setSelectedZoneId(zone.Id)}
                                disabled={submitting}
                            >
                                <Text
                                    style={[styles.optionText, selectedZoneId === zone.Id && styles.optionTextActive]}
                                    numberOfLines={1}
                                >
                                    {zone.Name || zone.Id}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}

                <View style={styles.buttonRow}>
                    <Pressable
                        style={[styles.actionButton, styles.cancelButton]}
                        onPress={() => navigation.goBack()}
                        disabled={submitting}
                    >
                        <Text style={styles.actionText}>Back</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.actionButton, styles.submitButton, submitting && styles.disabledButton]}
                        onPress={handleCreateTeamAndCharacter}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.actionText}>{createdTeam?.TeamId ? 'Create Character' : 'Create Team + Character'}</Text>
                        )}
                    </Pressable>
                </View>
                </ScrollView>
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
    centered: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
    content: {
        padding: 16,
        paddingBottom: 32,
    },
    title: {
        color: '#e0e0e0',
        fontSize: 28,
        marginBottom: 16,
        textAlign: 'center',
        fontFamily: MODULE_FONT_FAMILY,
    },
    label: { color: '#a0a0c0', fontSize: 14, marginBottom: 8, marginTop: 10, fontFamily: MODULE_FONT_FAMILY },
    input: {
        backgroundColor: '#16213e',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#0f3460',
        color: '#e0e0e0',
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        fontFamily: MODULE_FONT_FAMILY,
    },
    optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    optionButton: {
        minWidth: '47%',
        backgroundColor: '#16213e',
        borderWidth: 1,
        borderColor: '#0f3460',
        borderRadius: 8,
        padding: 10,
    },
    optionButtonActive: { borderColor: '#e94560', backgroundColor: '#213051' },
    optionText: { color: '#e0e0e0', fontFamily: MODULE_FONT_FAMILY },
    optionTextActive: { color: '#fff', fontFamily: MODULE_FONT_FAMILY },
    zoneLoader: { marginTop: 6 },
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
    disabledButton: {
        opacity: 0.6,
    },
    actionText: { color: '#fff', fontSize: 15, fontFamily: MODULE_FONT_FAMILY },
    error: { color: '#ff667f', marginBottom: 6, textAlign: 'center', fontFamily: MODULE_FONT_FAMILY },
    successBox: {
        backgroundColor: '#16213e',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#0f3460',
        padding: 12,
        marginBottom: 10,
    },
    successTitle: {
        color: '#7ce38b',
        fontSize: 16,
        marginBottom: 4,
        fontFamily: MODULE_FONT_FAMILY,
    },
    successText: {
        color: '#e0e0e0',
        fontSize: 13,
        marginBottom: 2,
        fontFamily: MODULE_FONT_FAMILY,
    },
    successHint: {
        color: '#a0a0c0',
        fontSize: 12,
        marginTop: 6,
        fontFamily: MODULE_FONT_FAMILY,
    },
    statusSuccessText: { color: '#7ce38b', marginBottom: 6, textAlign: 'center', fontFamily: MODULE_FONT_FAMILY },
    warning: { color: '#f6df87', marginBottom: 8, textAlign: 'center', fontFamily: MODULE_FONT_FAMILY },
});
