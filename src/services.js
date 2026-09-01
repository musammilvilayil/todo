import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { FALLBACK_PRAYERS, PRAYER_NAMES } from './data';

const STORAGE_KEY='studyforge_v22';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner:true, shouldShowList:true, shouldPlaySound:true, shouldSetBadge:false }),
});

export async function loadState(fallback){
  try { const raw=await AsyncStorage.getItem(STORAGE_KEY); return raw ? {...fallback, ...JSON.parse(raw)} : fallback; }
  catch { return fallback; }
}

export async function saveState(state){
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export async function fetchPrayerTimes(){
  const permission=await Location.requestForegroundPermissionsAsync();
  if(permission.status!=='granted') throw new Error('Location permission was not granted.');
  const pos=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
  const d=new Date();
  const date=`${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
  const r=await fetch(`https://api.aladhan.com/v1/timings/${date}?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&method=1`);
  if(!r.ok) throw new Error('Prayer time service is unavailable.');
  const j=await r.json();
  const t=j?.data?.timings;
  if(!t) return FALLBACK_PRAYERS;
  return {Fajr:t.Fajr.slice(0,5),Dhuhr:t.Dhuhr.slice(0,5),Asr:t.Asr.slice(0,5),Maghrib:t.Maghrib.slice(0,5),Isha:t.Isha.slice(0,5)};
}

export async function setNotifications(enabled, schedule, prayers){
  await Notifications.cancelAllScheduledNotificationsAsync();
  if(!enabled) return false;
  const p=await Notifications.requestPermissionsAsync();
  if(!p.granted) return false;
  for(const item of schedule){
    const [hour,minute]=item.time.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content:{title:item.title,body:item.note,sound:true},
      trigger:{type:Notifications.SchedulableTriggerInputTypes.DAILY,hour,minute},
    });
  }
  const now=new Date();
  for(const name of PRAYER_NAMES){
    const [hour,minute]=prayers[name].split(':').map(Number);
    const date=new Date();
    date.setHours(hour,minute,0,0);
    if(date<=now) continue;
    await Notifications.scheduleNotificationAsync({
      content:{title:`${name} Namaz`,body:`It’s time for ${name}.`,sound:true},
      trigger:date,
    });
  }
  return true;
}
