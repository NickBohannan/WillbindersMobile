import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

export default function MapChallengeScreen({ navigation }) {
    const [fontsLoaded] = useAlagardFont();
    const [myLedTeams, setMyLedTeams] = useState([]);
    const [allTeams, setAllTeams] = useState([]);
    const [testMaps, setTestMaps] = useState([]);
    const [mapTemplates, setMapTemplates] = useState([]);
    const [pendingInvites, setPendingInvites] = useState([]);

    const [selectedMyTeamId, setSelectedMyTeamId] = useState(null);
    const [selectedOtherTeamId, setSelectedOtherTeamId] = useState(null);
    const [selectedMapId, setSelectedMapId] = useState(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [newMapName, setNewMapName] = useState('');
    const [selectedMapValidation, setSelectedMapValidation] = useState(null);
    const [validatingMap, setValidatingMap] = useState(false);

    const [loading, setLoading] = useState(true);
    const [busyInviteId, setBusyInviteId] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [creatingMap, setCreatingMap] = useState(false);
    const [startingMap, setStartingMap] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const [myTeamsResult, allTeamsResult, mapsResult, templatesResult, pendingResult] = await Promise.all([
                api.getMyLedTeams(),
                api.getAllTeams(),
                api.getTestMaps(),
                api.getMapTemplates(),
                api.getPendingMapChallengeInvites(),
            ]);

            const myTeams = Array.isArray(myTeamsResult) ? myTeamsResult : [];
            const everyTeam = Array.isArray(allTeamsResult) ? allTeamsResult : [];
            const maps = Array.isArray(mapsResult) ? mapsResult : [];
            const templates = Array.isArray(templatesResult) ? templatesResult : [];
            const pending = Array.isArray(pendingResult) ? pendingResult : [];

            setMyLedTeams(myTeams);
            setAllTeams(everyTeam);
            setTestMaps(maps);
            setMapTemplates(templates);
            setPendingInvites(pending);

            if (myTeams.length > 0 && !selectedMyTeamId) {
                setSelectedMyTeamId(myTeams[0].Id);
            }

            if (maps.length > 0 && !selectedMapId) {
                setSelectedMapId(maps[0].MapId);
            }

            if (templates.length > 0 && !selectedTemplateId) {
                setSelectedTemplateId(templates[0].MapTemplateId);
            }
        } catch (e) {
            setError(e.message || 'Failed to load map challenge data.');
        } finally {
            setLoading(false);
        }
    }, [selectedMapId, selectedMyTeamId, selectedTemplateId]);

    const validateSelectedMap = useCallback(async (mapId) => {
        if (!mapId) {
            setSelectedMapValidation(null);
            return;
        }

        setValidatingMap(true);
        try {
            const validation = await api.validateMapStart(mapId);
            setSelectedMapValidation(validation ?? null);
        } catch (e) {
            setSelectedMapValidation(null);
            setError(e.message || 'Failed to validate selected map.');
        } finally {
            setValidatingMap(false);
        }
    }, []);

    useEffect(() => {
        validateSelectedMap(selectedMapId);
    }, [selectedMapId, validateSelectedMap]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    if (!fontsLoaded) {
        return null;
    }

    const otherTeams = useMemo(() => {
        const myTeamIds = new Set(myLedTeams.map((team) => team.Id));
        return allTeams.filter((team) => !myTeamIds.has(team.Id));
    }, [allTeams, myLedTeams]);

    async function handleSendChallenge() {
        if (!selectedMapId || !selectedMyTeamId || !selectedOtherTeamId || submitting) {
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const created = await api.createMapChallengeInvite(selectedMapId, selectedMyTeamId, selectedOtherTeamId);
            setSuccess(
                `Challenge sent: ${created?.InviterTeamName || 'Your Team'} vs ${created?.InviteeTeamName || 'Target Team'} on ${created?.MapName || 'test map'}.`
            );
            await loadData();
        } catch (e) {
            setError(e.message || 'Failed to send challenge invite.');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCreateMapFromTemplate() {
        if (!selectedTemplateId || creatingMap) {
            return;
        }

        setCreatingMap(true);
        setError(null);
        setSuccess(null);

        try {
            const selectedTemplate = mapTemplates.find((template) => template.MapTemplateId === selectedTemplateId);
            const trimmed = newMapName.trim();
            const defaultName = selectedTemplate?.Name ? `${selectedTemplate.Name} Live` : 'Template Map Live';
            const mapName = trimmed || defaultName;
            const created = await api.createMapFromTemplate(mapName, selectedTemplateId, true);
            setSelectedMapId(created?.MapId ?? null);
            setNewMapName('');
            setSuccess(`Map created from template: ${created?.Name || mapName}`);
            await loadData();
        } catch (e) {
            setError(e.message || 'Failed to create map from template.');
        } finally {
            setCreatingMap(false);
        }
    }

    async function handleStartSelectedMap() {
        if (!selectedMapId || startingMap) {
            return;
        }

        if (!selectedMapValidation?.CanStart) {
            setError(selectedMapValidation?.Reason || 'Map cannot be started yet.');
            return;
        }

        setStartingMap(true);
        setError(null);
        setSuccess(null);

        try {
            const validation = selectedMapValidation ?? await api.validateMapStart(selectedMapId);
            if (!validation?.CanStart) {
                setError(validation?.Reason || 'Map cannot be started yet.');
                return;
            }

            const started = await api.startMap(selectedMapId);
            if (started?.Started) {
                setSuccess(started?.Message || 'Map started.');
            } else {
                setError(started?.Message || 'Map cannot be started yet.');
            }

            await validateSelectedMap(selectedMapId);
        } catch (e) {
            setError(e.message || 'Failed to start map.');
        } finally {
            setStartingMap(false);
        }
    }

    async function handleRespond(inviteId, response) {
        if (!inviteId || busyInviteId) {
            return;
        }

        setBusyInviteId(inviteId);
        setError(null);
        setSuccess(null);

        try {
            const updated = await api.respondToMapChallengeInvite(inviteId, response);
            if (response === 'accepted' && updated?.MapId) {
                setSelectedMapId(updated.MapId);
                await validateSelectedMap(updated.MapId);
                setSuccess(`Challenge accepted. Map ${updated.MapName || updated.MapId} is ready to start.`);
            } else {
                setSuccess('Challenge rejected.');
            }
            await loadData();
        } catch (e) {
            setError(e.message || `Failed to ${response} challenge.`);
        } finally {
            setBusyInviteId(null);
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
        <ImageBackground source={MENU_BACKGROUND} style={styles.background} imageStyle={styles.backgroundImage}>
            <SafeAreaView style={styles.container}>
            <Text style={styles.title}>Map Challenges</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            <View style={styles.panel}>
                <Text style={styles.panelTitle}>Create Map From Template</Text>
                <Text style={styles.helper}>Select one template (admin-managed)</Text>
                <FlatList
                    horizontal
                    data={mapTemplates}
                    keyExtractor={(item) => item.MapTemplateId}
                    style={styles.horizontalList}
                    renderItem={({ item }) => (
                        <ChoicePill
                            label={`${item.Name} (${item.ZoneCount} zones)`}
                            selected={item.MapTemplateId === selectedTemplateId}
                            onPress={() => setSelectedTemplateId(item.MapTemplateId)}
                        />
                    )}
                />

                <TextInput
                    value={newMapName}
                    onChangeText={setNewMapName}
                    placeholder="Optional live map name"
                    placeholderTextColor="#6f7390"
                    style={styles.input}
                    editable={!creatingMap}
                />

                <Pressable
                    style={[styles.primaryButton, creatingMap ? styles.disabledButton : null]}
                    onPress={handleCreateMapFromTemplate}
                    disabled={creatingMap || !selectedTemplateId}
                >
                    <Text style={styles.buttonText}>{creatingMap ? 'Creating...' : 'Create Map From Template'}</Text>
                </Pressable>

                <Text style={styles.panelTitle}>Send Team Challenge</Text>
                <Text style={styles.helper}>1) Select your team</Text>
                <FlatList
                    horizontal
                    data={myLedTeams}
                    keyExtractor={(item) => item.Id}
                    style={styles.horizontalList}
                    renderItem={({ item }) => (
                        <ChoicePill
                            label={item.Name || item.Id}
                            selected={item.Id === selectedMyTeamId}
                            onPress={() => setSelectedMyTeamId(item.Id)}
                        />
                    )}
                />

                <Text style={styles.helper}>2) Select opponent team</Text>
                <FlatList
                    horizontal
                    data={otherTeams}
                    keyExtractor={(item) => item.Id}
                    style={styles.horizontalList}
                    renderItem={({ item }) => (
                        <ChoicePill
                            label={item.Name || item.Id}
                            selected={item.Id === selectedOtherTeamId}
                            onPress={() => setSelectedOtherTeamId(item.Id)}
                        />
                    )}
                />

                <Text style={styles.helper}>3) Select map (test maps only)</Text>
                <FlatList
                    horizontal
                    data={testMaps}
                    keyExtractor={(item) => item.MapId}
                    style={styles.horizontalList}
                    renderItem={({ item }) => (
                        <ChoicePill
                            label={item.Name || item.MapId}
                            selected={item.MapId === selectedMapId}
                            onPress={() => setSelectedMapId(item.MapId)}
                        />
                    )}
                />

                <View style={styles.validationCard}>
                    <Text style={styles.validationTitle}>Selected Map Status</Text>
                    {validatingMap ? (
                        <ActivityIndicator size="small" color="#e94560" />
                    ) : selectedMapValidation ? (
                        <>
                            <Text style={styles.validationLine}>
                                {selectedMapValidation.CanStart ? 'Ready to start.' : selectedMapValidation.Reason}
                            </Text>
                            <Text style={styles.validationMeta}>
                                Teams on map: {Object.keys(selectedMapValidation.TeamCharacterCounts || {}).length}
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.validationLine}>Select a map to check start readiness.</Text>
                    )}
                </View>

                {selectedMapId && selectedMapValidation?.CanStart ? (
                    <View style={styles.readyCard}>
                        <Text style={styles.readyTitle}>Ready To Start</Text>
                        <Text style={styles.readyLine}>
                            {selectedMapValidation.Reason || 'The map has enough teams and an accepted challenge invite.'}
                        </Text>
                        <Text style={styles.readyMeta}>
                            Map ID: {selectedMapId}
                        </Text>
                        <Pressable
                            style={[styles.startButton, startingMap || validatingMap ? styles.disabledButton : null]}
                            onPress={handleStartSelectedMap}
                            disabled={startingMap || validatingMap}
                        >
                            <Text style={styles.buttonText}>{startingMap ? 'Starting...' : 'Start This Map'}</Text>
                        </Pressable>
                    </View>
                ) : null}

                <Pressable
                    style={[
                        styles.primaryButton,
                        submitting || startingMap || validatingMap || !selectedMapValidation?.CanStart ? styles.disabledButton : null,
                    ]}
                    onPress={handleSendChallenge}
                    disabled={submitting || !selectedMapId || !selectedMyTeamId || !selectedOtherTeamId}
                >
                    <Text style={styles.buttonText}>{submitting ? 'Sending...' : 'Send Challenge Invite'}</Text>
                </Pressable>
            </View>

            <Text style={styles.panelTitle}>Incoming Challenges</Text>
            {pendingInvites.length === 0 ? (
                <Text style={styles.empty}>No pending map challenges for your led teams.</Text>
            ) : (
                <FlatList
                    data={pendingInvites}
                    keyExtractor={(item) => item.InviteId}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => {
                        const isBusy = busyInviteId === item.InviteId;
                        return (
                            <View style={styles.inviteCard}>
                                <Text style={styles.inviteTitle}>{item.InviterTeamName} challenged {item.InviteeTeamName}</Text>
                                <Text style={styles.meta}>Map: {item.MapName}</Text>
                                <Text style={styles.meta}>Expires: {new Date(item.ExpiresAt).toLocaleString()}</Text>
                                <View style={styles.row}>
                                    <Pressable
                                        style={[styles.actionButton, styles.acceptButton, isBusy ? styles.disabledButton : null]}
                                        onPress={() => handleRespond(item.InviteId, 'accepted')}
                                        disabled={isBusy}
                                    >
                                        <Text style={styles.buttonText}>Accept</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.actionButton, styles.rejectButton, isBusy ? styles.disabledButton : null]}
                                        onPress={() => handleRespond(item.InviteId, 'rejected')}
                                        disabled={isBusy}
                                    >
                                        <Text style={styles.buttonText}>Reject</Text>
                                    </Pressable>
                                </View>
                            </View>
                        );
                    }}
                />
            )}

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
    panelTitle: { color: '#e0e0e0', fontSize: 17, marginBottom: 8, fontFamily: MODULE_FONT_FAMILY },
    helper: { color: '#a0a0c0', fontSize: 12, marginBottom: 6, fontFamily: MODULE_FONT_FAMILY },
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
        marginBottom: 8,
    },
    validationCard: {
        backgroundColor: '#10182f',
        borderColor: '#0f3460',
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
    },
    validationTitle: {
        color: '#e0e0e0',
        fontSize: 14,
        marginBottom: 6,
        fontFamily: MODULE_FONT_FAMILY,
    },
    validationLine: {
        color: '#a0a0c0',
        fontSize: 12,
        fontFamily: MODULE_FONT_FAMILY,
    },
    validationMeta: {
        color: '#7ce38b',
        fontSize: 11,
        marginTop: 4,
        fontFamily: MODULE_FONT_FAMILY,
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
    list: {
        paddingBottom: 10,
    },
    inviteCard: {
        backgroundColor: '#16213e',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#0f3460',
        padding: 12,
        marginBottom: 10,
    },
    inviteTitle: { color: '#f0f0f8', fontSize: 15, marginBottom: 6, fontFamily: MODULE_FONT_FAMILY },
    meta: { color: '#a0a0c0', fontSize: 12, marginBottom: 3, fontFamily: MODULE_FONT_FAMILY },
    row: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
    },
    actionButton: {
        flex: 1,
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
    },
    primaryButton: {
        backgroundColor: '#e94560',
        borderRadius: 8,
        paddingVertical: 11,
        alignItems: 'center',
        marginTop: 4,
    },
    secondaryButton: {
        backgroundColor: '#0f3460',
        borderRadius: 8,
        paddingVertical: 11,
        alignItems: 'center',
        marginTop: 10,
    },
    startButton: {
        backgroundColor: '#2c8b46',
        borderRadius: 8,
        paddingVertical: 11,
        alignItems: 'center',
        marginTop: 8,
    },
    acceptButton: {
        backgroundColor: '#2c8b46',
    },
    rejectButton: {
        backgroundColor: '#7a2a3a',
    },
    buttonText: { color: '#fff', fontSize: 14, fontFamily: MODULE_FONT_FAMILY },
    disabledButton: {
        opacity: 0.6,
    },
    error: { color: '#ff667f', marginBottom: 8, textAlign: 'center', fontFamily: MODULE_FONT_FAMILY },
    success: { color: '#7ce38b', marginBottom: 8, textAlign: 'center', fontFamily: MODULE_FONT_FAMILY },
    empty: { color: '#a0a0c0', textAlign: 'center', marginTop: 8, fontFamily: MODULE_FONT_FAMILY },
});
