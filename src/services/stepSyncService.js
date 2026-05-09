import { AppState, Platform, PermissionsAndroid } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AppleHealthKit from 'react-native-health';
import { initialize, requestPermission, readRecords } from 'react-native-health-connect';
import * as api from '../api';

const STEP_SYNC_ANCHOR_KEY = 'stepSyncAnchorUtc';
const HISTORY_LOOKBACK_MS = 24 * 60 * 60 * 1000;

let intervalHandle = null;
let appStateHandle = null;
let inFlight = false;
let hasInitializedAppleHealthKit = false;
let hasInitializedHealthConnect = false;

function normalizeDate(value) {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed;
}

function buildClientEventId(anchorIso, endIso, stepCount) {
    return `${anchorIso}|${endIso}|${stepCount}`;
}

function getHistoryAnchor(accountCreatedAtIso) {
    const now = Date.now();
    const oldestAllowedDate = new Date(now - HISTORY_LOOKBACK_MS);

    const accountCreatedAt = normalizeDate(accountCreatedAtIso);
    if (!accountCreatedAt) {
        return oldestAllowedDate;
    }

    return accountCreatedAt > oldestAllowedDate ? accountCreatedAt : oldestAllowedDate;
}

function clampAnchorDate(anchorDate, accountCreatedAtIso) {
    const fallbackAnchor = getHistoryAnchor(accountCreatedAtIso);

    if (!anchorDate) {
        return fallbackAnchor;
    }

    return anchorDate > fallbackAnchor ? anchorDate : fallbackAnchor;
}

async function initializeAppleHealthKit() {
    if (hasInitializedAppleHealthKit) {
        console.log('[StepSync] HealthKit already initialized.');
        return;
    }

    console.log('[StepSync] Initializing HealthKit...');
    await new Promise((resolve, reject) => {
        AppleHealthKit.initHealthKit(
            {
                permissions: {
                    read: [
                        AppleHealthKit.Constants.Permissions.StepCount,
                    ],
                    write: [],
                },
            },
            (error) => {
                if (error) {
                    console.warn('[StepSync] HealthKit init failed:', error);
                    reject(new Error(error));
                    return;
                }

                console.log('[StepSync] HealthKit initialized successfully.');
                resolve();
            }
        );
    });

    hasInitializedAppleHealthKit = true;
}

async function readIosStepHistory(startDate, endDate) {
    console.log('[StepSync] Reading iOS HealthKit step history from', startDate.toISOString(), 'to', endDate.toISOString());
    await initializeAppleHealthKit();

    const samples = await new Promise((resolve, reject) => {
        AppleHealthKit.getDailyStepCountSamples(
            {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                ascending: true,
                includeManuallyAdded: false,
                period: 1,
            },
            (error, results) => {
                if (error) {
                    console.warn('[StepSync] HealthKit getDailyStepCountSamples failed:', error);
                    reject(new Error(error));
                    return;
                }

                console.log('[StepSync] HealthKit samples:', results);
                resolve(results ?? []);
            }
        );
    });

    const total = Array.isArray(samples)
        ? samples.reduce((total, sample) => total + Math.max(0, Math.trunc(Number(sample?.value ?? 0))), 0)
        : 0;
    
    console.log('[StepSync] iOS HealthKit total steps:', total);
    return total;
}

async function initializeHealthConnectClient() {
    if (!hasInitializedHealthConnect) {
        console.log('[StepSync] Initializing Health Connect...');
        try {
            await initialize();
            console.log('[StepSync] Health Connect initialized.');
            hasInitializedHealthConnect = true;
        } catch (error) {
            console.warn('[StepSync] Health Connect initialization failed:', error);
            throw error;
        }
    }
}

async function requestHealthConnectPermissions() {
    console.log('[StepSync] Requesting Health Connect permissions for Steps...');
    try {
        // Request runtime permission on Android
        if (Platform.OS === 'android') {
            console.log('[StepSync] Android detected. Requesting ACTIVITY_RECOGNITION runtime permission...');
            const activityGranted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
                {
                    title: 'Activity Recognition Permission',
                    message: 'Willbinders needs access to your activity/step data.',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'OK',
                }
            );
            console.log('[StepSync] ACTIVITY_RECOGNITION permission result:', activityGranted);
            
            if (activityGranted !== PermissionsAndroid.RESULTS.GRANTED) {
                console.warn('[StepSync] ACTIVITY_RECOGNITION permission not granted');
            }
        }

        console.log('[StepSync] Runtime permissions checked. Proceeding with Health Connect read.');
    } catch (error) {
        console.warn('[StepSync] Permission request error:', error);
        throw error;
    }
}

async function readAndroidStepHistory(startDate, endDate) {
    console.log('[StepSync] Reading Android Health Connect step history from', startDate.toISOString(), 'to', endDate.toISOString());
    await initializeHealthConnectClient();
    await requestHealthConnectPermissions();

    let pageToken;
    let totalSteps = 0;

    try {
        do {
            console.log('[StepSync] Fetching Health Connect records. Page token:', pageToken ?? 'none');
            
            const result = await readRecords('Steps', {
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startDate.toISOString(),
                    endTime: endDate.toISOString(),
                },
                ascendingOrder: true,
                pageSize: 1000,
                pageToken,
            });

            console.log('[StepSync] Health Connect result:', result);
            
            const records = Array.isArray(result?.records) ? result.records : [];
            const pageSteps = records.reduce((sum, record) => sum + Math.max(0, Math.trunc(Number(record?.count ?? 0))), 0);
            
            console.log('[StepSync] Records on this page:', records.length, 'Steps:', pageSteps);
            totalSteps += pageSteps;
            pageToken = result?.pageToken;
        } while (pageToken);
    } catch (error) {
        const errorMessage = String(error ?? '');
        const isSecurityError = errorMessage.includes('SecurityException') || errorMessage.includes('permission');
        
        if (isSecurityError) {
            console.warn('[StepSync] Health Connect permission error. User must grant permissions in Health Connect app settings.');
            console.warn('[StepSync] Error:', error);
            throw new Error(
                'Health Connect permissions not granted. ' +
                'Please open the Health Connect app, grant Willbinders permission to read Steps, and try again.'
            );
        }
        
        console.warn('[StepSync] Health Connect readRecords failed:', error);
        throw error;
    }

    console.log('[StepSync] Android Health Connect total steps:', totalSteps);
    return totalSteps;
}

async function readHistoricalSteps(startDate, endDate) {
    const platformString = Platform.OS;
    console.log('[StepSync] readHistoricalSteps called. platformString:', platformString);
    
    if (platformString === 'ios') {
        console.log('[StepSync] Calling readIosStepHistory.');
        return await readIosStepHistory(startDate, endDate);
    }

    if (platformString === 'android') {
        console.log('[StepSync] Calling readAndroidStepHistory.');
        return await readAndroidStepHistory(startDate, endDate);
    }

    console.warn('[StepSync] Unknown platform:', platformString);
    return 0;
}

async function syncOnce(accountCreatedAtIso) {
    if (inFlight) {
        console.log('[StepSync] Sync already in flight, skipping.');
        return;
    }

    inFlight = true;
    console.log('[StepSync] Starting sync. Platform:', Platform.OS, 'Account created:', accountCreatedAtIso);
    try {
        const storedAnchorIso = await SecureStore.getItemAsync(STEP_SYNC_ANCHOR_KEY);
        console.log('[StepSync] Stored anchor:', storedAnchorIso);
        
        const anchorDate = clampAnchorDate(normalizeDate(storedAnchorIso), accountCreatedAtIso);
        console.log('[StepSync] Clamped anchor date:', anchorDate?.toISOString());

        const now = new Date();
        console.log('[StepSync] Current time:', now.toISOString());
        
        if (now <= anchorDate) {
            console.log('[StepSync] No time has passed since last sync, skipping.');
            return;
        }

        console.log('[StepSync] Reading step history from', anchorDate.toISOString(), 'to', now.toISOString());
        const sampledSteps = await readHistoricalSteps(anchorDate, now);
        console.log('[StepSync] Steps read:', sampledSteps);
        
        const anchorIso = anchorDate.toISOString();
        const nowIso = now.toISOString();

        if (sampledSteps <= 0) {
            console.log('[StepSync] No steps found, updating anchor and skipping backend call.');
            await SecureStore.setItemAsync(STEP_SYNC_ANCHOR_KEY, nowIso);
            return;
        }

        const events = [
            {
                clientEventId: buildClientEventId(anchorIso, nowIso, sampledSteps),
                windowStart: anchorIso,
                windowEnd: nowIso,
                stepCount: sampledSteps,
            },
        ];

        console.log('[StepSync] Built events:', JSON.stringify(events, null, 2));
        console.log('[StepSync] Sending sync request to backend...');
        
        const response = await api.syncSteps(events, nowIso, Platform.OS, 'mobile');
        console.log('[StepSync] Backend response:', JSON.stringify(response, null, 2));
        
        const syncToIso = normalizeDate(response?.SyncTo)?.toISOString() ?? nowIso;
        await SecureStore.setItemAsync(STEP_SYNC_ANCHOR_KEY, syncToIso);
        console.log('[StepSync] Sync complete. Updated anchor to:', syncToIso);
    } catch (error) {
        const errorMsg = String(error?.message ?? error ?? '');
        if (errorMsg.includes('Health Connect permissions not granted')) {
            console.warn('[StepSync] ⚠️ HEALTH CONNECT SETUP NEEDED');
            console.warn('[StepSync] Please open the Health Connect app on your device');
            console.warn('[StepSync] Grant Willbinders permission to read Steps data');
            console.warn('[StepSync] Then return to Willbinders and try logging in again');
        } else {
            console.warn('[StepSync] Automatic step sync failed.', error);
            console.warn('[StepSync] Error details:', errorMsg);
        }
    } finally {
        inFlight = false;
    }
}

export function stopAutoStepSync() {
    console.log('[StepSync] Stopping auto step sync.');
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }

    if (appStateHandle) {
        appStateHandle.remove();
        appStateHandle = null;
    }
}

export function startAutoStepSync(accountCreatedAtIso) {
    console.log('[StepSync] Starting auto step sync. Account created:', accountCreatedAtIso);
    stopAutoStepSync();

    void syncOnce(accountCreatedAtIso);

    intervalHandle = setInterval(() => {
        console.log('[StepSync] Periodic sync triggered (every 2 minutes).');
        void syncOnce(accountCreatedAtIso);
    }, 120000);

    appStateHandle = AppState.addEventListener('change', (state) => {
        console.log('[StepSync] App state changed:', state);
        if (state === 'active') {
            console.log('[StepSync] App is active, triggering sync.');
            void syncOnce(accountCreatedAtIso);
        }
    });
}
