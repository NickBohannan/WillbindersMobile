import React, { useState } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import * as api from '../api';

export default function CreateTeamScreen({ navigation }) {
    const [teamName, setTeamName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [createdTeam, setCreatedTeam] = useState(null);

    async function handleCreateTeam() {
        const trimmedName = teamName.trim();
        if (!trimmedName) {
            setError('Team name is required.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const response = await api.createTeam(trimmedName);
            setCreatedTeam(response);
            setTeamName('');
        } catch (e) {
            setError(e.message || 'Failed to create team.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Create Team</Text>

                {error && <Text style={styles.error}>{error}</Text>}

                {createdTeam?.TeamId && (
                    <View style={styles.successBox}>
                        <Text style={styles.successTitle}>Team Created</Text>
                        <Text style={styles.successText}>Name: {createdTeam.Name}</Text>
                        <Text style={styles.successText}>Team ID: {createdTeam.TeamId}</Text>
                        <Text style={styles.successHint}>You are now a team leader for this team.</Text>
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
                    editable={!submitting}
                />

                <View style={styles.buttonRow}>
                    <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={() => navigation.goBack()}>
                        <Text style={styles.actionText}>Back</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.actionButton, styles.submitButton, submitting && styles.disabledButton]}
                        onPress={handleCreateTeam}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.actionText}>Create Team</Text>
                        )}
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a2e',
    },
    content: {
        padding: 16,
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
    actionText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    error: {
        color: '#ff667f',
        marginBottom: 6,
        textAlign: 'center',
    },
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
        fontWeight: '700',
        marginBottom: 4,
    },
    successText: {
        color: '#e0e0e0',
        fontSize: 13,
        marginBottom: 2,
    },
    successHint: {
        color: '#a0a0c0',
        fontSize: 12,
        marginTop: 6,
    },
});
