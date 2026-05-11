import { Platform, PermissionsAndroid } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AppleHealthKit from 'react-native-health';
import {
    initialize,
    requestPermission,
    getGrantedPermissions,
    readRecords,
} from 'react-native-health-connect';
import * as api from '../api';

const PREVIOUS_DAY_SYNC_KEY = 'stepSyncPreviousDayKey';
const HEALTH_CONNECT_PERMISSION_RETRY_MS = 15 * 60 * 1000;

let inFlight = false;
let hasInitializedAppleHealthKit = false;
let hasInitializedHealthConnect = false;
let nextHealthConnectPermissionCheckAt = 0;

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

function getPreviousDayWindow(referenceDate) {
    const localTodayMidnight = new Date(referenceDate);
    localTodayMidnight.setHours(0, 0, 0, 0);

    const localYesterdayMidnight = new Date(localTodayMidnight);
    localYesterdayMidnight.setDate(localYesterdayMidnight.getDate() - 1);

    return {
        start: localYesterdayMidnight,
        end: localTodayMidnight,
        dayKey: localYesterdayMidnight.toISOString().slice(0, 10),
    };
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
        const nowMs = Date.now();
        if (nowMs < nextHealthConnectPermissionCheckAt) {
            throw new Error('Health Connect permission retry cooldown active.');
        }

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

        const granted = await getGrantedPermissions();
        const hasStepRead = Array.isArray(granted)
            && granted.some((permission) => permission?.recordType === 'Steps' && permission?.accessType === 'read');

        if (hasStepRead) {
            console.log('[StepSync] Health Connect step permission already granted.');
            nextHealthConnectPermissionCheckAt = 0;
            return;
        }

        const requested = await requestPermission([
            {
                accessType: 'read',
                recordType: 'Steps',
            },
        ]);

        const hasStepReadAfterRequest = Array.isArray(requested)
            && requested.some((permission) => permission?.recordType === 'Steps' && permission?.accessType === 'read');

        if (!hasStepReadAfterRequest) {
            console.warn('[StepSync] Health Connect did not grant Steps permission.');
            nextHealthConnectPermissionCheckAt = nowMs + HEALTH_CONNECT_PERMISSION_RETRY_MS;
            throw new Error('Health Connect steps permission was not granted.');
        }

        console.log('[StepSync] Health Connect Steps permission granted.');
        nextHealthConnectPermissionCheckAt = 0;
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
            console.warn('[StepSync] Health Connect permission error.');
            nextHealthConnectPermissionCheckAt = Date.now() + HEALTH_CONNECT_PERMISSION_RETRY_MS;
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
        return { outcome: 'skipped', reason: 'inFlight' };
    }

    inFlight = true;
    console.log('[StepSync] Starting sync. Platform:', Platform.OS, 'Account created:', accountCreatedAtIso);
    try {
        const now = new Date();
        console.log('[StepSync] Current time:', now.toISOString());

        const previousDayWindow = getPreviousDayWindow(now);
        const windowStart = previousDayWindow.start;
        const windowEnd = previousDayWindow.end;
        const dayKey = previousDayWindow.dayKey;

        const accountCreatedAt = normalizeDate(accountCreatedAtIso);
        if (accountCreatedAt && accountCreatedAt >= windowEnd) {
            console.log('[StepSync] Account created after previous-day window; skipping sync.');
            return { outcome: 'skipped', reason: 'accountTooNew' };
        }

        const previouslySyncedDay = await SecureStore.getItemAsync(PREVIOUS_DAY_SYNC_KEY);
        if (previouslySyncedDay === dayKey) {
            console.log('[StepSync] Previous day already synced for', dayKey, '- skipping.');
            return { outcome: 'skipped', reason: 'alreadySynced' };
        }

        console.log('[StepSync] Reading previous-day step history from', windowStart.toISOString(), 'to', windowEnd.toISOString());
        const sampledSteps = await readHistoricalSteps(windowStart, windowEnd);
        console.log('[StepSync] Steps read:', sampledSteps);

        const windowStartIso = windowStart.toISOString();
        const windowEndIso = windowEnd.toISOString();
        const nowIso = now.toISOString();

        if (sampledSteps <= 0) {
            console.log('[StepSync] No previous-day steps found, marking day as synced and skipping backend call.');
            await SecureStore.setItemAsync(PREVIOUS_DAY_SYNC_KEY, dayKey);
            return { outcome: 'skipped', reason: 'noSteps' };
        }

        const events = [
            {
                clientEventId: buildClientEventId(windowStartIso, windowEndIso, sampledSteps),
                windowStart: windowStartIso,
                windowEnd: windowEndIso,
                stepCount: sampledSteps,
            },
        ];

        console.log('[StepSync] Built events:', JSON.stringify(events, null, 2));
        console.log('[StepSync] Sending sync request to backend...');

        const response = await api.syncSteps(events, nowIso, Platform.OS, 'mobile');
        console.log('[StepSync] Backend response:', JSON.stringify(response, null, 2));

        await SecureStore.setItemAsync(PREVIOUS_DAY_SYNC_KEY, dayKey);
        console.log('[StepSync] Sync complete. Marked previous day as synced:', dayKey);
        return {
            outcome: 'success',
            stepCount: sampledSteps,
            powerGained: response?.AppliedStepDelta ?? 0,
        };
    } catch (error) {
        const errorMsg = String(error?.message ?? error ?? '');
        if (
            errorMsg.includes('Health Connect permissions not granted')
            || errorMsg.includes('steps permission was not granted')
            || errorMsg.includes('permission retry cooldown active')
        ) {
            console.warn('[StepSync] ⚠️ HEALTH CONNECT SETUP NEEDED');
            return {
                outcome: 'error',
                reason: 'permission',
                message: 'Health Connect permission is required. Open Health Connect, grant Willbinders permission to read Steps, then log in again.',
            };
        } else if (errorMsg.includes('HTTP 401')) {
            console.warn('[StepSync] ⚠️ STEP SYNC UNAUTHORIZED');
            return {
                outcome: 'error',
                reason: 'unauthorized',
                message: 'Your session expired. Sign out and log back in to sync your steps.',
            };
        } else {
            console.warn('[StepSync] Step sync failed.', error);
            return {
                outcome: 'error',
                reason: 'unknown',
                message: 'Step sync failed. Try logging in again.',
            };
        }
    } finally {
        inFlight = false;
    }
}

export async function syncStepsOnLogin(accountCreatedAtIso) {
    return await syncOnce(accountCreatedAtIso);
}
