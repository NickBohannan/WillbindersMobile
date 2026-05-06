import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import SelectCharacterScreen from './src/screens/SelectCharacterScreen';
import CreateCharacterScreen from './src/screens/CreateCharacterScreen';
import CreateTeamScreen from './src/screens/CreateTeamScreen';
import MyTeamsScreen from './src/screens/MyTeamsScreen';
import CharacterMapScreen from './src/screens/CharacterMapScreen';
import StepCountScreen from './src/screens/StepCountScreen';

const Stack = createNativeStackNavigator();

function RootNavigator() {
    const { token, loading } = useAuth();

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#e94560" />
            </View>
        );
    }

    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {token ? (
                <Stack.Group>
                    <Stack.Screen name="Home" component={HomeScreen} />
                    <Stack.Screen name="SelectCharacter" component={SelectCharacterScreen} />
                    <Stack.Screen name="CreateCharacter" component={CreateCharacterScreen} />
                    <Stack.Screen name="CreateTeam" component={CreateTeamScreen} />
                    <Stack.Screen name="MyTeams" component={MyTeamsScreen} />
                    <Stack.Screen name="CharacterMap" component={CharacterMapScreen} />
                    <Stack.Screen name="StepCount" component={StepCountScreen} />
                </Stack.Group>
            ) : (
                <Stack.Group>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Register" component={RegisterScreen} />
                </Stack.Group>
            )}
        </Stack.Navigator>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <NavigationContainer>
                <RootNavigator />
                <StatusBar style="light" />
            </NavigationContainer>
        </AuthProvider>
    );
}
