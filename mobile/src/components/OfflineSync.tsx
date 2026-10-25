import {useEffect} from 'react';
import {AppState} from 'react-native';
import {syncPlannerQueue} from '../offlinePlanner';
import type {Locale} from '../i18n';
export function OfflineSync({locale}:{locale:Locale}){
 useEffect(()=>{const sync=()=>{if(AppState.currentState==='active')void syncPlannerQueue(locale).catch(()=>{});};sync();const subscription=AppState.addEventListener('change',sync);const timer=setInterval(sync,30000);return()=>{subscription.remove();clearInterval(timer);};},[locale]);return null;
}
