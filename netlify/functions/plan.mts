function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
function safePayload(input: any) {
  const profile = input?.profile || {};
  const activeHours = Array.isArray(profile.activeHoursToday)
    ? [...new Set(profile.activeHoursToday.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 23))].sort((a: number,b: number)=>a-b)
    : [];
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
      sessionMinutes: Math.max(15, Math.min(180, Number(profile.sessionMinutes) || 50)),
      prayerMode: Boolean(profile.prayerMode),
    },
    pendingTasks: Array.isArray(input?.pendingTasks) ? input.pendingTasks.slice(0, 60).map((t: any) => ({
      id: String(t?.id || ""),
      title: String(t?.title || ""),
      skill: String(t?.skill || "General"),
      duration: Math.max(10, Math.min(240, Number(t?.duration) || 50)),
      priority: ["high","medium","low"].includes(String(t?.priority)) ? String(t.priority) : "medium",
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
    })) : [],
    prayerTimes: input?.prayerTimes && typeof input.prayerTimes === "object" ? input.prayerTimes : null,
  };
}
export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const apiKey = Netlify.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "Gemini is not configured yet." }, 503);
  let raw: any;
  try { raw = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const data = safePayload(raw);
  const model = Netlify.env.get("GEMINI_MODEL") || "gemini-3.7-flash";
  if (!data.profile.activeHoursToday.length && !data.lockedTasks.length) {
    return json({ summary: "No active hours selected for today, so StudyForge kept the day free.", tasks: [] });
  }
  const schema = {
    type: "object",
    properties: {
      summary: { type: "string" },
      tasks: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          properties: {
            id: { type: "string" }, time: { type: "string" }, duration: { type: "integer" },
            title: { type: "string" }, skill: { type: "string" },
            type: { type: "string", enum: ["learn","practice","project","review","task","assessment"] },
            priority: { type: "string", enum: ["high","medium","low"] },
            reason: { type: "string" }, emoji: { type: "string" }, locked: { type: "boolean" }
          },
          required: ["id","time","duration","title","skill","type","priority","reason","emoji","locked"]
        }
      }
    },
    required: ["summary","tasks"]
  };
  const prompt = `You are StudyForge's scheduling engine.\n\nCreate a realistic task timeline ONLY for ${data.date} in timezone ${data.timezone}.\n\nGOAL: ${data.profile.goal}\nSKILLS: ${JSON.stringify(data.profile.skills)}\nLEVEL: ${data.profile.level}\nPLAN LENGTH: ${data.profile.durationDays} days\nPREFERRED SESSION: ${data.profile.sessionMinutes} minutes\nACTIVE HOURS TODAY (each number means that whole local hour is schedulable): ${JSON.stringify(data.profile.activeHoursToday)}\nPENDING TASKS: ${JSON.stringify(data.pendingTasks)}\nLOCKED TASKS: ${JSON.stringify(data.lockedTasks)}\n${data.profile.prayerMode ? `PRAYER MODE ON. Prayer times: ${JSON.stringify(data.prayerTimes || {})}. Never overlap 10 minutes before through 20 minutes after a prayer.` : "PRAYER MODE OFF. Do not add prayer constraints or prayer tasks."}\n\nHard rules:\n1. Every non-locked task must start and finish completely inside the selected ACTIVE HOURS TODAY. Never use a dark/unselected hour.\n2. Preserve locked tasks at their exact time.\n3. Never overlap tasks.\n4. Prioritize deadlines and high-priority pending tasks.\n5. Fill remaining useful time with goal-focused learning, practice, project work and review.\n6. Keep the schedule similar to a practical study timeline: concise title, one short reason, meaningful emoji.\n7. Prefer 3-7 focused sessions; do not fill every available minute just because it exists.\n8. Return an empty tasks array if there is no suitable active time.\n9. Return valid JSON only.`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.25, responseMimeType: "application/json", responseJsonSchema: schema }
      }),
    });
    const result = await r.json();
    if (!r.ok) return json({ error: result?.error?.message || `Gemini request failed (${r.status})` }, 502);
    const text = result?.candidates?.[0]?.content?.parts?.map((p: any)=>p?.text||"").join("").trim();
    if (!text) return json({ error: "Gemini returned no schedule." }, 502);
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed?.tasks)) return json({ error: "Gemini returned an invalid schedule." }, 502);
    return json(parsed);
  } catch (e: any) {
    return json({ error: e?.message || "AI planning failed." }, 500);
  }
};
export const config = { path: "/api/plan" };