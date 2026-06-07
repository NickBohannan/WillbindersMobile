import React, { useState } from 'react';
import {
    SafeAreaView,
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

    if (!fontsLoaded) {
        return null;
    }

    return (
        <ImageBackground source={MENU_BACKGROUND} style={styles.background} imageStyle={styles.backgroundImage}>
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
                        <Pressable
                            style={styles.successAction}
                            onPress={() => navigation.navigate('CreateCharacter', { initialTeamId: createdTeam.TeamId })}
                        >
                            <Text style={styles.successActionText}>Create Character for This Team</Text>
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
    content: {
        padding: 16,
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
    successAction: {
        marginTop: 10,
        backgroundColor: '#e94560',
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
    },
    successActionText: { color: '#fff', fontSize: 14, fontFamily: MODULE_FONT_FAMILY },
});
