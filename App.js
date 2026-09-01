import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  FULL,
  LIGHT,
  PRAYER_NAMES,
  FALLBACK_PRAYERS,
  MATERIALS,
  INITIAL_STATE,
  keyFor,
  mins,
  pretty,
} from './src/data';
import { loadState, saveState, fetchPrayerTimes, setNotifications } from './src/services';
import BatteryCare from './src/BatteryCare';
import { C, s } from './src/styles';

class CrashBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('StudyForge crash', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={s.crash}>
          <Text style={{ fontSize: 42, textAlign: 'center' }}>🧰</Text>
          <Text style={s.crashTitle}>StudyForge caught an error</Text>
          <Text style={s.crashText}>The app stayed open so you can see the real problem.</Text>
          <View style={s.errorBox}>
            <Text selectable style={s.errorText}>
              {String(this.state.error?.message || this.state.error)}
            </Text>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const Card = ({ children }) => <View style={s.card}>{children}</View>;

const Section = ({ eyebrow, title, action, onAction }) => (
  <View style={s.section}>
    <View>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
    {action ? (
      <Pressable onPress={onAction}>
        <Text style={s.link}>{action}</Text>
      </Pressable>
    ) : null}
  </View>
);

const Task = ({ task, toggle, remove }) => (
  <View style={[s.task, task.done && { opacity: 0.55 }]}>
    <Pressable onPress={() => toggle(task.id)}>
      <Text style={[s.circle, task.done && s.circleDone]}>{task.done ? '✓' : ''}</Text>
    </Pressable>
    <View style={{ flex: 1 }}>
      <Text style={s.taskMeta}>{task.type.toUpperCase()} · {task.category}</Text>
      <Text style={[s.taskTitle, task.done && { textDecorationLine: 'line-through' }]}>
        {task.title}
      </Text>
    </View>
    <Pressable onPress={() => remove(task.id)}>
      <Text style={s.delete}>×</Text>
    </Pressable>
  </View>
);

function AppCore() {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState('today');
  const [materialTab, setMaterialTab] = useState('mern');
  const [addOpen, setAddOpen] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [focusPreset, setFocusPreset] = useState(50);
  const [focusSeconds, setFocusSeconds] = useState(3000);
  const [focusRunning, setFocusRunning] = useState(false);
  const [prayerBusy, setPrayerBusy] = useState(false);

  const today = keyFor();

  useEffect(() => {
    loadState(INITIAL_STATE).then(setState);
  }, []);

  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  useEffect(() => {
    if (!focusRunning) return undefined;

    const id = setInterval(() => {
      setFocusSeconds((value) => {
        if (value <= 1) {
          clearInterval(id);
          setFocusRunning(false);
          setState((current) => ({
            ...current,
            focusMinutes: (current.focusMinutes || 0) + focusPreset,
          }));
          Alert.alert('Focus complete 🔥', `${focusPreset} focused minutes logged.`);
          return focusPreset * 60;
        }
        return value - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [focusRunning, focusPreset]);

  if (!state) {
    return (
      <SafeAreaView style={s.loading}>
        <StatusBar barStyle="light-content" />
        <Text style={{ fontSize: 44 }}>SF</Text>
        <Text style={s.title}>StudyForge</Text>
      </SafeAreaView>
    );
  }

  const mode = state.dayModes[today] || 'study';
  const base = mode === 'off' ? [] : mode === 'light' ? LIGHT : FULL;
  const prayers = state.prayerTimes[today] || FALLBACK_PRAYERS;
  const checks = state.checks[today] || {};
  const prayerChecks = state.prayerChecks[today] || {};

  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowMode = state.dayModes[keyFor(tomorrowDate)] || 'study';

  const combined = [
    ...base,
    ...PRAYER_NAMES.map((name) => ({
      id: `p-${name}`,
      time: prayers[name],
      title: `${name} Namaz`,
      note: 'Protected prayer time',
      emoji: '🕌',
      prayer: name,
    })),
    {
      id: 'chat',
      time: '22:00',
      title: 'Chat / Personal Time',
      note: 'Protected from study until sleep',
      emoji: '💬',
    },
  ].sort((a, b) => mins(a.time) - mins(b.time));

  const studyPct =
    mode === 'off'
      ? 100
      : base.length
        ? Math.round((base.filter((item) => checks[item.id]).length / base.length) * 100)
        : 0;

  const taskPct = state.tasks.length
    ? Math.round((state.tasks.filter((item) => item.done).length / state.tasks.length) * 100)
    : 0;

  const mern = MATERIALS.filter((item) => item.kind === 'mern');
  const marketing = MATERIALS.filter((item) => item.kind === 'marketing');
  const mernPct = Math.round(
    (mern.filter((item) => state.materialDone[item.id]).length / mern.length) * 100
  );
  const marketingPct = Math.round(
    (marketing.filter((item) => state.materialDone[item.id]).length / marketing.length) * 100
  );

  const patch = (value) => setState((current) => ({ ...current, ...value }));

  const setMode = async (next) => {
    patch({ dayModes: { ...state.dayModes, [today]: next } });

    if (state.notificationsOn) {
      const schedule = next === 'off' ? [] : next === 'light' ? LIGHT : FULL;
      await setNotifications(true, schedule, prayers);
    }
  };

  const toggle = (id) => {
    patch({
      checks: {
        ...state.checks,
        [today]: { ...checks, [id]: !checks[id] },
      },
    });
  };

  const togglePrayer = (name) => {
    patch({
      prayerChecks: {
        ...state.prayerChecks,
        [today]: { ...prayerChecks, [name]: !prayerChecks[name] },
      },
    });
  };

  const toggleTask = (id) => {
    patch({
      tasks: state.tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    });
  };

  const removeTask = (id) => {
    patch({ tasks: state.tasks.filter((task) => task.id !== id) });
  };

  const addTask = () => {
    if (!newTask.trim()) return;

    patch({
      tasks: [
        ...state.tasks,
        {
          id: String(Date.now()),
          title: newTask.trim(),
          type: 'Task',
          category: 'Other',
          done: false,
        },
      ],
    });
    setNewTask('');
    setAddOpen(false);
  };

  const updatePrayer = async () => {
    try {
      setPrayerBusy(true);
      const fresh = await fetchPrayerTimes();
      patch({ prayerTimes: { ...state.prayerTimes, [today]: fresh } });

      if (state.notificationsOn) {
        await setNotifications(true, base, fresh);
      }
      Alert.alert('Prayer times updated');
    } catch (error) {
      Alert.alert('Could not update', error?.message || 'Try again later.');
    } finally {
      setPrayerBusy(false);
    }
  };

  const changeNotifications = async (value) => {
    const ok = await setNotifications(value, base, prayers);
    patch({ notificationsOn: ok });

    if (value && !ok) {
      Alert.alert('Notifications not allowed', 'Enable notifications in iPhone Settings.');
    }
  };

  const toggleMaterial = (id) => {
    patch({
      materialDone: {
        ...state.materialDone,
        [id]: !state.materialDone[id],
      },
    });
  };

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const next = combined.find((item) => mins(item.time) >= nowMinutes);

  const Today = () => (
    <ScrollView contentContainerStyle={s.scroll}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>
            {new Date()
              .toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
              .toUpperCase()}
          </Text>
          <Text style={s.title}>StudyForge</Text>
        </View>
        <Pressable onPress={() => setTab('plan')}>
          <Text style={{ fontSize: 22 }}>⚙️</Text>
        </Pressable>
      </View>

      <Card>
        <View style={s.heroRow}>
          <View style={{ flex: 1 }}>
            <View
              style={[
                s.pill,
                {
                  borderColor:
                    mode === 'off' ? C.green : mode === 'light' ? C.orange : C.cyan,
                },
              ]}
            >
              <Text
                style={[
                  s.pillText,
                  {
                    color:
                      mode === 'off' ? C.green : mode === 'light' ? C.orange : C.cyan,
                  },
                ]}
              >
                {mode === 'study' ? 'STUDY DAY' : mode === 'light' ? 'LIGHT DAY' : 'OFF DAY'}
              </Text>
            </View>
            <Text style={s.heroTitle}>
              {mode === 'off'
                ? 'Rest without guilt.'
                : mode === 'light'
                  ? 'Keep it light.'
                  : 'Build. Learn. Grow.'}
            </Text>
            <Text style={s.heroText}>
              MERN + Digital Marketing with protected prayer, battery care and personal time.
            </Text>
          </View>

          <View style={s.progress}>
            <Text style={s.progressN}>{studyPct}%</Text>
            <Text style={s.progressS}>today</Text>
          </View>
        </View>

        <Text style={[s.eyebrow, { marginTop: 15 }]}>NEXT</Text>
        <Text style={s.note}>{next ? `${pretty(next.time)} · ${next.title}` : 'Day complete ✓'}</Text>
      </Card>

      <Card>
        <Section
          eyebrow="NAMAZ"
          title="Five daily prayers"
          action={prayerBusy ? 'Updating…' : '📍 Update'}
          onAction={updatePrayer}
        />
        <View style={s.prayerRow}>
          {PRAYER_NAMES.map((name) => (
            <Pressable
              key={name}
              onPress={() => togglePrayer(name)}
              style={[s.prayer, prayerChecks[name] && s.prayerDone]}
            >
              <Text>{prayerChecks[name] ? '✓' : '🕌'}</Text>
              <Text style={s.prayerName}>{name}</Text>
              <Text style={s.prayerTime}>{pretty(prayers[name])}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <BatteryCare
        dayMode={mode}
        tomorrowMode={tomorrowMode}
        notificationsEnabled={state.notificationsOn}
      />

      <Section
        eyebrow="TODAY"
        title={mode === 'off' ? 'Rest day' : 'Your flow'}
        action="Day mode"
        onAction={() => setTab('plan')}
      />

      {mode === 'off' ? (
        <Card>
          <Text style={{ fontSize: 38, textAlign: 'center' }}>🌴</Text>
          <Text style={[s.sectionTitle, { textAlign: 'center' }]}>Official Off Day</Text>
          <Text style={[s.note, { textAlign: 'center', marginTop: 5 }]}>
            No study schedule today. Your streak is protected.
          </Text>
        </Card>
      ) : (
        combined.map((item) => {
          const done = item.prayer ? !!prayerChecks[item.prayer] : !!checks[item.id];

          return (
            <Pressable
              key={item.id}
              onPress={() =>
                item.prayer
                  ? togglePrayer(item.prayer)
                  : item.id === 'chat'
                    ? Alert.alert('Personal time 💬', 'No study after 10 PM.')
                    : toggle(item.id)
              }
              style={[s.timeline, done && s.timelineDone]}
            >
              <Text style={s.time}>{pretty(item.time)}</Text>
              <View style={s.emoji}>
                <Text>{item.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.timelineTitle}>{item.title}</Text>
                <Text style={s.note}>{item.note}</Text>
              </View>
              <Text style={[s.circle, done && s.circleDone]}>{done ? '✓' : ''}</Text>
            </Pressable>
          );
        })
      )}

      <Section
        eyebrow="PRIORITY"
        title="Must finish"
        action="All tasks"
        onAction={() => setTab('tasks')}
      />
      {state.tasks
        .filter((task) => !task.done)
        .slice(0, 3)
        .map((task) => (
          <Task key={task.id} task={task} toggle={toggleTask} remove={removeTask} />
        ))}
    </ScrollView>
  );

  const Plan = () => (
    <ScrollView contentContainerStyle={s.scroll}>
      <Text style={s.eyebrow}>PLANNER</Text>
      <Text style={s.title}>Shape the day</Text>
      <Text style={s.note}>Study Day, Light Day or completely Off.</Text>

      <Card>
        <View style={s.modeRow}>
          {[
            ['study', '⚡️', 'Study Day'],
            ['light', '🌤️', 'Light Day'],
            ['off', '🌴', 'Off Day'],
          ].map(([id, emoji, label]) => (
            <Pressable
              key={id}
              onPress={() => setMode(id)}
              style={[s.mode, mode === id && s.modeOn]}
            >
              <Text style={{ fontSize: 23 }}>{emoji}</Text>
              <Text style={s.modeText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={s.sectionTitle}>Native reminders</Text>
            <Text style={s.note}>Study, Namaz and Battery Care charging reminders.</Text>
          </View>
          <Switch value={state.notificationsOn} onValueChange={changeNotifications} />
        </View>
      </Card>

      <Card>
        <Text style={s.eyebrow}>BATTERY CARE</Text>
        <Text style={s.sectionTitle}>Schedule-aware charging 🔋</Text>
        <Text style={s.note}>
          Today uses a higher charge target on Study Days and smaller top-ups on Light / Off Days.
          Open the Battery Care card on Today to change your maximum target, log Battery Health,
          Cycle Count, or enable a one-day 100% travel charge.
        </Text>
      </Card>

      <Card>
        <Text style={s.eyebrow}>PERSONAL TIME</Text>
        <Text style={s.sectionTitle}>10 PM → Sleep 💬</Text>
        <Text style={s.note}>No study sessions are placed after 10 PM.</Text>
      </Card>
    </ScrollView>
  );

  const Tasks = () => (
    <ScrollView contentContainerStyle={s.scroll}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>WORK</Text>
          <Text style={s.title}>Tasks & assessments</Text>
        </View>
        <Pressable style={s.add} onPress={() => setAddOpen(true)}>
          <Text style={s.addText}>＋</Text>
        </Pressable>
      </View>

      {state.tasks.map((task) => (
        <Task key={task.id} task={task} toggle={toggleTask} remove={removeTask} />
      ))}
    </ScrollView>
  );

  const Learn = () => (
    <ScrollView contentContainerStyle={s.scroll}>
      <Text style={s.eyebrow}>LEARN</Text>
      <Text style={s.title}>Study library</Text>

      <View style={s.tabs}>
        {['mern', 'marketing'].map((value) => (
          <Pressable
            key={value}
            onPress={() => setMaterialTab(value)}
            style={[s.tab, materialTab === value && s.tabOn]}
          >
            <Text style={s.tabText}>{value === 'mern' ? 'MERN' : 'Marketing'}</Text>
          </Pressable>
        ))}
      </View>

      {MATERIALS.filter((item) => item.kind === materialTab).map((material) => (
        <Pressable key={material.id} onPress={() => toggleMaterial(material.id)}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.eyebrow}>{material.week.toUpperCase()}</Text>
                <Text style={s.sectionTitle}>{material.title}</Text>
              </View>
              <Text style={[s.circle, state.materialDone[material.id] && s.circleDone]}>
                {state.materialDone[material.id] ? '✓' : ''}
              </Text>
            </View>
            <Text style={s.note}>{material.note}</Text>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );

  const Progress = () => (
    <ScrollView contentContainerStyle={s.scroll}>
      <Text style={s.eyebrow}>ANALYTICS</Text>
      <Text style={s.title}>Your progress</Text>

      <View style={s.metricGrid}>
        {[
          ['Today', studyPct],
          ['MERN', mernPct],
          ['Marketing', marketingPct],
          ['Tasks', taskPct],
        ].map(([title, value]) => (
          <View key={title} style={s.metric}>
            <Text style={s.metricT}>{title}</Text>
            <Text style={s.metricV}>{value}%</Text>
            <View style={s.bar}>
              <View style={[s.fill, { width: `${value}%` }]} />
            </View>
          </View>
        ))}
      </View>

      <Card>
        <Text style={s.eyebrow}>FOCUS</Text>
        <Text style={s.sectionTitle}>Deep work timer</Text>
        <Text style={s.timer}>
          {String(Math.floor(focusSeconds / 60)).padStart(2, '0')}:
          {String(focusSeconds % 60).padStart(2, '0')}
        </Text>

        <View style={s.modeRow}>
          {[25, 50, 90].map((value) => (
            <Pressable
              key={value}
              onPress={() => {
                setFocusRunning(false);
                setFocusPreset(value);
                setFocusSeconds(value * 60);
              }}
              style={[s.mode, focusPreset === value && s.modeOn]}
            >
              <Text style={s.modeText}>{value}m</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={s.button} onPress={() => setFocusRunning((value) => !value)}>
          <Text style={s.buttonText}>{focusRunning ? 'Pause focus' : 'Start focus'}</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );

  return (
    <SafeAreaView style={s.app}>
      <StatusBar barStyle="light-content" />

      <View style={s.body}>
        {tab === 'today' ? (
          <Today />
        ) : tab === 'plan' ? (
          <Plan />
        ) : tab === 'tasks' ? (
          <Tasks />
        ) : tab === 'learn' ? (
          <Learn />
        ) : (
          <Progress />
        )}
      </View>

      <View style={s.nav}>
        {[
          ['today', '⌂', 'Today'],
          ['plan', '▣', 'Plan'],
          ['tasks', '✓', 'Tasks'],
          ['learn', '◆', 'Learn'],
          ['progress', '↗', 'Progress'],
        ].map(([id, emoji, label]) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={[s.navItem, tab === id && s.navOn]}
          >
            <Text style={s.navEmoji}>{emoji}</Text>
            <Text style={[s.navText, tab === id && { color: C.text }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Modal
        visible={addOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddOpen(false)}
      >
        <View style={s.modal}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Add task</Text>
            <TextInput
              value={newTask}
              onChangeText={setNewTask}
              placeholder="e.g. Build JWT authentication"
              placeholderTextColor="#687185"
              style={s.input}
            />
            <Pressable style={s.button} onPress={addTask}>
              <Text style={s.buttonText}>Save task</Text>
            </Pressable>
            <Pressable
              style={[s.button, { backgroundColor: C.panel2 }]}
              onPress={() => setAddOpen(false)}
            >
              <Text style={s.buttonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <CrashBoundary>
      <AppCore />
    </CrashBoundary>
  );
}
