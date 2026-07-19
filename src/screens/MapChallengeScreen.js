import React, { useCallback, useMemo, useState } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    FlatList,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    ImageBackground,
    TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../api';
import { useAlagardFont, MODULE_FONT_FAMILY } from '../hooks/useAlagardFont';

const MENU_BACKGROUND = require('../../assets/menu-background2.png');

export default function MapChallengeScreen({ navigation, route }) {
    const initialTeamId = route?.params?.initialTeamId ?? null;
    const [fontsLoaded] = useAlagardFont();

    const [myLedTeams, setMyLedTeams] = useState([]);
    const [mapTemplates, setMapTemplates] = useState([]);

    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [selectedCreatorTeamId, setSelectedCreatorTeamId] = useState(initialTeamId);
    const [selectedCreatorZoneTemplateId, setSelectedCreatorZoneTemplateId] = useState(null);
    const [newMapName, setNewMapName] = useState('');

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const selectedTemplate = useMemo(
        () => mapTemplates.find((template) => template.MapTemplateId === selectedTemplateId) || null,
        [mapTemplates, selectedTemplateId]
    );

    const creatorZoneOptions = useMemo(
        () => (Array.isArray(selectedTemplate?.ZoneTemplates) ? selectedTemplate.ZoneTemplates : []),
        [selectedTemplate]
    );

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const [myTeamsResult, templatesResult] = await Promise.all([
                api.getMyLedTeams(),
                api.getMapTemplates(),
            ]);

            const myTeams = Array.isArray(myTeamsResult) ? myTeamsResult : [];
            const templates = Array.isArray(templatesResult) ? templatesResult : [];

            setMyLedTeams(myTeams);
            setMapTemplates(templates);

            if (!selectedCreatorTeamId && myTeams.length > 0) {
                const preferred = initialTeamId
                    ? myTeams.find((team) => team.Id === initialTeamId)
                    : null;
                setSelectedCreatorTeamId(preferred?.Id ?? myTeams[0].Id);
            }

            if (!selectedTemplateId && templates.length > 0) {
                setSelectedTemplateId(templates[0].MapTemplateId);
                const firstZones = Array.isArray(templates[0].ZoneTemplates) ? templates[0].ZoneTemplates : [];
                setSelectedCreatorZoneTemplateId(firstZones[0]?.ZoneTemplateId ?? null);
            }
        } catch (e) {
            setError(e.message || 'Failed to load lobby creation data.');
        } finally {
            setLoading(false);
        }
    }, [initialTeamId, selectedCreatorTeamId, selectedTemplateId]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    async function handleEnterLobby() {
        if (!selectedTemplateId || !selectedCreatorTeamId || !selectedCreatorZoneTemplateId || submitting) {
            setError('Select a map template, creator team, and spawn zone before entering lobby.');
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const created = await api.createMapLobby(
                newMapName.trim(),
                selectedTemplateId,
                selectedCreatorTeamId,
                selectedCreatorZoneTemplateId,
                true
            );

            if (!created?.LobbyId) {
                throw new Error('Lobby created but no lobby id was returned.');
            }

            setSuccess('Lobby created. Opening lobby details.');
            navigation.replace('MapLobby', { lobbyId: created.LobbyId });
        } catch (e) {
            setError(e.message || 'Failed to create lobby.');
        } finally {
            setSubmitting(false);
        }
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
                <Text style={styles.title}>Create Lobby</Text>

                {error ? <Text style={styles.error}>{error}</Text> : null}
                {success ? <Text style={styles.success}>{success}</Text> : null}

                <View style={styles.panel}>
                    <Text style={styles.panelTitle}>Map Template</Text>
                    <FlatList
                        horizontal
                        data={mapTemplates}
                        keyExtractor={(item) => item.MapTemplateId}
                        style={styles.horizontalList}
                        renderItem={({ item }) => (
                            <ChoicePill
                                label={`${item.Name} (${item.ZoneCount} zones)`}
                                selected={item.MapTemplateId === selectedTemplateId}
                                onPress={() => {
                                    setSelectedTemplateId(item.MapTemplateId);
                                    const zones = Array.isArray(item.ZoneTemplates) ? item.ZoneTemplates : [];
                                    setSelectedCreatorZoneTemplateId(zones[0]?.ZoneTemplateId ?? null);
                                }}
                            />
                        )}
                    />

                    <Text style={styles.panelTitle}>Your Team</Text>
                    <FlatList
                        horizontal
                        data={myLedTeams}
                        keyExtractor={(item) => item.Id}
                        style={styles.horizontalList}
                        renderItem={({ item }) => (
                            <ChoicePill
                                label={item.Name || item.Id}
                                selected={item.Id === selectedCreatorTeamId}
                                onPress={() => setSelectedCreatorTeamId(item.Id)}
                            />
                        )}
                    />

                    <Text style={styles.panelTitle}>Your Spawn Zone</Text>
                    <FlatList
                        horizontal
                        data={creatorZoneOptions}
                        keyExtractor={(item) => item.ZoneTemplateId}
                        style={styles.horizontalList}
                        renderItem={({ item }) => (
                            <ChoicePill
                                label={item.Name}
                                selected={item.ZoneTemplateId === selectedCreatorZoneTemplateId}
                                onPress={() => setSelectedCreatorZoneTemplateId(item.ZoneTemplateId)}
                            />
                        )}
                    />

                    <TextInput
                        value={newMapName}
                        onChangeText={setNewMapName}
                        placeholder="Optional map name"
                        placeholderTextColor="#6f7390"
                        style={styles.input}
                        editable={!submitting}
                    />

                    <Pressable
                        style={[styles.primaryButton, submitting ? styles.disabledButton : null]}
                        onPress={handleEnterLobby}
                        disabled={submitting}
                    >
                        <Text style={styles.buttonText}>{submitting ? 'Working...' : 'Enter Lobby'}</Text>
                    </Pressable>
                </View>

                <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('ActiveLobbies')}>
                    <Text style={styles.buttonText}>View Active Lobbies</Text>
                </Pressable>

                <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.buttonText}>Back</Text>
                </Pressable>
            </SafeAreaView>
        </ImageBackground>
    );
}

function ChoicePill({ label, selected, onPress }) {
    return (
        <Pressable style={[styles.pill, selected ? styles.pillSelected : null]} onPress={onPress}>
            <Text style={styles.pillText} numberOfLines={1}>{label}</Text>
        </Pressable>
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
    panel: {
        backgroundColor: '#16213e',
        borderWidth: 1,
        borderColor: '#0f3460',
        borderRadius: 10,
        padding: 12,
        marginBottom: 14,
    },
    panelTitle: { color: '#e0e0e0', fontSize: 15, marginBottom: 8, fontFamily: MODULE_FONT_FAMILY },
    input: {
        backgroundColor: '#10182f',
        borderColor: '#0f3460',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 10,
        color: '#e0e0e0',
        marginBottom: 8,
        fontFamily: MODULE_FONT_FAMILY,
    },
    horizontalList: {
        marginBottom: 10,
    },
    pill: {
        backgroundColor: '#10182f',
        borderColor: '#0f3460',
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginRight: 8,
        maxWidth: 180,
    },
    pillSelected: {
        borderColor: '#e94560',
    },
    pillText: { color: '#d6d9e6', fontSize: 12, fontFamily: MODULE_FONT_FAMILY },
    primaryButton: {
        backgroundColor: '#e94560',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 4,
    },
    secondaryButton: {
        backgroundColor: '#0f3460',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    disabledButton: {
        opacity: 0.6,
    },
    buttonText: { color: '#fff', fontSize: 14, fontFamily: MODULE_FONT_FAMILY },
    error: { color: '#ff667f', marginBottom: 6, textAlign: 'center', fontFamily: MODULE_FONT_FAMILY },
    success: { color: '#7ce38b', marginBottom: 6, textAlign: 'center', fontFamily: MODULE_FONT_FAMILY },
});
