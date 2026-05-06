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

export const getAllTeams = () =>
    request('GET', '/api/RealmData/GetAllTeamsAsync');

export const getMyLedTeams = () =>
    request('GET', '/api/RealmData/GetMyLedTeamsAsync');

export const getAllMaps = () =>
    request('GET', '/api/RealmData/GetAllMapsAsync');

export const getZonesByMap = (mapId) =>
    request('GET', `/api/RealmData/GetZonesByMapAsync/${mapId}`);

export const createTeam = (name) =>
    request('POST', '/api/RealmData/CreateTeamAsync', { name });

export const createCharacter = (characterName, teamId, currentZone, currentMap) =>
    request('POST', '/api/RealmData/CreateCharacterAsync', { characterName, teamId, currentZone, currentMap });

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

// Realtime
export async function createMapControlSocket(mapId) {
    const token = await getToken();
    const wsBase = BASE_URL.replace(/^http/, 'ws');
    const url = `${wsBase}/ws/map-control?mapId=${mapId}${token ? `&access_token=${token}` : ''}`;
    return new WebSocket(url);
}
