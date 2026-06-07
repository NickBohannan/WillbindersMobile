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
    const [pendingInvites, setPendingInvites] = useState([]);

    const [selectedMyTeamId, setSelectedMyTeamId] = useState(null);
    const [selectedOtherTeamId, setSelectedOtherTeamId] = useState(null);
    const [selectedMapId, setSelectedMapId] = useState(null);

    const [loading, setLoading] = useState(true);
    const [busyInviteId, setBusyInviteId] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const [myTeamsResult, allTeamsResult, mapsResult, pendingResult] = await Promise.all([
                api.getMyLedTeams(),
                api.getAllTeams(),
                api.getTestMaps(),
                api.getPendingMapChallengeInvites(),
            ]);

            const myTeams = Array.isArray(myTeamsResult) ? myTeamsResult : [];
            const everyTeam = Array.isArray(allTeamsResult) ? allTeamsResult : [];
            const maps = Array.isArray(mapsResult) ? mapsResult : [];
            const pending = Array.isArray(pendingResult) ? pendingResult : [];

            setMyLedTeams(myTeams);
            setAllTeams(everyTeam);
            setTestMaps(maps);
            setPendingInvites(pending);

            if (myTeams.length > 0 && !selectedMyTeamId) {
                setSelectedMyTeamId(myTeams[0].Id);
            }

            if (maps.length > 0 && !selectedMapId) {
                setSelectedMapId(maps[0].MapId);
            }
        } catch (e) {
            setError(e.message || 'Failed to load map challenge data.');
        } finally {
            setLoading(false);
        }
    }, [selectedMapId, selectedMyTeamId]);

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

    async function handleRespond(inviteId, response) {
        if (!inviteId || busyInviteId) {
            return;
        }

        setBusyInviteId(inviteId);
        setError(null);
        setSuccess(null);

        try {
            await api.respondToMapChallengeInvite(inviteId, response);
            setSuccess(response === 'accepted' ? 'Challenge accepted.' : 'Challenge rejected.');
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

                <Pressable
                    style={[styles.primaryButton, submitting ? styles.disabledButton : null]}
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
    horizontalList: {
        marginBottom: 8,
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
