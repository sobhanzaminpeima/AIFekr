// Browser-review stand-in for expo-secure-store (see metro.config.js).
// localStorage is not secure storage; this file is only bundled when
// AIFEKR_WEB_PREVIEW=1 for local screen review against a local backend.
const prefix = 'aifekr-preview:';
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY';
export async function getItemAsync(key) { return globalThis.localStorage.getItem(prefix + key); }
export async function setItemAsync(key, value) { globalThis.localStorage.setItem(prefix + key, value); }
export async function deleteItemAsync(key) { globalThis.localStorage.removeItem(prefix + key); }
export async function isAvailableAsync() { return true; }
export function canUseBiometricAuthentication() { return false; }
