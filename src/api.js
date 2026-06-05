import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'http://192.168.1.6:5075';
let inMemoryToken = null;

export function setAuthToken(token) {
    inMemoryToken = typeof token === 'string' ? token.trim() : null;
}

export function clearAuthToken() {
    inMemoryToken = null;
}

async function getToken() {
    if (inMemoryToken) {
        return inMemoryToken;
    }

    const persistedToken = await SecureStore.getItemAsync('token');
    const normalized = typeof persistedToken === 'string' ? persistedToken.trim() : '';

    if (normalized) {
        inMemoryToken = normalized;
        return normalized;
    }

    return null;
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
        if (response.status === 401) {
            throw new Error('HTTP 401: Unauthorized (missing/expired token).');
        }

        const text = await response.text();
        const apiError = new Error(text || `HTTP ${response.status}`);

        if (text) {
            try {
                const parsed = JSON.parse(text);
                if (parsed && typeof parsed === 'object') {
                    if (typeof parsed.Message === 'string' && parsed.Message.trim()) {
                        apiError.message = parsed.Message;
                    }

                    if (typeof parsed.Code === 'string' && parsed.Code.trim()) {
                        apiError.code = parsed.Code;
                    }
                }
            } catch {
                // Keep raw text fallback.
            }
        }

        throw apiError;
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

export const getHallOfLegends = (userId) =>
    request('GET', `/api/RealmData/HallOfLegends/${userId}`);

export const getAllTeams = () =>
    request('GET', '/api/RealmData/GetAllTeamsAsync');

export const getMyLedTeams = () =>
    request('GET', '/api/RealmData/GetMyLedTeamsAsync');

export const getAllMaps = () =>
    request('GET', '/api/RealmData/GetAllMapsAsync');

export const getTestMaps = () =>
    request('GET', '/api/RealmData/GetTestMapsAsync');

export const getZonesByMap = (mapId) =>
    request('GET', `/api/RealmData/GetZonesByMapAsync/${mapId}`);

export const createTeam = (name) =>
    request('POST', '/api/RealmData/CreateTeamAsync', { name });

// Team invitations and join requests
export const inviteAccountToTeam = (teamId, accountId) =>
    request('POST', '/api/RealmData/InviteAccountToTeam', { teamId, accountId });

export const requestToJoinTeam = (teamLeaderId) =>
    request('POST', '/api/RealmData/RequestToJoinTeam', { teamLeaderId });

export const respondToInvite = (inviteId, response) =>
    request('PUT', '/api/RealmData/RespondToInvite', { inviteId, response });

export const respondToJoinRequest = (requestId, teamId, response) =>
    request('PUT', '/api/RealmData/RespondToJoinRequest', { requestId, teamId, response });

export const getPendingInvites = () =>
    request('GET', '/api/RealmData/GetPendingInvites');

export const getPendingJoinRequests = () =>
    request('GET', '/api/RealmData/GetPendingJoinRequests');

export const cancelInvite = (inviteId) =>
    request('POST', `/api/RealmData/CancelInvite/${inviteId}`);

export const createMapChallengeInvite = (mapId, inviterTeamId, inviteeTeamId) =>
    request('POST', '/api/RealmData/CreateMapChallengeInvite', { mapId, inviterTeamId, inviteeTeamId });

export const getPendingMapChallengeInvites = () =>
    request('GET', '/api/RealmData/GetPendingMapChallengeInvites');

export const respondToMapChallengeInvite = (inviteId, response) =>
    request('PUT', '/api/RealmData/RespondToMapChallengeInvite', { inviteId, response });

// Characters
export const createCharacter = (characterName, teamId, currentZone, currentMap) =>
    request('POST', '/api/RealmData/CreateCharacterAsync', { characterName, teamId, currentZone, currentMap });

export const deleteCharacter = (characterId) =>
    request('DELETE', `/api/RealmData/DeleteCharacterAsync/${characterId}`);

export const changeCharacterZone = (characterId, zoneId) =>
    request('PUT', '/api/RealmData/ChangeCharacterZoneAsync', { characterId, zoneId });

export const changeCharacterMap = (characterId, mapId) =>
    request('PUT', '/api/RealmData/ChangeCharacterMapAsync', { characterId, mapId });

export const validateMapStart = (mapId) =>
    request('GET', `/api/RealmData/ValidateMapStartAsync/${mapId}`);

export const startMap = (mapId) =>
    request('POST', '/api/RealmData/StartMapAsync', { mapId });

// Maps
export const getMap = (mapId) =>
    request('GET', `/api/RealmData/GetMapAsync/${mapId}`);

// Control accumulation
export const getControlScoresByMapId = (mapId) =>
    request('GET', `/api/RealmData/GetControlAccumulationScoresByMapAsync/${mapId}`);

// Step sync
export const syncSteps = (events, clientNow, platform, appVersion) =>
    request('POST', '/api/StepCount/Sync', { events, clientNow, platform, appVersion });

// Realtime
export async function createMapControlSocket(mapId) {
    const token = await getToken();
    const wsBase = BASE_URL.replace(/^http/, 'ws');
    const url = `${wsBase}/ws/map-control?mapId=${mapId}${token ? `&access_token=${token}` : ''}`;
    return new WebSocket(url);
}
