function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function toMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ""));
  if (!match) return -1;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? h * 60 + m : -1;
}

function hhmm(minute: number) {
  const m = Math.max(0, Math.min(1439, Math.round(minute)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function overlap(a1: number, a2: number, b1: number, b2: number) {
  return a1 < b2 && b1 < a2;
}

function fullDayLike(hours: number[]) {
  const set = new Set(hours);
  const hasMorning = hours.some((h) => h >= 7 && h <= 11);
  const hasAfternoon = hours.some((h) => h >= 12 && h <= 17);
  const hasEvening = hours.some((h) => h >= 18 && h <= 22);
  return set.size >= 12 && hasMorning && hasAfternoon && hasEvening;
}

function hourWindows(hours: number[]) {
  if (!hours.length) return [] as Array<[number, number]>;
  const sorted = [...hours].sort((a, b) => a - b);
  const windows: Array<[number, number]> = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === prev + 1) {
      prev = sorted[i];
      continue;
    }
    windows.push([start * 60, (prev + 1) * 60]);
    start = sorted[i];
    prev = sorted[i];
  }
  return windows;
}

function subtractBlocks(windows: Array<[number, number]>, blocks: Array<[number, number]>) {
  let out = [...windows];
  for (const [x, y] of blocks) {
    out = out.flatMap(([a, b]) => {
      if (!overlap(a, b, x, y)) return [[a, b] as [number, number]];
      return [
        [a, Math.max(a, x)] as [number, number],
        [Math.min(b, y), b] as [number, number],
      ].filter(([s, e]) => e - s >= 20);
    });
  }
  return out.sort((a, b) => a[0] - b[0]);
}

function prayerBlocks(prayerMode: boolean, prayerTimes: any) {
  if (!prayerMode || !prayerTimes) return [] as Array<[number, number]>;
  return Object.values(prayerTimes).flatMap((value) => {
    const m = toMinutes(String(value));
    return m >= 0 ? [[Math.max(0, m - 10), Math.min(1440, m + 20)] as [number, number]] : [];
  });
}

function fitsHours(start: number, end: number, hours: number[]) {
  if (start < 0 || end <= start || end > 1440) return false;
  for (let m = start; m < end; m += 10) {
    if (!hours.includes(Math.floor(m / 60))) return false;
  }
  return true;
}

function safePayload(input: any) {
  const profile = input?.profile || {};
  const activeHours = Array.isArray(profile.activeHoursToday)
    ? [...new Set(profile.activeHoursToday.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 23))].sort((a: number, b: number) => a - b)
    : [];
  const normalFullDay = fullDayLike(activeHours);
  const effectiveHours = normalFullDay ? activeHours.filter((h: number) => h >= 7 && h < 23) : activeHours;
  return {
    date: String(input?.date || ""),
    timezone: String(input?.timezone || "Local"),
    profile: {
      goal: String(profile.goal || ""),
      skills: Array.isArray(profile.skills) ? profile.skills.slice(0, 20).map(String) : [],
      level: String(profile.level || "beginner"),
      durationDays: Math.max(1, Math.min(365, Number(profile.durationDays) || 30)),
      availableDays: Array.isArray(profile.availableDays) ? profile.availableDays.slice(0, 7) : [],
      activeHoursToday: activeHours,
      effectiveHoursToday: effectiveHours,
      normalFullDay,
      sessionMinutes: Math.max(15, Math.min(180, Number(profile.sessionMinutes) || 50)),
      prayerMode: Boolean(profile.prayerMode),
    },
    pendingTasks: Array.isArray(input?.pendingTasks) ? input.pendingTasks.slice(0, 60).map((t: any) => ({
      id: String(t?.id || ""),
      title: String(t?.title || ""),
      skill: String(t?.skill || "General"),
      duration: Math.max(10, Math.min(240, Number(t?.duration) || 50)),
      priority: ["high", "medium", "low"].includes(String(t?.priority)) ? String(t.priority) : "medium",
      deadline: String(t?.deadline || ""),
      type: String(t?.type || "task"),
    })) : [],
    lockedTasks: Array.isArray(input?.lockedTasks) ? input.lockedTasks.slice(0, 20).map((t: any) => ({
      id: String(t?.id || ""),
      time: String(t?.time || ""),
      duration: Math.max(10, Math.min(240, Number(t?.duration) || 50)),
      title: String(t?.title || ""),
      skill: String(t?.skill || "General"),
      priority: String(t?.priority || "medium"),
      locked: true,
      type: String(t?.type || "task"),
      reason: String(t?.reason || "User locked this item"),
      emoji: String(t?.emoji || "🔒"),
    })) : [],
    prayerTimes: input?.prayerTimes && typeof input.prayerTimes === "object" ? input.prayerTimes : null,
  };
}

function buildReserved(data: any) {
  const hours = data.profile.effectiveHoursToday as number[];
  const prayers = prayerBlocks(data.profile.prayerMode, data.prayerTimes);
  const reserved: any[] = [];
  const add = (id: string, time: string, duration: number, title: string, emoji: string, type: "routine" | "break", reason: string) => {
    const start = toMinutes(time);
    const end = start + duration;
    if (!fitsHours(start, end, hours)) return;
    if (prayers.some(([a, b]) => overlap(start, end, a, b))) return;
    reserved.push({ id: `${type}-${data.date}-${id}`, time, duration, title, skill: type === "break" ? "Recovery" : "Daily routine", type, priority: "low", reason, emoji, locked: true });
  };

  const windows = hourWindows(hours);
  const hasLongWindow = windows.some(([a, b]) => b - a >= 240);
  if (data.profile.normalFullDay) {
    add("morning", "07:30", 30, "Morning reset", "🌤️", "routine", "Hygiene, water and a calm start before focused work");
    add("breakfast", "08:00", 30, "Breakfast", "🥣", "routine", "Fuel before the main work blocks");
    add("lunch", "13:00", 45, "Lunch + reset", "🍽️", "routine", "Protect a proper meal and mental reset");
    add("move", "17:00", 25, "Move + refresh", "🚶", "routine", "Short walk, stretch or screen break");
    add("dinner", "20:00", 45, "Dinner / personal reset", "🍲", "routine", "Protect a normal evening meal and reset");
    add("wind", "22:00", 30, "Wind-down", "🌙", "routine", "Reduce intensity and close the day");
  } else if (hasLongWindow) {
    add("lunch", "13:00", 40, "Lunch + reset", "🍽️", "routine", "Long active windows should still include a meal break");
    add("dinner", "20:00", 40, "Dinner / reset", "🍲", "routine", "Protect dinner when a long active window crosses the evening");
  }

  const routineIntervals = reserved.map((r) => [toMinutes(r.time), toMinutes(r.time) + r.duration] as [number, number]);
  const workWindows = subtractBlocks(subtractBlocks(windows, prayers), routineIntervals);
  const preferred = Math.max(25, Math.min(90, Number(data.profile.sessionMinutes) || 50));
  const shortBreak = preferred > 60 ? 15 : 10;
  let breakIndex = 0;
  for (const [a, b] of workWindows) {
    if (b - a < 150) continue;
    let cursor = a;
    let focusCount = 0;
    while (cursor + preferred + shortBreak + 25 <= b) {
      cursor += preferred;
      focusCount += 1;
      const rest = focusCount % 2 === 0 ? 20 : shortBreak;
      add(`auto-${breakIndex++}`, hhmm(cursor), rest, rest >= 20 ? "Long reset" : "Short break", rest >= 20 ? "☕" : "🫗", "break", rest >= 20 ? "Step away, hydrate and reset before the next block" : "Rest your eyes, move and reset");
      cursor += rest;
    }
  }
  return reserved.sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
}

function sanitizeAndMerge(data: any, aiTasks: any[], reserved: any[]) {
  const prayer = prayerBlocks(data.profile.prayerMode, data.prayerTimes);
  const final: any[] = [];
  const pushIfFree = (item: any, mustFit: boolean) => {
    const start = toMinutes(String(item?.time || ""));
    const duration = Math.max(10, Math.min(240, Number(item?.duration) || data.profile.sessionMinutes));
    const end = start + duration;
    if (start < 0 || end > 1440) return;
    if (mustFit && !fitsHours(start, end, data.profile.effectiveHoursToday)) return;
    if (mustFit && prayer.some(([a, b]) => overlap(start, end, a, b))) return;
    if (final.some((x) => overlap(start, end, toMinutes(x.time), toMinutes(x.time) + x.duration))) return;
    final.push({
      id: String(item?.id || `item-${data.date}-${final.length}`),
      time: hhmm(start), duration,
      title: String(item?.title || "Planned item"),
      skill: String(item?.skill || "General"),
      type: String(item?.type || "task"),
      priority: ["high", "medium", "low"].includes(String(item?.priority)) ? String(item.priority) : "medium",
      reason: String(item?.reason || "Planned for this slot"),
      emoji: String(item?.emoji || "🎯"),
      locked: Boolean(item?.locked),
    });
  };

  // Exact user locks have highest priority, then human-rhythm reserved blocks, then AI work.
  for (const item of data.lockedTasks) pushIfFree(item, false);
  for (const item of reserved) pushIfFree(item, true);
  for (const item of aiTasks || []) pushIfFree(item, true);
  return final.sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const apiKey = Netlify.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "Gemini is not configured yet." }, 503);
  let raw: any;
  try { raw = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const data = safePayload(raw);
  const model = Netlify.env.get("GEMINI_MODEL") || "gemini-3.7-flash";
  if (!data.profile.effectiveHoursToday.length && !data.lockedTasks.length) {
    return json({ summary: "No active hours selected for today, so StudyForge kept the day free.", tasks: [] });
  }

  const reserved = buildReserved(data);
  const schema = {
    type: "object",
    properties: {
      summary: { type: "string" },
      tasks: {
        type: "array",
        maxItems: 18,
        items: {
          type: "object",
          properties: {
            id: { type: "string" }, time: { type: "string" }, duration: { type: "integer" },
            title: { type: "string" }, skill: { type: "string" },
            type: { type: "string", enum: ["learn", "practice", "project", "review", "task", "assessment"] },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            reason: { type: "string" }, emoji: { type: "string" }, locked: { type: "boolean" }
          },
          required: ["id", "time", "duration", "title", "skill", "type", "priority", "reason", "emoji", "locked"]
        }
      }
    },
    required: ["summary", "tasks"]
  };

  const prompt = `You are StudyForge's scheduling engine. Create a realistic HUMAN daily task timeline only for ${data.date} in ${data.timezone}.

GOAL: ${data.profile.goal}
SKILLS: ${JSON.stringify(data.profile.skills)}
LEVEL: ${data.profile.level}
PLAN LENGTH: ${data.profile.durationDays} days
PREFERRED FOCUS BLOCK: ${data.profile.sessionMinutes} minutes
USER-SELECTED ACTIVE HOURS: ${JSON.stringify(data.profile.activeHoursToday)}
EFFECTIVE WORK HOURS AFTER NORMAL FULL-DAY SLEEP PROTECTION: ${JSON.stringify(data.profile.effectiveHoursToday)}
FULL-DAY-LIKE SELECTION: ${data.profile.normalFullDay}
PENDING TASKS: ${JSON.stringify(data.pendingTasks)}
LOCKED TASKS: ${JSON.stringify(data.lockedTasks)}
SERVER-RESERVED ROUTINE / REST BLOCKS: ${JSON.stringify(reserved)}
${data.profile.prayerMode ? `PRAYER MODE ON. Prayer times: ${JSON.stringify(data.prayerTimes || {})}. Never overlap 10 minutes before through 20 minutes after a prayer.` : "PRAYER MODE OFF. Do not add prayer constraints or prayer tasks."}

Hard rules:
1. Every non-locked work task must start and finish completely inside EFFECTIVE WORK HOURS. Never use a dark/unselected hour.
2. Never overlap SERVER-RESERVED ROUTINE / REST BLOCKS. They will be merged into the final timeline by the server, so do not duplicate them.
3. Preserve locked tasks at their exact time and never overlap them.
4. A continuous 5-hour availability is NOT five hours of nonstop work. Fit roughly 3-4 meaningful focus blocks around the reserved short/long breaks.
5. Never plan more than about 2 hours of focused work without a real break.
6. For full-day-like availability, behave like a normal human day: protect meals, movement/reset, evening wind-down, and do not turn overnight hours into study just because the user selected everything.
7. Prioritize deadlines and high-priority pending tasks. Fill remaining useful time with learning, practice, project work and review tied to the user's goal.
8. Keep the workload achievable. Do not fill every free minute.
9. Return concise task titles, a short reason and a meaningful emoji.
10. Return valid JSON only.`;

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseJsonSchema: schema }
      }),
    });
    const result = await r.json();
    if (!r.ok) return json({ error: result?.error?.message || `Gemini request failed (${r.status})` }, 502);
    const text = result?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("").trim();
    if (!text) return json({ error: "Gemini returned no schedule." }, 502);
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed?.tasks)) return json({ error: "Gemini returned an invalid schedule." }, 502);
    const tasks = sanitizeAndMerge(data, parsed.tasks, reserved);
    return json({ summary: parsed.summary || "A balanced schedule with work, rest and daily routines.", tasks });
  } catch (e: any) {
    return json({ error: e?.message || "AI planning failed." }, 500);
  }
};

export const config = { path: "/api/plan" };