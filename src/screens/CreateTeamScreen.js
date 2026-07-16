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
    Modal,
} from 'react-native';
import * as api from '../api';
import { useAlagardFont, MODULE_FONT_FAMILY } from '../hooks/useAlagardFont';

const MENU_BACKGROUND = require('../../assets/menu-background2.png');

export default function CreateTeamScreen({ navigation }) {
    const [fontsLoaded] = useAlagardFont();
    const [teamName, setTeamName] = useState('');
    const [characterName, setCharacterName] = useState('');
    const [mapTemplates, setMapTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [selectedTemplateZoneId, setSelectedTemplateZoneId] = useState('');
    const [selectedMapId, setSelectedMapId] = useState('');
    const [selectedZoneId, setSelectedZoneId] = useState('');
    const [isTemplateDropdownVisible, setIsTemplateDropdownVisible] = useState(false);
    const [isTemplateZoneDropdownVisible, setIsTemplateZoneDropdownVisible] = useState(false);
    const [loadingSetup, setLoadingSetup] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState('');
    const [createdTeam, setCreatedTeam] = useState(null);

    useEffect(() => {
        async function loadInitialData() {
            try {
                const templateData = await api.getMapTemplates();
                const loadedTemplates = Array.isArray(templateData) ? templateData : [];

                setMapTemplates(loadedTemplates);
                if (loadedTemplates.length > 0) {
                    setSelectedTemplateId(loadedTemplates[0].MapTemplateId);
                }
            } catch (e) {
                setError(e.message || 'Failed to load map templates.');
            } finally {
                setLoadingSetup(false);
            }
        }

        loadInitialData();
    }, []);

    useEffect(() => {
        const selectedTemplate = mapTemplates.find((template) => template.MapTemplateId === selectedTemplateId) || null;
        const templateZones = Array.isArray(selectedTemplate?.ZoneTemplates) ? selectedTemplate.ZoneTemplates : [];

        if (templateZones.length === 0) {
            setSelectedTemplateZoneId('');
            return;
        }

        const zoneStillValid = templateZones.some((zone) => zone.ZoneTemplateId === selectedTemplateZoneId);
        if (!zoneStillValid) {
            setSelectedTemplateZoneId(templateZones[0].ZoneTemplateId);
        }
    }, [mapTemplates, selectedTemplateId, selectedTemplateZoneId]);

    const selectedTemplate = mapTemplates.find((template) => template.MapTemplateId === selectedTemplateId) || null;
    const selectedTemplateZone = selectedTemplate?.ZoneTemplates?.find((zone) => zone.ZoneTemplateId === selectedTemplateZoneId) || null;

    async function handleCreateTeamAndCharacter() {
        const trimmedName = teamName.trim();
        if (!createdTeam && !trimmedName) {
            setError('Team name is required.');
            return;
        }

        if (!selectedTemplateId || !selectedTemplateZoneId) {
            setError('Pick a map template and zone before creating your team character.');
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

            const templateName = selectedTemplate?.Name || 'Template Map';
            const mapName = `${templateName} Live`;
            const createdMap = await api.createMapFromTemplate(mapName, selectedTemplateId, true);
            const createdMapId = createdMap?.MapId;
            if (!createdMapId) {
                throw new Error('Map was created but no map ID was returned.');
            }

            const createdZones = await api.getZonesByMap(createdMapId);
            const liveZones = Array.isArray(createdZones) ? createdZones : [];
            const selectedZoneName = selectedTemplateZone?.Name || '';
            const selectedLiveZone = liveZones.find((zone) => zone.Name === selectedZoneName) || liveZones[0] || null;

            if (!selectedLiveZone?.Id) {
                throw new Error('Map was created but no starting zone was returned.');
            }

            setSelectedMapId(createdMapId);
            setSelectedZoneId(selectedLiveZone.Id);

            await api.createCharacter(characterName.trim(), teamForSubmission.TeamId, selectedLiveZone.Id, createdMapId);
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
                        <Text style={styles.successHint}>Now choose a map template and zone to finish creating your character.</Text>
                    </View>
                )}

                <Text style={styles.label}>Map Template</Text>
                <View style={styles.templateCard}>
                    <Pressable
                        style={styles.dropdownButton}
                        onPress={() => setIsTemplateDropdownVisible(true)}
                        disabled={submitting || mapTemplates.length === 0}
                    >
                        <Text style={styles.dropdownButtonLabel}>Map Template</Text>
                        <Text style={styles.dropdownButtonValue} numberOfLines={1}>
                            {selectedTemplate?.Name || 'Select a template'}
                        </Text>
                    </Pressable>

                    <Pressable
                        style={[
                            styles.dropdownButton,
                            !selectedTemplate ? styles.dropdownButtonDisabled : null,
                        ]}
                        onPress={() => setIsTemplateZoneDropdownVisible(true)}
                        disabled={submitting || !selectedTemplate || (selectedTemplate?.ZoneTemplates?.length ?? 0) === 0}
                    >
                        <Text style={styles.dropdownButtonLabel}>Zones</Text>
                        <Text style={styles.dropdownButtonValue} numberOfLines={1}>
                            {selectedTemplateZone ? `${selectedTemplateZone.ZoneOrder}. ${selectedTemplateZone.Name}` : 'Select a map template first'}
                        </Text>
                    </Pressable>

                    <Text style={styles.templateMeta}>
                        {selectedTemplate ? `${selectedTemplate.ZoneCount} zone(s)` : 'Template data loaded from the server'}
                    </Text>
                    {selectedTemplate?.Description ? (
                        <Text style={styles.templateDescription}>{selectedTemplate.Description}</Text>
                    ) : null}
                </View>

                <Modal
                    visible={isTemplateDropdownVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setIsTemplateDropdownVisible(false)}
                >
                    <Pressable style={styles.modalBackdrop} onPress={() => setIsTemplateDropdownVisible(false)}>
                        <Pressable style={styles.modalCard} onPress={() => { }}>
                            <Text style={styles.modalTitle}>Choose Map Template</Text>
                            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
                                {mapTemplates.map((template) => {
                                    const selected = template.MapTemplateId === selectedTemplateId;
                                    return (
                                        <Pressable
                                            key={template.MapTemplateId}
                                            style={[styles.modalItem, selected && styles.modalItemSelected]}
                                            onPress={() => {
                                                setSelectedTemplateId(template.MapTemplateId);
                                                setIsTemplateDropdownVisible(false);
                                            }}
                                        >
                                            <Text style={[styles.modalItemTitle, selected && styles.modalItemTitleSelected]} numberOfLines={1}>
                                                {template.Name || template.MapTemplateId}
                                            </Text>
                                            <Text style={styles.modalItemMeta}>{template.ZoneCount} zones</Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                            <Pressable style={styles.modalCloseButton} onPress={() => setIsTemplateDropdownVisible(false)}>
                                <Text style={styles.modalCloseText}>Close</Text>
                            </Pressable>
                        </Pressable>
                    </Pressable>
                </Modal>

                <Modal
                    visible={isTemplateZoneDropdownVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setIsTemplateZoneDropdownVisible(false)}
                >
                    <Pressable style={styles.modalBackdrop} onPress={() => setIsTemplateZoneDropdownVisible(false)}>
                        <Pressable style={styles.modalCard} onPress={() => { }}>
                            <Text style={styles.modalTitle}>Choose Zone</Text>
                            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
                                {(selectedTemplate?.ZoneTemplates || []).map((zone) => {
                                    const selected = zone.ZoneTemplateId === selectedTemplateZoneId;
                                    return (
                                        <Pressable
                                            key={zone.ZoneTemplateId}
                                            style={[styles.modalItem, selected && styles.modalItemSelected]}
                                            onPress={() => {
                                                setSelectedTemplateZoneId(zone.ZoneTemplateId);
                                                setIsTemplateZoneDropdownVisible(false);
                                            }}
                                        >
                                            <Text style={[styles.modalItemTitle, selected && styles.modalItemTitleSelected]} numberOfLines={1}>
                                                {zone.ZoneOrder}. {zone.Name}
                                            </Text>
                                            <Text style={styles.modalItemMeta}>{zone.MaxControlPoints} control points</Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                            <Pressable style={styles.modalCloseButton} onPress={() => setIsTemplateZoneDropdownVisible(false)}>
                                <Text style={styles.modalCloseText}>Close</Text>
                            </Pressable>
                        </Pressable>
                    </Pressable>
                </Modal>

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
