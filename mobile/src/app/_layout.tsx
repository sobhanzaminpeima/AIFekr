import { Stack } from 'expo-router';
import {DeviceLock} from '../components/DeviceLock';
import {PushObserver} from '../components/PushObserver';
export default function Layout() { return <DeviceLock><PushObserver/><Stack screenOptions={{headerShown:false}} /></DeviceLock>; }
