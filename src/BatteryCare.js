import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import * as Notifications from 'expo-notifications';

const STORE = 'studyforge_battery_care_v1';
const NOTIF_STORE = 'studyforge_battery_notification_ids_v1';

const COLORS = {
  panel: '#101722',
  panel2: '#151D29',
  bg2: '#0B1018',
  text: '#F7F8FC',
  muted: '#929BAD',
  line: '#252E3B',
  green: '#52DFA3',
  cyan: '#4BD8FF',
  orange: '#FFB45C',
  red: '#FF7182',
  violet: '#7966FF',
};

const DEFAULTS = {
  enabled: true,
  maxTarget: 80,
  lightDayTarget: 70,
  offDayTarget: 60,
  lowThreshold: 30,
  criticalThreshold: 20,
  chargeRatePctPerHour: 55,
  overnightDropEstimate: 4,
  batteryHealth: '',
  cycleCount: '',
  healthHistory: [],
  sessions: [],
  lowBatteryEvents: 0,
  healthyUnplugs: 0,
  overTargetEvents: 0,
  activeSession: null,
  boostDate: null,
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const pad = (n) => String(n).padStart(2, '0');

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeLabel(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function modeTarget(mode, care, date = new Date()) {
  if (care.boostDate === dateKey(date)) return 100;
  if (mode === 'light') return Math.min(care.maxTarget, care.lightDayTarget);
  if (mode === 'off') return Math.min(care.maxTarget, care.offDayTarget);
  return care.maxTarget;
}

function workStartMinutes(mode) {
  if (mode === 'light') return 9 * 60;
  if (mode === 'off') return 10 * 60;
  return 8 * 60;
}

function batteryStateLabel(state) {
  if (state === Battery.BatteryState.CHARGING) return 'Charging';
  if (state === Battery.BatteryState.FULL) return 'Full';
  if (state === Battery.BatteryState.UNPLUGGED) return 'Unplugged';
  if (Battery.BatteryState.NOT_CHARGING != null && state === Battery.BatteryState.NOT_CHARGING) return 'Connected · paused';
  return 'Checking…';
}

function isChargingState(state) {
  return state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
}

function estimateMinutes(fromPct, toPct, rate) {
  if (toPct <= fromPct) return 0;
  return Math.max(5, Math.ceil(((toPct - fromPct) / Math.max(15, rate)) * 60));
}

function buildPlan({ pct, state, mode, tomorrowMode, care }) {
  const now = new Date();
  const hour = now.getHours();
  const charging = isChargingState(state);
  const todayTarget = modeTarget(mode, care, now);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowTarget = modeTarget(tomorrowMode, care, tomorrow);

  const tasks = [];
  const notifications = [];
  let headline = 'Battery data is loading';
  let subline = 'StudyForge will build a charging plan when the phone reports its battery level.';
  let accent = COLORS.cyan;

  if (pct != null) {
    if (charging) {
      if (pct >= todayTarget) {
        headline = `Target reached · ${pct}%`;
        subline = `Your ${todayTarget}% care target is reached. Unplug when convenient.`;
        accent = COLORS.green;
        tasks.push({ icon: '🔌', title: 'Unplug now', note: `You are at ${pct}%. Staying near your target reduces unnecessary time at a very high charge level.`, status: 'NOW' });
      } else {
        const mins = estimateMinutes(pct, todayTarget, care.chargeRatePctPerHour);
        const unplugAt = new Date(now.getTime() + mins * 60000);
        headline = `Charging to ${todayTarget}%`;
        subline = `Estimated ${mins} min left · unplug around ${timeLabel(unplugAt)}.`;
        accent = COLORS.cyan;
        tasks.push({ icon: '⚡', title: `Keep plugged for ~${mins} min`, note: `Current ${pct}% → target ${todayTarget}%.`, status: 'ACTIVE' });
        tasks.push({ icon: '✅', title: `Unplug around ${timeLabel(unplugAt)}`, note: 'StudyForge will remind you near the estimated target time.', status: 'NEXT' });
        tasks.push({ icon: '🌡️', title: 'Light use while charging is okay', note: 'If the phone becomes noticeably warm, pause heavy use and let it cool.', status: 'CARE' });
        if (mins >= 2) notifications.push({ at: unplugAt, title: `Battery target ${todayTarget}% 🔋`, body: `Your estimated charging window is complete. Check the battery and unplug if it is near ${todayTarget}%.` });
      }
    } else if (pct <= care.criticalThreshold) {
      const target = hour >= 17 ? Math.min(65, todayTarget) : todayTarget;
      const mins = estimateMinutes(pct, target, care.chargeRatePctPerHour);
      headline = `Charge now · ${pct}%`;
      subline = `Avoid a deep discharge. A ${target}% target should take roughly ${mins} min.`;
      accent = COLORS.red;
      tasks.push({ icon: '🔴', title: 'Plug in now', note: `Charge from ${pct}% to about ${target}% instead of waiting for the battery to run very low.`, status: 'NOW' });
      tasks.push({ icon: '⏱️', title: `Planned charge: ~${mins} min`, note: target < todayTarget ? 'This is a short evening top-up; a full 80% charge is not necessary tonight.' : `Unplug near ${target}%.`, status: 'PLAN' });
    } else if (pct < care.lowThreshold) {
      const remainingHeavyDay = mode === 'study' && hour < 20;
      const target = remainingHeavyDay ? Math.min(todayTarget, 65) : Math.min(todayTarget, 60);
      const mins = estimateMinutes(pct, target, care.chargeRatePctPerHour);
      headline = `Top-up recommended · ${pct}%`;
      subline = remainingHeavyDay ? `You still have a Study Day ahead. A short top-up to ${target}% is enough.` : `No long charge needed. A small top-up to ${target}% is enough if you need the phone tonight.`;
      accent = COLORS.orange;
      tasks.push({ icon: '🟠', title: remainingHeavyDay ? 'Top-up at your next break' : 'Charge only if you need it', note: `Suggested range: ${pct}% → ${target}% · about ${mins} min.`, status: remainingHeavyDay ? 'NEXT BREAK' : 'OPTIONAL' });
    } else if (mode === 'study' && hour < 8 && pct < 65) {
      const mins = estimateMinutes(pct, todayTarget, care.chargeRatePctPerHour);
      headline = `Morning top-up · ${pct}%`;
      subline = `Charge to ${todayTarget}% before the 8 AM Study Day starts.`;
      accent = COLORS.orange;
      tasks.push({ icon: '🌅', title: 'Plug in this morning', note: `About ${mins} min should take you close to ${todayTarget}%.`, status: 'MORNING' });
    } else {
      headline = `No charge needed · ${pct}%`;
      subline = `Your battery is in a comfortable range for the current ${mode === 'study' ? 'Study Day' : mode === 'light' ? 'Light Day' : 'Off Day'}.`;
      accent = COLORS.green;
      tasks.push({ icon: '✅', title: 'Stay unplugged for now', note: `Current ${pct}% · today's planned ceiling is ${todayTarget}%.`, status: 'GOOD' });
    }

    const projectedMorning = clamp(pct - care.overnightDropEstimate, 0, 100);
    if (tomorrowMode === 'off') {
      tasks.push({ icon: '🌴', title: 'Tomorrow is Off Day', note: `No planned morning charge unless you wake below ${care.lowThreshold}%.`, status: 'TOMORROW' });
    } else {
      const needed = Math.max(0, tomorrowTarget - projectedMorning);
      if (needed <= 5) {
        tasks.push({ icon: '🌅', title: 'Tomorrow morning: probably no charge', note: `Projected morning level is about ${projectedMorning}%.`, status: 'TOMORROW' });
      } else {
        const duration = estimateMinutes(projectedMorning, tomorrowTarget, care.chargeRatePctPerHour);
        const startMinutes = workStartMinutes(tomorrowMode);
        let plugMinutes = startMinutes - duration - 10;
        plugMinutes = clamp(plugMinutes, 5 * 60 + 30, startMinutes - 10);
        const plugAt = new Date(tomorrow);
        plugAt.setHours(Math.floor(plugMinutes / 60), plugMinutes % 60, 0, 0);
        tasks.push({ icon: '⏰', title: `Tomorrow: plug in around ${timeLabel(plugAt)}`, note: `Target ${tomorrowTarget}% before ${tomorrowMode === 'study' ? '8:00 AM Study Day' : '9:00 AM Light Day'} · estimated ${duration} min.`, status: 'TOMORROW' });
        notifications.push({ at: plugAt, title: 'Morning battery plan 🔋', body: `Plug in now for about ${duration} min. Target ${tomorrowTarget}% before your ${tomorrowMode === 'study' ? 'Study Day' : 'Light Day'}.` });
      }
    }
  }

  return { headline, subline, accent, tasks, notifications, todayTarget, tomorrowTarget };
}

async function cancelBatteryNotifications() {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_STORE);
    const ids = raw ? JSON.parse(raw) : [];
    for (const id of ids) {
      try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
    }
    await AsyncStorage.removeItem(NOTIF_STORE);
  } catch {}
}

async function syncBatteryNotifications(enabled, plan, care) {
  await cancelBatteryNotifications();
  if (!enabled || !care.enabled) return;
  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) return;

  const now = Date.now();
  const ids = [];
  for (const item of plan.notifications) {
    if (!(item.at instanceof Date) || item.at.getTime() <= now + 30000) continue;
    try {
      const id = await Notifications.scheduleNotificationAsync({ content: { title: item.title, body: item.body, sound: true }, trigger: item.at });
      ids.push(id);
    } catch {}
  }

  const lastHealth = care.healthHistory?.[0]?.date ? new Date(care.healthHistory[0].date) : null;
  const due = new Date();
  due.setDate(due.getDate() + (lastHealth ? 30 : 7));
  due.setHours(19, 0, 0, 0);
  if (!lastHealth || Date.now() - lastHealth.getTime() > 25 * 24 * 60 * 60 * 1000) {
    try {
      const id = await Notifications.scheduleNotificationAsync({ content: { title: 'Monthly Battery Health check', body: 'Open iPhone Settings → Battery → Battery Health, then log the value in StudyForge.', sound: false }, trigger: due });
      ids.push(id);
    } catch {}
  }
  try { await AsyncStorage.setItem(NOTIF_STORE, JSON.stringify(ids)); } catch {}
}

export default function BatteryCare({ dayMode = 'study', tomorrowMode = 'study', notificationsEnabled = false }) {
  const [care, setCare] = useState(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState({ pct: null, state: Battery.BatteryState.UNKNOWN, lowPower: false });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [healthDraft, setHealthDraft] = useState('');
  const [cyclesDraft, setCyclesDraft] = useState('');
  const lastPctRef = useRef(null);
  const lastNotifKeyRef = useRef('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORE);
        if (!mounted) return;
        const loaded = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
        setCare(loaded);
        setHealthDraft(String(loaded.batteryHealth || ''));
        setCyclesDraft(String(loaded.cycleCount || ''));
      } catch {
        if (mounted) setCare(DEFAULTS);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORE, JSON.stringify(care)).catch(() => {});
  }, [care, ready]);

  useEffect(() => {
    let mounted = true;
    const update = (patch) => mounted && setSnapshot((prev) => ({ ...prev, ...patch }));
    Battery.getPowerStateAsync().then((power) => update({ pct: power.batteryLevel >= 0 ? Math.round(power.batteryLevel * 100) : null, state: power.batteryState, lowPower: !!power.lowPowerMode })).catch(() => {});
    const levelSub = Battery.addBatteryLevelListener(({ batteryLevel }) => update({ pct: batteryLevel >= 0 ? Math.round(batteryLevel * 100) : null }));
    const stateSub = Battery.addBatteryStateListener(({ batteryState }) => update({ state: batteryState }));
    const lowSub = Battery.addLowPowerModeListener(({ lowPowerMode }) => update({ lowPower: !!lowPowerMode }));
    return () => { mounted = false; levelSub?.remove?.(); stateSub?.remove?.(); lowSub?.remove?.(); };
  }, []);

  const plan = useMemo(() => buildPlan({ pct: snapshot.pct, state: snapshot.state, mode: dayMode, tomorrowMode, care }), [snapshot.pct, snapshot.state, dayMode, tomorrowMode, care]);

  useEffect(() => {
    if (!ready || snapshot.pct == null) return;
    setCare((prev) => {
      const charging = isChargingState(snapshot.state);
      let next = prev;
      if (charging && !prev.activeSession) {
        next = { ...prev, activeSession: { startAt: new Date().toISOString(), startPct: snapshot.pct, target: modeTarget(dayMode, prev) } };
      }
      if (!charging && prev.activeSession) {
        const start = new Date(prev.activeSession.startAt);
        const durationMin = Math.max(1, Math.round((Date.now() - start.getTime()) / 60000));
        const gain = snapshot.pct - Number(prev.activeSession.startPct || 0);
        let rate = prev.chargeRatePctPerHour;
        if (durationMin >= 8 && gain >= 4) {
          const observed = clamp((gain / durationMin) * 60, 15, 120);
          rate = Math.round(prev.chargeRatePctPerHour * 0.7 + observed * 0.3);
        }
        const target = Number(prev.activeSession.target || prev.maxTarget);
        const healthy = snapshot.pct >= target - 10 && snapshot.pct <= target + 4;
        const over = snapshot.pct > target + 5;
        const session = { startAt: prev.activeSession.startAt, endAt: new Date().toISOString(), startPct: prev.activeSession.startPct, endPct: snapshot.pct, durationMin, target };
        next = { ...prev, activeSession: null, chargeRatePctPerHour: rate, sessions: [session, ...(prev.sessions || [])].slice(0, 20), healthyUnplugs: (prev.healthyUnplugs || 0) + (healthy ? 1 : 0), overTargetEvents: (prev.overTargetEvents || 0) + (over ? 1 : 0) };
      }
      const oldPct = lastPctRef.current;
      if (oldPct != null && oldPct > prev.criticalThreshold && snapshot.pct <= prev.criticalThreshold) next = { ...next, lowBatteryEvents: (next.lowBatteryEvents || 0) + 1 };
      lastPctRef.current = snapshot.pct;
      return next;
    });
  }, [snapshot.pct, snapshot.state, dayMode, ready]);

  useEffect(() => {
    if (!ready) return;
    const key = [notificationsEnabled ? 1 : 0, care.enabled ? 1 : 0, Math.floor((snapshot.pct ?? 0) / 5), snapshot.state, dayMode, tomorrowMode, care.maxTarget, care.boostDate, Math.round(care.chargeRatePctPerHour / 5)].join('|');
    if (key === lastNotifKeyRef.current) return;
    lastNotifKeyRef.current = key;
    syncBatteryNotifications(notificationsEnabled, plan, care).catch(() => {});
  }, [ready, notificationsEnabled, plan, care, snapshot.pct, snapshot.state, dayMode, tomorrowMode]);

  const saveHealth = () => {
    const health = healthDraft.trim();
    const cycles = cyclesDraft.trim();
    const entry = { date: new Date().toISOString(), health: health ? Number(health) : null, cycles: cycles ? Number(cycles) : null };
    setCare((prev) => ({ ...prev, batteryHealth: health, cycleCount: cycles, healthHistory: [entry, ...(prev.healthHistory || [])].slice(0, 24) }));
    setSettingsOpen(false);
  };

  const toggleBoost = () => {
    const today = dateKey();
    setCare((prev) => ({ ...prev, boostDate: prev.boostDate === today ? null : today }));
  };

  const trackedSessions = care.sessions?.length || 0;
  const healthyRate = trackedSessions ? Math.round(((care.healthyUnplugs || 0) / trackedSessions) * 100) : null;

  return (
    <View style={b.wrap}>
      <View style={b.header}>
        <View style={{ flex: 1 }}><Text style={b.eyebrow}>BATTERY CARE PLANNER</Text><Text style={b.title}>Charge smarter 🔋</Text></View>
        <Pressable onPress={() => setSettingsOpen(true)} style={b.settings}><Text style={b.settingsText}>⚙️</Text></Pressable>
      </View>

      <View style={[b.hero, { borderColor: plan.accent }]}>
        <View style={b.heroTop}>
          <View><Text style={b.stateText}>{batteryStateLabel(snapshot.state)}{snapshot.lowPower ? ' · Low Power' : ''}</Text><Text style={b.percent}>{snapshot.pct == null ? '—' : `${snapshot.pct}%`}</Text></View>
          <View style={[b.targetBadge, { borderColor: plan.accent }]}><Text style={b.targetSmall}>TODAY TARGET</Text><Text style={[b.targetValue, { color: plan.accent }]}>{plan.todayTarget}%</Text></View>
        </View>
        <Text style={b.headline}>{plan.headline}</Text><Text style={b.subline}>{plan.subline}</Text>
        <View style={b.miniRow}>
          <View style={b.mini}><Text style={b.miniLabel}>LEARNED SPEED</Text><Text style={b.miniValue}>~{care.chargeRatePctPerHour}%/h</Text></View>
          <View style={b.mini}><Text style={b.miniLabel}>TOMORROW</Text><Text style={b.miniValue}>{plan.tomorrowTarget}% target</Text></View>
          <View style={b.mini}><Text style={b.miniLabel}>REMINDERS</Text><Text style={b.miniValue}>{notificationsEnabled ? 'On' : 'Off'}</Text></View>
        </View>
      </View>

      <View style={b.todoHeader}><Text style={b.eyebrow}>CHARGING TO-DOS</Text><Text style={b.todoCount}>{plan.tasks.length}</Text></View>
      {plan.tasks.map((task, index) => <View key={`${task.title}-${index}`} style={b.todo}><View style={b.todoIcon}><Text>{task.icon}</Text></View><View style={{ flex: 1 }}><Text style={b.todoStatus}>{task.status}</Text><Text style={b.todoTitle}>{task.title}</Text><Text style={b.todoNote}>{task.note}</Text></View></View>)}

      <View style={b.actions}><Pressable onPress={toggleBoost} style={[b.action, care.boostDate === dateKey() && b.actionOn]}><Text style={b.actionEmoji}>🧳</Text><Text style={b.actionTitle}>{care.boostDate === dateKey() ? '100% day enabled' : 'Travel / long day'}</Text><Text style={b.actionNote}>{care.boostDate === dateKey() ? 'Tap to return to battery-care target.' : 'Allow 100% for today only when you genuinely need it.'}</Text></Pressable></View>

      {(care.batteryHealth || care.cycleCount || trackedSessions > 0) && <View style={b.stats}>{care.batteryHealth ? <Stat label="Battery Health" value={`${care.batteryHealth}%`} /> : null}{care.cycleCount ? <Stat label="Cycle Count" value={care.cycleCount} /> : null}<Stat label="Tracked Charges" value={String(trackedSessions)} /><Stat label="Healthy Unplugs" value={healthyRate == null ? 'Learning' : `${healthyRate}%`} /></View>}

      <Text style={b.disclaimer}>StudyForge can recommend charging windows and remind you, but iOS does not let a normal app physically stop charging at 80% or read Battery Health / Cycle Count directly. Those values are logged manually.</Text>

      <Modal visible={settingsOpen} transparent animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
        <View style={b.modalBack}><View style={b.sheet}>
          <View style={b.sheetHead}><View><Text style={b.eyebrow}>BATTERY CARE</Text><Text style={b.sheetTitle}>Charging preferences</Text></View><Pressable onPress={() => setSettingsOpen(false)}><Text style={b.close}>×</Text></Pressable></View>
          <View style={b.switchRow}><View style={{ flex: 1 }}><Text style={b.settingTitle}>Smart Battery Care</Text><Text style={b.settingNote}>Generate charging to-dos from battery level + StudyForge day mode.</Text></View><Switch value={care.enabled} onValueChange={(value) => setCare((p) => ({ ...p, enabled: value }))} /></View>
          <Text style={b.settingLabel}>MAX DAILY TARGET</Text><View style={b.choiceRow}>{[80, 85, 90, 100].map((value) => <Pressable key={value} onPress={() => setCare((p) => ({ ...p, maxTarget: value }))} style={[b.choice, care.maxTarget === value && b.choiceOn]}><Text style={b.choiceText}>{value}%</Text></Pressable>)}</View>
          <Text style={b.settingHint}>80% is the default care target. Use 100% only when extra runtime matters more than minimizing high-charge time.</Text>
          <Text style={b.settingLabel}>LOW-BATTERY TOP-UP POINT</Text><View style={b.choiceRow}>{[25, 30, 35].map((value) => <Pressable key={value} onPress={() => setCare((p) => ({ ...p, lowThreshold: value }))} style={[b.choice, care.lowThreshold === value && b.choiceOn]}><Text style={b.choiceText}>{value}%</Text></Pressable>)}</View>
          <Text style={b.settingLabel}>BATTERY HEALTH % (MANUAL)</Text><TextInput value={healthDraft} onChangeText={setHealthDraft} placeholder="e.g. 96" keyboardType="number-pad" placeholderTextColor="#687185" style={b.input} maxLength={3} />
          <Text style={b.settingLabel}>CYCLE COUNT (MANUAL)</Text><TextInput value={cyclesDraft} onChangeText={setCyclesDraft} placeholder="e.g. 182" keyboardType="number-pad" placeholderTextColor="#687185" style={b.input} maxLength={5} />
          <Pressable onPress={saveHealth} style={b.save}><Text style={b.saveText}>Save Battery Care settings</Text></Pressable>
        </View></View>
      </Modal>
    </View>
  );
}

function Stat({ label, value }) { return <View style={b.stat}><Text style={b.statLabel}>{label}</Text><Text style={b.statValue}>{value}</Text></View>; }

const b = StyleSheet.create({
  wrap:{marginBottom:8},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:8,marginBottom:11},eyebrow:{color:'#7E8798',fontSize:9,fontWeight:'900',letterSpacing:1.2},title:{color:COLORS.text,fontSize:19,fontWeight:'900',marginTop:2},settings:{width:38,height:38,borderRadius:12,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.panel2,alignItems:'center',justifyContent:'center'},settingsText:{fontSize:17},hero:{backgroundColor:COLORS.panel,borderWidth:1,borderRadius:22,padding:16,marginBottom:10},heroTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},stateText:{color:COLORS.muted,fontSize:10,fontWeight:'800'},percent:{color:COLORS.text,fontSize:38,fontWeight:'900',letterSpacing:-1.5,marginTop:1},targetBadge:{borderWidth:1,borderRadius:13,paddingHorizontal:11,paddingVertical:8,alignItems:'center',backgroundColor:COLORS.bg2},targetSmall:{color:COLORS.muted,fontSize:7,fontWeight:'900',letterSpacing:.8},targetValue:{fontSize:18,fontWeight:'900',marginTop:2},headline:{color:COLORS.text,fontSize:17,fontWeight:'900',marginTop:13},subline:{color:COLORS.muted,fontSize:10,lineHeight:15,marginTop:4},miniRow:{flexDirection:'row',gap:6,marginTop:13},mini:{flex:1,backgroundColor:COLORS.bg2,borderWidth:1,borderColor:COLORS.line,borderRadius:12,padding:9},miniLabel:{color:'#707A8C',fontSize:6.5,fontWeight:'900',letterSpacing:.5},miniValue:{color:COLORS.text,fontSize:9,fontWeight:'800',marginTop:3},todoHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:4,marginBottom:7},todoCount:{color:COLORS.cyan,fontSize:10,fontWeight:'900'},todo:{flexDirection:'row',gap:10,alignItems:'center',backgroundColor:COLORS.bg2,borderWidth:1,borderColor:COLORS.line,borderRadius:16,padding:12,marginBottom:7},todoIcon:{width:38,height:38,borderRadius:12,backgroundColor:'#121D2A',alignItems:'center',justifyContent:'center'},todoStatus:{color:COLORS.cyan,fontSize:7,fontWeight:'900',letterSpacing:.8},todoTitle:{color:COLORS.text,fontSize:11,fontWeight:'900',marginTop:2},todoNote:{color:COLORS.muted,fontSize:8.5,lineHeight:13,marginTop:3},actions:{marginTop:2},action:{borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.panel,borderRadius:16,padding:12,marginBottom:8},actionOn:{borderColor:'#6B5DF0',backgroundColor:'#171431'},actionEmoji:{fontSize:17},actionTitle:{color:COLORS.text,fontSize:11,fontWeight:'900',marginTop:4},actionNote:{color:COLORS.muted,fontSize:8.5,lineHeight:13,marginTop:3},stats:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:2},stat:{width:'48.8%',borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.panel,borderRadius:14,padding:11},statLabel:{color:COLORS.muted,fontSize:7.5},statValue:{color:COLORS.text,fontSize:15,fontWeight:'900',marginTop:3},disclaimer:{color:'#687285',fontSize:7.5,lineHeight:11,marginTop:7,marginBottom:8},modalBack:{flex:1,justifyContent:'flex-end',backgroundColor:'#000000AA'},sheet:{backgroundColor:'#0C111A',borderTopLeftRadius:26,borderTopRightRadius:26,borderWidth:1,borderColor:COLORS.line,padding:18,paddingBottom:30},sheetHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12},sheetTitle:{color:COLORS.text,fontSize:23,fontWeight:'900',marginTop:2},close:{color:COLORS.muted,fontSize:28,paddingHorizontal:5},switchRow:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.panel,borderRadius:15,padding:12,marginBottom:14},settingTitle:{color:COLORS.text,fontSize:11,fontWeight:'900'},settingNote:{color:COLORS.muted,fontSize:8.5,lineHeight:12,marginTop:3},settingLabel:{color:'#7E8798',fontSize:8,fontWeight:'900',letterSpacing:.8,marginTop:11,marginBottom:7},choiceRow:{flexDirection:'row',gap:6},choice:{flex:1,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.panel,borderRadius:11,paddingVertical:10,alignItems:'center'},choiceOn:{borderColor:COLORS.violet,backgroundColor:'#18143B'},choiceText:{color:COLORS.text,fontSize:10,fontWeight:'900'},settingHint:{color:'#687285',fontSize:7.5,lineHeight:11,marginTop:6},input:{minHeight:44,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.panel,color:COLORS.text,borderRadius:12,paddingHorizontal:12,fontSize:14},save:{minHeight:47,borderRadius:14,backgroundColor:COLORS.violet,alignItems:'center',justifyContent:'center',marginTop:16},saveText:{color:'#fff',fontSize:11,fontWeight:'900'}
});