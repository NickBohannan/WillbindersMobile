import React, { useCallback, useState } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    FlatList,
    Pressable,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../api';

export default function MyTeamsScreen({ navigation }) {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadTeams = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getMyLedTeams();
            setTeams(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e.message || 'Failed to load your teams.');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadTeams();
        }, [loadTeams])
    );

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#e94560" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.title}>My Teams</Text>

            {error && <Text style={styles.error}>{error}</Text>}

            {!error && teams.length === 0 && (
                <Text style={styles.empty}>You are not a leader of any team yet.</Text>
            )}

            <FlatList
                data={teams}
                keyExtractor={(item) => item.Id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <Text style={styles.cardName} numberOfLines={1} ellipsizeMode="tail">
                            {item.Name || 'Unnamed Team'}
                        </Text>
                        <Text style={styles.cardId} numberOfLines={1} ellipsizeMode="middle">
                            Team ID: {item.Id}
                        </Text>
                    </View>
                )}
                ListFooterComponent={
                    <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.backButtonText}>Back</Text>
                    </Pressable>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a2e',
    },
    centered: {
        flex: 1,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#e0e0e0',
        textAlign: 'center',
        paddingTop: 24,
        paddingBottom: 12,
    },
    list: {
        padding: 16,
        paddingBottom: 30,
    },
    card: {
        backgroundColor: '#16213e',
        borderRadius: 10,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#0f3460',
    },
    cardName: {
        color: '#e0e0e0',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 6,
    },
    cardId: {
        color: '#a0a0c0',
        fontSize: 12,
    },
    error: {
        color: '#e94560',
        textAlign: 'center',
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    empty: {
        color: '#a0a0c0',
        textAlign: 'center',
        padding: 16,
    },
    backButton: {
        backgroundColor: '#0f3460',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    backButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
});
