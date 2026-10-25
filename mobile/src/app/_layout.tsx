import { Stack } from 'expo-router';
import {Platform} from 'react-native';
import {useFonts,Vazirmatn_400Regular,Vazirmatn_500Medium,Vazirmatn_700Bold} from '@expo-google-fonts/vazirmatn';
import {DeviceLock} from '../components/DeviceLock';
import {PushObserver} from '../components/PushObserver';
export default function Layout() {
  // Fonts ship inside the app bundle, so this never waits on the network.
  const [fontsReady,fontError]=useFonts({Vazirmatn_400Regular,Vazirmatn_500Medium,Vazirmatn_700Bold});
  if(!fontsReady&&!fontError)return null;
  // Push exists only on devices; the web build is the local screen-review preview.
  return <DeviceLock>{Platform.OS!=='web'?<PushObserver/>:null}<Stack screenOptions={{headerShown:false}} /></DeviceLock>;
}
