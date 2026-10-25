import {useEffect} from 'react';
import * as Notifications from 'expo-notifications';
import {router} from 'expo-router';
Notifications.setNotificationHandler({handleNotification:async()=>({shouldPlaySound:false,shouldSetBadge:false,shouldShowBanner:true,shouldShowList:true})});
export function PushObserver(){
 useEffect(()=>{
  function open(response:Notifications.NotificationResponse){if(response.notification.request.content.data?.target==='notifications')router.replace('/?tab=you');}
  const last=Notifications.getLastNotificationResponse();if(last){open(last);Notifications.clearLastNotificationResponse();}
  const listener=Notifications.addNotificationResponseReceivedListener(open);return()=>listener.remove();
 },[]);return null;
}
