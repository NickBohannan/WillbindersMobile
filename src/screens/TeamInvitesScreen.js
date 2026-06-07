import React, { useCallback, useState } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    FlatList,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    TextInput,
    ImageBackground,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../api';
import { useAlagardFont, MODULE_FONT_FAMILY } from '../hooks/useAlagardFont';

const MENU_BACKGROUND = require('../../assets/menu-background2.png');

export default function TeamInvitesScreen({ navigation }) {
    const [fontsLoaded] = useAlagardFont();
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyInviteId, setBusyInviteId] = useState(null);
    const [error, setError] = useState(null);
    const [leaderIdentifier, setLeaderIdentifier] = useState('');
    const [requesting, setRequesting] = useState(false);
    const [requestMessage, setRequestMessage] = useState(null);

    const loadInvites = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getPendingInvites();
            setInvites(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e.message || 'Failed to load pending invites.');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadInvites();
        }, [loadInvites])
    );

    if (!fontsLoaded) {
        return null;
    }

    async function handleRespond(inviteId, response) {
        setBusyInviteId(inviteId);
        setError(null);
        try {
            await api.respondToInvite(inviteId, response);
            await loadInvites();
        } catch (e) {
            setError(e.message || `Failed to ${response} invite.`);
        } finally {
            setBusyInviteId(null);
        }
    }

    async function handleRequestToJoin() {
        const trimmedLeaderIdentifier = leaderIdentifier.trim();
        if (!trimmedLeaderIdentifier) {
            setError('Team leader username or email is required to request team membership.');
            return;
        }

        setRequesting(true);
        setError(null);
        setRequestMessage(null);

        try {
            const response = await api.requestToJoinTeam(trimmedLeaderIdentifier);
            setRequestMessage(
                `Request sent to ${response?.LeaderName || 'leader'} (${response?.LeaderId || trimmedLeaderIdentifier}).`
            );
            setLeaderIdentifier('');
        } catch (e) {
            setError(e.message || 'Failed to send join request.');
        } finally {
            setRequesting(false);
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
            <Text style={styles.title}>Team Invites</Text>

            <View style={styles.requestCard}>
                <Text style={styles.sectionTitle}>Request Team Membership</Text>
                <Text style={styles.helperText}>Enter a team leader username or email to request an invite.</Text>
                <TextInput
                    value={leaderIdentifier}
                    onChangeText={setLeaderIdentifier}
                    placeholder="Team Leader Username or Email"
                    placeholderTextColor="#6f7390"
                    style={styles.input}
                    editable={!requesting}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <Pressable
                    style={[styles.primaryButton, requesting && styles.disabledButton]}
                    onPress={handleRequestToJoin}
                    disabled={requesting}
                >
                    {requesting ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Send Join Request</Text>
                    )}
                </Pressable>
                {requestMessage && <Text style={styles.success}>{requestMessage}</Text>}
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <Text style={styles.sectionTitle}>Incoming Team Invites</Text>
            {invites.length === 0 ? (
                <Text style={styles.empty}>No pending invites right now.</Text>
            ) : (
                <FlatList
                    data={invites}
                    keyExtractor={(item) => item.InviteId}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => {
                        const isBusy = busyInviteId === item.InviteId;
                        return (
                            <View style={styles.inviteCard}>
                                <Text style={styles.teamName}>{item.TeamName || 'Unnamed Team'}</Text>
                                <Text style={styles.meta}>Team: {item.TeamId}</Text>
                                <Text style={styles.meta}>
                                    Invited by: {item.InvitedByFirstName} {item.InvitedByLastName}
                                </Text>
                                <Text style={styles.meta}>Expires: {new Date(item.ExpiresAt).toLocaleString()}</Text>

                                <View style={styles.row}>
                                    <Pressable
                                        style={[styles.actionButton, styles.acceptButton, isBusy && styles.disabledButton]}
                                        onPress={() => handleRespond(item.InviteId, 'accepted')}
                                        disabled={isBusy}
                                    >
                                        <Text style={styles.buttonText}>Accept</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.actionButton, styles.rejectButton, isBusy && styles.disabledButton]}
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
    sectionTitle: { color: '#e0e0e0', fontSize: 17, marginBottom: 6, fontFamily: MODULE_FONT_FAMILY },
    helperText: { color: '#a0a0c0', fontSize: 13, marginBottom: 8, fontFamily: MODULE_FONT_FAMILY },
    requestCard: {
        backgroundColor: '#16213e',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#0f3460',
        padding: 12,
        marginBottom: 12,
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
    inviteCard: {
        backgroundColor: '#16213e',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#0f3460',
        padding: 12,
        marginBottom: 10,
    },
    teamName: { color: '#e0e0e0', fontSize: 16, marginBottom: 6, fontFamily: MODULE_FONT_FAMILY },
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
    disabledButton: { opacity: 0.6 },
    error: { color: '#ff667f', marginBottom: 8, textAlign: 'center', fontFamily: MODULE_FONT_FAMILY },
    success: { color: '#7ce38b', marginTop: 8, fontSize: 13, fontFamily: MODULE_FONT_FAMILY },
    empty: { color: '#a0a0c0', textAlign: 'center', marginTop: 10, fontFamily: MODULE_FONT_FAMILY },
});
