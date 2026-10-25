import type {ConfigContext,ExpoConfig} from 'expo/config';
export default function configuration({config}:ConfigContext):ExpoConfig {
  if(['preview','production'].includes(process.env.EAS_BUILD_PROFILE||'')){
    const raw=process.env.EXPO_PUBLIC_API_URL;
    if(!raw)throw new Error('EXPO_PUBLIC_API_URL is required for an installable preview or production build. Deploy and verify the mobile backend before building.');
    const origin=new URL(raw);
    if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||origin.hostname==='example.com'||origin.hostname.endsWith('.example.com'))throw new Error('EXPO_PUBLIC_API_URL must be a real HTTPS API origin without credentials or a path.');
  }
  const identifier=process.env.MOBILE_APP_IDENTIFIER||'com.aifekr.app';
  const development=process.env.EAS_BUILD_PROFILE==='development';
  return {...config,name:config.name||'AIFekr',slug:config.slug||'aifekr-mobile',ios:{...config.ios,infoPlist:{...config.ios?.infoPlist,NSFaceIDUsageDescription:'Use Face ID to unlock AIFekr when you enable device lock.',NSAppTransportSecurity:{NSAllowsArbitraryLoads:development}},...(identifier?{bundleIdentifier:identifier}:{})},android:{...config.android,blockedPermissions:[...new Set([...(config.android?.blockedPermissions||[]),'android.permission.READ_EXTERNAL_STORAGE','android.permission.WRITE_EXTERNAL_STORAGE','android.permission.READ_MEDIA_IMAGES','android.permission.READ_MEDIA_VIDEO','android.permission.READ_MEDIA_AUDIO'])],...(identifier?{package:identifier}:{})},runtimeVersion:{policy:'appVersion'},...(process.env.EAS_PROJECT_ID?{extra:{...config.extra,eas:{projectId:process.env.EAS_PROJECT_ID}}}:{})};
}

