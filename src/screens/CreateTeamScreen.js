import React, { useState } from 'react';
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
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState('');
    const [createdTeam, setCreatedTeam] = useState(null);

    async function handleCreateTeam() {
        const trimmedName = teamName.trim();
        if (!trimmedName) {
            setError('Team name is required.');
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccess('');

        try {
            const newTeam = await api.createTeam(trimmedName);
            if (!newTeam?.TeamId) {
                throw new Error('Team was created but no team ID was returned.');
            }

            setCreatedTeam(newTeam);
            setSuccess('Team created successfully.');
            setTeamName('');
        } catch (e) {
            setError(e.message || 'Failed to create team.');
        } finally {
            setSubmitting(false);
        }
    }

    if (!fontsLoaded) {
        return null;
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
                        <Text style={styles.successHint}>Create team is complete. Character and map selection happen in the next step.</Text>
                        <Pressable
                            style={[styles.actionButton, styles.submitButton, { marginTop: 10, marginLeft: 0 }]}
                            onPress={() => navigation.navigate('CreateCharacter', { initialTeamId: createdTeam.TeamId })}
                        >
                            <Text style={styles.actionText}>Go To Create Character</Text>
                        </Pressable>
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
                        onPress={handleCreateTeam}
                        disabled={submitting || !!createdTeam?.TeamId}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.actionText}>{createdTeam?.TeamId ? 'Team Created' : 'Create Team'}</Text>
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
    templateCard: {
        backgroundColor: '#16213e',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#0f3460',
        padding: 12,
        marginBottom: 10,
    },
    dropdownButton: {
        backgroundColor: '#10182f',
        borderWidth: 1,
        borderColor: '#0f3460',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
    },
    dropdownButtonDisabled: {
        opacity: 0.65,
    },
    dropdownButtonLabel: {
        color: '#a0a0c0',
        fontSize: 11,
        marginBottom: 3,
        fontFamily: MODULE_FONT_FAMILY,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    dropdownButtonValue: {
        color: '#e0e0e0',
        fontSize: 14,
        fontFamily: MODULE_FONT_FAMILY,
    },
    templateTitle: {
        color: '#e0e0e0',
        fontSize: 16,
        marginBottom: 4,
        fontFamily: MODULE_FONT_FAMILY,
    },
    templateMeta: {
        color: '#a0a0c0',
        fontSize: 12,
        marginBottom: 8,
        fontFamily: MODULE_FONT_FAMILY,
    },
    templateDescription: {
        color: '#c7cbe3',
        fontSize: 12,
        marginBottom: 10,
        fontFamily: MODULE_FONT_FAMILY,
    },
    zoneCountText: {
        color: '#a0a0c0',
        fontSize: 11,
        marginTop: 4,
        fontFamily: MODULE_FONT_FAMILY,
    },
    templateZoneHeader: {
        color: '#a0a0c0',
        fontSize: 12,
        marginTop: 2,
        marginBottom: 8,
        fontFamily: MODULE_FONT_FAMILY,
    },
    zoneList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    zonePill: {
        backgroundColor: '#10182f',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#0f3460',
        paddingHorizontal: 10,
        paddingVertical: 7,
        marginRight: 8,
        marginBottom: 8,
    },
    zonePillText: {
        color: '#e0e0e0',
        fontSize: 12,
        fontFamily: MODULE_FONT_FAMILY,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.72)',
        justifyContent: 'center',
        padding: 16,
    },
    modalCard: {
        backgroundColor: '#16213e',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#0f3460',
        padding: 14,
        maxHeight: '80%',
    },
    modalTitle: {
        color: '#e0e0e0',
        fontSize: 18,
        marginBottom: 10,
        fontFamily: MODULE_FONT_FAMILY,
        textAlign: 'center',
    },
    modalList: {
        maxHeight: 360,
    },
    modalListContent: {
        paddingBottom: 4,
    },
    modalItem: {
        backgroundColor: '#10182f',
        borderWidth: 1,
        borderColor: '#0f3460',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
    },
    modalItemSelected: {
        borderColor: '#e94560',
        backgroundColor: '#213051',
    },
    modalItemTitle: {
        color: '#e0e0e0',
        fontSize: 14,
        fontFamily: MODULE_FONT_FAMILY,
    },
    modalItemTitleSelected: {
        color: '#fff',
    },
    modalItemMeta: {
        color: '#a0a0c0',
        fontSize: 11,
        marginTop: 3,
        fontFamily: MODULE_FONT_FAMILY,
    },
    modalCloseButton: {
        backgroundColor: '#0f3460',
        borderRadius: 8,
        paddingVertical: 11,
        alignItems: 'center',
        marginTop: 8,
    },
    modalCloseText: {
        color: '#fff',
        fontFamily: MODULE_FONT_FAMILY,
    },
    statusSuccessText: { color: '#7ce38b', marginBottom: 6, textAlign: 'center', fontFamily: MODULE_FONT_FAMILY },
    warning: { color: '#f6df87', marginBottom: 8, textAlign: 'center', fontFamily: MODULE_FONT_FAMILY },
});
