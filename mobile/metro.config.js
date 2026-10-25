// Default Expo config. AIFEKR_WEB_PREVIEW=1 swaps SecureStore for a
// localStorage stand-in on web so screens can be reviewed in a browser;
// it is never set for device builds, which keep Keychain/Keystore storage.
const path = require('path');
const {getDefaultConfig} = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
if (process.env.AIFEKR_WEB_PREVIEW === '1') {
  const resolve = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, name, platform) => {
    if (platform === 'web' && name === 'expo-secure-store') return {type: 'sourceFile', filePath: path.join(__dirname, 'web-preview', 'secureStore.js')};
    return (resolve ?? context.resolveRequest)(context, name, platform);
  };
}
module.exports = config;
