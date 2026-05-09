import React, { useCallback, useMemo, useState } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    FlatList,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../api';

export default function TeamRequestsScreen({ navigation }) {
    const [requests, setRequests] = useState([]);
    const [myTeams, setMyTeams] = useState([]);
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [inviteAccountId, setInviteAccountId] = useState('');
    const [inviteBusy, setInviteBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busyRequestId, setBusyRequestId] = useState(null);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);

    const selectedTeamName = useMemo(() => {
        const team = myTeams.find((t) => t.Id === selectedTeamId);
        return team?.Name || '';
    }, [myTeams, selectedTeamId]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [pendingRequests, ledTeams] = await Promise.all([
                api.getPendingJoinRequests(),
                api.getMyLedTeams(),
            ]);

            const teams = Array.isArray(ledTeams) ? ledTeams : [];
            setMyTeams(teams);
            setRequests(Array.isArray(pendingRequests) ? pendingRequests : []);

            if (!selectedTeamId && teams.length > 0) {
                setSelectedTeamId(teams[0].Id);
            }
        } catch (e) {
            setError(e.message || 'Failed to load team requests.');
        } finally {
            setLoading(false);
        }
    }, [selectedTeamId]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    async function handleRespond(requestId, response) {
        if (response === 'accepted' && !selectedTeamId) {
            setError('Select one of your teams before accepting a request.');
            return;
        }

        setBusyRequestId(requestId);
        setError(null);
        setMessage(null);
        try {
            await api.respondToJoinRequest(
                requestId,
                response === 'accepted' ? selectedTeamId : '00000000-0000-0000-0000-000000000000',
                response
            );
            setMessage(response === 'accepted' ? 'Request accepted.' : 'Request rejected.');
            await loadData();
        } catch (e) {
            setError(e.message || `Failed to ${response} request.`);
        } finally {
            setBusyRequestId(null);
        }
    }

    async function handleInvite() {
        const accountId = inviteAccountId.trim();
        if (!selectedTeamId) {
            setError('Select a team first.');
            return;
        }

        if (!accountId) {
            setError('Account ID is required to send an invite.');
            return;
        }

        setInviteBusy(true);
        setError(null);
        setMessage(null);
        try {
            const response = await api.inviteAccountToTeam(selectedTeamId, accountId);
            setMessage(`Invite sent to ${response?.AccountName || accountId}.`);
            setInviteAccountId('');
        } catch (e) {
            setError(e.message || 'Failed to send invite.');
        } finally {
            setInviteBusy(false);
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
            <Text style={styles.title}>Join Requests</Text>

            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Choose Team Context</Text>
                {myTeams.length === 0 ? (
                    <Text style={styles.empty}>You are not currently a leader of any team.</Text>
                ) : (
                    <View style={styles.teamList}>
                        {myTeams.map((team) => {
                            const selected = selectedTeamId === team.Id;
                            return (
                                <Pressable
                                    key={team.Id}
                                    style={[styles.teamChip, selected && styles.teamChipSelected]}
                                    onPress={() => setSelectedTeamId(team.Id)}
                                >
                                    <Text style={[styles.teamChipText, selected && styles.teamChipTextSelected]}>
                                        {team.Name}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                )}
                {!!selectedTeamId && (
                    <Text style={styles.meta}>Selected Team ID: {selectedTeamId}</Text>
                )}
            </View>

            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Invite Account To Selected Team</Text>
                <TextInput
                    value={inviteAccountId}
                    onChangeText={setInviteAccountId}
                    placeholder="Account ID to invite"
                    placeholderTextColor="#6f7390"
                    style={styles.input}
                    editable={!inviteBusy}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <Pressable
                    style={[styles.primaryButton, inviteBusy && styles.disabledButton]}
                    onPress={handleInvite}
                    disabled={inviteBusy || !selectedTeamId}
                >
                    {inviteBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.buttonText}>Send Invite</Text>}
                </Pressable>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}
            {message && <Text style={styles.success}>{message}</Text>}

            <Text style={styles.sectionTitle}>Pending Join Requests</Text>
            {requests.length === 0 ? (
                <Text style={styles.empty}>No pending join requests.</Text>
            ) : (
                <FlatList
                    data={requests}
                    keyExtractor={(item) => item.RequestId}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => {
                        const isBusy = busyRequestId === item.RequestId;
                        return (
                            <View style={styles.requestCard}>
                                <Text style={styles.name}>
                                    {item.RequesterFirstName} {item.RequesterLastName}
                                </Text>
                                <Text style={styles.meta}>Account: {item.AccountId}</Text>
                                <Text style={styles.meta}>Requested: {new Date(item.CreatedAt).toLocaleString()}</Text>
                                <Text style={styles.meta}>Selected Team: {selectedTeamName || 'None selected'}</Text>

                                <View style={styles.row}>
                                    <Pressable
                                        style={[styles.actionButton, styles.acceptButton, isBusy && styles.disabledButton]}
                                        onPress={() => handleRespond(item.RequestId, 'accepted')}
                                        disabled={isBusy || !selectedTeamId}
                                    >
                                        <Text style={styles.buttonText}>Accept</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.actionButton, styles.rejectButton, isBusy && styles.disabledButton]}
                                        onPress={() => handleRespond(item.RequestId, 'rejected')}
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
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a2e',
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
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center',
    },
    sectionTitle: {
        color: '#e0e0e0',
        fontSize: 17,
        fontWeight: '700',
        marginBottom: 6,
    },
    card: {
        backgroundColor: '#16213e',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#0f3460',
        padding: 12,
        marginBottom: 10,
    },
    teamList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    teamChip: {
        backgroundColor: '#10182f',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#0f3460',
        paddingVertical: 7,
        paddingHorizontal: 12,
    },
    teamChipSelected: {
        backgroundColor: '#e94560',
        borderColor: '#e94560',
    },
    teamChipText: {
        color: '#a0a0c0',
        fontSize: 12,
        fontWeight: '700',
    },
    teamChipTextSelected: {
        color: '#fff',
    },
    input: {
        backgroundColor: '#10182f',
        borderWidth: 1,
        borderColor: '#0f3460',
        borderRadius: 8,
        color: '#e0e0e0',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
    },
    list: {
        paddingBottom: 10,
    },
    requestCard: {
        backgroundColor: '#16213e',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#0f3460',
        padding: 12,
        marginBottom: 10,
    },
    name: {
        color: '#e0e0e0',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 6,
    },
    meta: {
        color: '#a0a0c0',
        fontSize: 12,
        marginBottom: 3,
    },
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
    buttonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    disabledButton: {
        opacity: 0.6,
    },
    error: {
        color: '#ff667f',
        marginBottom: 8,
        textAlign: 'center',
    },
    success: {
        color: '#7ce38b',
        marginBottom: 8,
        textAlign: 'center',
    },
    empty: {
        color: '#a0a0c0',
        textAlign: 'center',
        marginTop: 4,
    },
});
