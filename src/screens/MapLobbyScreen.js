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
import { useAuth } from '../context/AuthContext';
import { useAlagardFont, MODULE_FONT_FAMILY } from '../hooks/useAlagardFont';

const MENU_BACKGROUND = require('../../assets/menu-background2.png');

export default function MapLobbyScreen({ navigation, route }) {
    const { userId } = useAuth();
    const lobbyId = route?.params?.lobbyId ?? null;
    const [fontsLoaded] = useAlagardFont();

    const [myLedTeams, setMyLedTeams] = useState([]);
    const [allTeams, setAllTeams] = useState([]);
    const [pendingInvites, setPendingInvites] = useState([]);

    const [activeLobby, setActiveLobby] = useState(null);
    const [activeLobbyMap, setActiveLobbyMap] = useState(null);

    const [opposingIdentifier, setOpposingIdentifier] = useState('');
    const [opposingTeamId, setOpposingTeamId] = useState(null);
    const [memberIdentifier, setMemberIdentifier] = useState('');
    const [memberTeamId, setMemberTeamId] = useState(null);
    const [selectedAcceptSpawnZoneId, setSelectedAcceptSpawnZoneId] = useState(null);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const otherTeams = useMemo(() => {
        const myIds = new Set(myLedTeams.map((team) => team.Id));
        return allTeams.filter((team) => !myIds.has(team.Id));
    }, [allTeams, myLedTeams]);

    const activeMapZoneOptions = useMemo(
        () => (Array.isArray(activeLobbyMap?.Zones) ? activeLobbyMap.Zones : []),
        [activeLobbyMap]
    );

    const loadLobby = useCallback(async (id) => {
        if (!id) {
            return;
        }

        const lobby = await api.getMapLobby(id);
        setActiveLobby(lobby ?? null);

        if (lobby?.MapId) {
            const map = await api.getMap(lobby.MapId);
            setActiveLobbyMap(map ?? null);
        } else {
            setActiveLobbyMap(null);
        }
    }, []);

    const loadData = useCallback(async () => {
        if (!lobbyId) {
            setLoading(false);
            setError('No lobby id was provided.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [myTeamsResult, allTeamsResult, pendingResult] = await Promise.all([
                api.getMyLedTeams(),
                api.getAllTeams(),
                api.getPendingMapLobbyInvites(),
            ]);

            const myTeams = Array.isArray(myTeamsResult) ? myTeamsResult : [];
            const everyTeam = Array.isArray(allTeamsResult) ? allTeamsResult : [];
            const pending = Array.isArray(pendingResult) ? pendingResult : [];

            setMyLedTeams(myTeams);
            setAllTeams(everyTeam);
            setPendingInvites(pending);

            if (!memberTeamId && myTeams.length > 0) {
                setMemberTeamId(myTeams[0].Id);
            }

            await loadLobby(lobbyId);
        } catch (e) {
            setError(e.message || 'Failed to load lobby.');
        } finally {
            setLoading(false);
        }
    }, [lobbyId, loadLobby, memberTeamId]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    async function handleInviteOpposingLeader() {
        if (!lobbyId || !opposingIdentifier.trim() || !opposingTeamId || submitting) {
            setError('Choose opposing team and username/email before inviting.');
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const lobby = await api.inviteOpposingLeaderToLobby(lobbyId, opposingIdentifier.trim(), opposingTeamId);
            setActiveLobby(lobby ?? activeLobby);
            setOpposingIdentifier('');
            setSuccess('Opposing leader invite sent.');
            await loadData();
        } catch (e) {
            setError(e.message || 'Failed to invite opposing leader.');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleInviteMember() {
        if (!lobbyId || !memberIdentifier.trim() || !memberTeamId || submitting) {
            setError('Choose team and username/email before inviting a member.');
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const lobby = await api.inviteLobbyMember(lobbyId, memberIdentifier.trim(), memberTeamId);
            setActiveLobby(lobby ?? activeLobby);
            setMemberIdentifier('');
            setSuccess('Team member invite sent.');
            await loadData();
        } catch (e) {
            setError(e.message || 'Failed to invite member.');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleRespondInvite(inviteId, response) {
        if (!inviteId || submitting) {
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            if (response === 'accepted') {
                if (!selectedAcceptSpawnZoneId) {
                    throw new Error('Select a spawn zone before accepting.');
                }

                await api.respondToMapLobbyInvite(inviteId, 'accepted', selectedAcceptSpawnZoneId);
                setSuccess('Invite accepted.');
            } else {
                await api.respondToMapLobbyInvite(inviteId, 'rejected');
                setSuccess('Invite rejected.');
            }

            await loadData();
        } catch (e) {
            setError(e.message || `Failed to ${response} invite.`);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleStartLobbyMap() {
        if (!lobbyId || submitting) {
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const started = await api.startMapFromLobby(lobbyId);
            if (!started?.Started) {
                throw new Error(started?.Message || 'Lobby map could not be started.');
            }

            const data = await api.getCharactersByUserId(userId);
            const characters = Array.isArray(data?.Characters) ? data.Characters : [];
            const selected = characters.find((character) => character?.CurrentMap === started.MapId);

            if (selected) {
                navigation.navigate('CharacterMap', { character: selected, mapId: started.MapId });
                return;
            }

            setSuccess('Map started. Character creation completed for accepted members.');
        } catch (e) {
            setError(e.message || 'Failed to start lobby map.');
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
                <Text style={styles.title}>Lobby Details</Text>

                {error ? <Text style={styles.error}>{error}</Text> : null}
                {success ? <Text style={styles.success}>{success}</Text> : null}

                {activeLobby ? (
                    <View style={styles.panel}>
                        <Text style={styles.panelTitle}>{activeLobby.MapName || 'Lobby Map'}</Text>
                        <Text style={styles.meta}>Lobby ID: {activeLobby.LobbyId}</Text>
                        <Text style={styles.meta}>State: {activeLobby.State}</Text>

                        <Text style={styles.helper}>Invite opposing leader</Text>
                        <TextInput
                            value={opposingIdentifier}
                            onChangeText={setOpposingIdentifier}
                            placeholder="Opposing leader username/email"
                            placeholderTextColor="#6f7390"
                            style={styles.input}
                            editable={!submitting}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <FlatList
                            horizontal
                            data={otherTeams}
                            keyExtractor={(item) => item.Id}
                            style={styles.horizontalList}
                            renderItem={({ item }) => (
                                <ChoicePill
                                    label={item.Name || item.Id}
                                    selected={item.Id === opposingTeamId}
                                    onPress={() => setOpposingTeamId(item.Id)}
                                />
                            )}
                        />
                        <Pressable
                            style={[styles.secondaryButton, submitting ? styles.disabledButton : null]}
                            onPress={handleInviteOpposingLeader}
                            disabled={submitting}
                        >
                            <Text style={styles.buttonText}>Invite Opposing Leader</Text>
                        </Pressable>

                        <Text style={[styles.helper, { marginTop: 8 }]}>Invite team member</Text>
                        <TextInput
                            value={memberIdentifier}
                            onChangeText={setMemberIdentifier}
                            placeholder="Member username/email"
                            placeholderTextColor="#6f7390"
                            style={styles.input}
                            editable={!submitting}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <FlatList
                            horizontal
                            data={myLedTeams}
                            keyExtractor={(item) => item.Id}
                            style={styles.horizontalList}
                            renderItem={({ item }) => (
                                <ChoicePill
                                    label={item.Name || item.Id}
                                    selected={item.Id === memberTeamId}
                                    onPress={() => setMemberTeamId(item.Id)}
                                />
                            )}
                        />
                        <Pressable
                            style={[styles.secondaryButton, submitting ? styles.disabledButton : null]}
                            onPress={handleInviteMember}
                            disabled={submitting}
                        >
                            <Text style={styles.buttonText}>Invite Team Member</Text>
                        </Pressable>

                        <Text style={[styles.helper, { marginTop: 8 }]}>Members</Text>
                        {(activeLobby.Members || []).map((member) => (
                            <Text key={member.LobbyMemberId} style={styles.meta}>
                                {member.Username} - {member.TeamName} - {member.SpawnZoneName} ({member.Role})
                            </Text>
                        ))}

                        <Pressable
                            style={[styles.startButton, submitting ? styles.disabledButton : null]}
                            onPress={handleStartLobbyMap}
                            disabled={submitting}
                        >
                            <Text style={styles.buttonText}>Start Map</Text>
                        </Pressable>
                    </View>
                ) : (
                    <View style={styles.panel}>
                        <Text style={styles.meta}>Lobby was not found or is no longer active.</Text>
                    </View>
                )}

                <View style={styles.panel}>
                    <Text style={styles.panelTitle}>Pending Invites For You</Text>
                    {pendingInvites.filter((invite) => invite.LobbyId === lobbyId).length === 0 ? (
                        <Text style={styles.meta}>No pending invites for this lobby.</Text>
                    ) : (
                        pendingInvites
                            .filter((invite) => invite.LobbyId === lobbyId)
                            .map((invite) => (
                                <View key={invite.InviteId} style={styles.inviteCard}>
                                    <Text style={styles.inviteTitle}>{invite.InviteType} from {invite.InvitedByUsername}</Text>
                                    <Text style={styles.meta}>Team: {invite.TargetTeamName}</Text>
                                    <Text style={styles.meta}>Expires: {new Date(invite.ExpiresAt).toLocaleString()}</Text>

                                    <FlatList
                                        horizontal
                                        data={activeMapZoneOptions}
                                        keyExtractor={(zone) => zone.Id}
                                        style={styles.horizontalList}
                                        renderItem={({ item: zone }) => (
                                            <ChoicePill
                                                label={zone.Name}
                                                selected={selectedAcceptSpawnZoneId === zone.Id}
                                                onPress={() => setSelectedAcceptSpawnZoneId(zone.Id)}
                                            />
                                        )}
                                    />

                                    <View style={styles.row}>
                                        <Pressable
                                            style={[styles.actionButton, styles.acceptButton, submitting ? styles.disabledButton : null]}
                                            onPress={() => handleRespondInvite(invite.InviteId, 'accepted')}
                                            disabled={submitting}
                                        >
                                            <Text style={styles.buttonText}>Accept</Text>
                                        </Pressable>
                                        <Pressable
                                            style={[styles.actionButton, styles.rejectButton, submitting ? styles.disabledButton : null]}
                                            onPress={() => handleRespondInvite(invite.InviteId, 'rejected')}
                                            disabled={submitting}
                                        >
                                            <Text style={styles.buttonText}>Reject</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ))
                    )}
                </View>

                <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('ActiveLobbies')}>
                    <Text style={styles.buttonText}>Back To Active Lobbies</Text>
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
    row: {
        flexDirection: 'row',
        marginTop: 10,
        gap: 8,
    },
    secondaryButton: {
        backgroundColor: '#0f3460',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 4,
    },
    startButton: {
        backgroundColor: '#2d6a4f',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    actionButton: {
        flex: 1,
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
    },
    acceptButton: {
        backgroundColor: '#2d6a4f',
    },
    rejectButton: {
        backgroundColor: '#6a2d3e',
    },
    disabledButton: {
        opacity: 0.6,
    },
    buttonText: { color: '#fff', fontSize: 14, fontFamily: MODULE_FONT_FAMILY },
    error: { color: '#ff667f', marginBottom: 6, textAlign: 'center', fontFamily: MODULE_FONT_FAMILY },
    success: { color: '#7ce38b', marginBottom: 6, textAlign: 'center', fontFamily: MODULE_FONT_FAMILY },
    meta: { color: '#a0a0c0', fontSize: 12, marginBottom: 2, fontFamily: MODULE_FONT_FAMILY },
    inviteCard: {
        backgroundColor: '#10182f',
        borderColor: '#0f3460',
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        marginBottom: 10,
    },
    inviteTitle: {
        color: '#e0e0e0',
        fontSize: 14,
        marginBottom: 4,
        fontFamily: MODULE_FONT_FAMILY,
    },
});
