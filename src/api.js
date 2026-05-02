import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'http://192.168.1.6:5075';

async function getToken() {
    return await SecureStore.getItemAsync('token');
}

async function request(method, path, body = null) {
    const token = await getToken();

    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${path}`, options);

    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

// Auth
export const login = (email, password) =>
    request('POST', '/api/Auth/login', { email, password });

export const register = (firstName, lastName, email, password) =>
    request('POST', '/api/Auth/register', { firstName, lastName, email, password });

// Characters
export const getCharactersByUserId = (userId) =>
    request('GET', `/api/RealmData/GetAllCharactersByUserIdAsync/${userId}`);

export const getCharactersInMap = (mapId) =>
    request('GET', `/api/RealmData/GetAllCharactersInMapAsync/${mapId}`);

export const createCharacter = (teamId, currentZone, currentMap) =>
    request('POST', '/api/RealmData/CreateCharacterAsync', { teamId, currentZone, currentMap });

export const deleteCharacter = (characterId) =>
    request('DELETE', `/api/RealmData/DeleteCharacterAsync/${characterId}`);

// Maps
export const getMap = (mapId) =>
    request('GET', `/api/RealmData/GetMapAsync/${mapId}`);

// Control accumulation
export const getControlScoresByMapId = (mapId) =>
    request('GET', `/api/RealmData/GetControlAccumulationScoresByMapAsync/${mapId}`);

// Step count
export const postStepCount = (characterId, stepCount, requestId) =>
    request('POST', '/api/StepCount', { characterId, stepCount, requestId });
