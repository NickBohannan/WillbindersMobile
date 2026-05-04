import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    SafeAreaView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';

export default function SelectCharacterScreen({ navigation }) {
    const { userId } = useAuth();
    const [characters, setCharacters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function load() {
            try {
                const data = await api.getCharactersByUserId(userId);
                setCharacters(data?.Characters ?? []);
            } catch (e) {
                setError(e.message || 'Failed to load characters.');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [userId]);

    function handleEnterMap(character) {
        navigation.navigate('CharacterMap', { character });
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
            <Text style={styles.title}>Your Characters</Text>

            {error && <Text style={styles.error}>{error}</Text>}

            {!error && characters.length === 0 && (
                <Text style={styles.empty}>No characters found for your account.</Text>
            )}

            <FlatList
                data={characters}
                keyExtractor={(item) => item.CharacterId}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <Text style={styles.cardName} numberOfLines={1} ellipsizeMode="tail">
                            {item.CharacterName || 'Unnamed Character'}
                        </Text>
                        <Text style={styles.cardId} numberOfLines={1} ellipsizeMode="middle">
                            ID: {item.CharacterId}
                        </Text>
                        <View style={styles.row}>
                            <Text style={styles.label}>Team</Text>
                            <Text style={styles.value} numberOfLines={1} ellipsizeMode="middle">
                                {item.TeamName || item.TeamId}
                            </Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Power</Text>
                            <Text style={styles.value}>{item.Power}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Experience</Text>
                            <Text style={styles.value}>{item.Experience}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Zone</Text>
                            <Text style={styles.value} numberOfLines={1} ellipsizeMode="middle">{item.CurrentZone}</Text>
                        </View>
                        <Pressable style={styles.button} onPress={() => handleEnterMap(item)}>
                            <Text style={styles.buttonText}>Enter Map</Text>
                        </Pressable>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e' },
    centered: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#e0e0e0',
        textAlign: 'center',
        paddingTop: 24,
        paddingBottom: 12,
    },
    list: { padding: 16 },
    card: {
        backgroundColor: '#16213e',
        borderRadius: 10,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#0f3460',
    },
    cardName: { color: '#e0e0e0', fontSize: 16, fontWeight: '700', marginBottom: 6 },
    cardId: { color: '#a0a0c0', fontSize: 12, marginBottom: 8 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    label: { color: '#a0a0c0', fontSize: 14 },
    value: { color: '#e0e0e0', fontSize: 14, flexShrink: 1, marginLeft: 8, textAlign: 'right' },
    button: {
        backgroundColor: '#e94560',
        borderRadius: 8,
        padding: 10,
        alignItems: 'center',
        marginTop: 12,
    },
    buttonText: { color: '#fff', fontWeight: 'bold' },
    error: { color: '#e94560', textAlign: 'center', padding: 16 },
    empty: { color: '#a0a0c0', textAlign: 'center', padding: 16 },
});
