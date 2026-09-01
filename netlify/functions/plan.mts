function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function extractText(result: any) {
  const parts: string[] = [];
  for (const step of result?.steps || []) {
    if (step?.type !== "model_output") continue;
    for (const item of step?.content || []) {
      if (item?.type === "text" && typeof item.text === "string") parts.push(item.text);
    }
  }
  return parts.join("").trim();
}

function safePayload(input: any) {
  const profile = input?.profile || {};
  return {
    date: String(input?.date || ""),
    timezone: String(input?.timezone || "Local"),
    profile: {
      goal: String(profile.goal || ""),
      skills: Array.isArray(profile.skills) ? profile.skills.slice(0, 20).map(String) : [],
      level: String(profile.level || "beginner"),
      durationDays: Math.max(1, Math.min(365, Number(profile.durationDays) || 30)),
      availableDays: Array.isArray(profile.availableDays) ? profile.availableDays.slice(0, 7) : [],
      start: String(profile.start || "08:00"),
      end: String(profile.end || "21:00"),
      sessionMinutes: Math.max(15, Math.min(180, Number(profile.sessionMinutes) || 50)),
      prayerMode: Boolean(profile.prayerMode),
    },
    pendingTasks: Array.isArray(input?.pendingTasks)
      ? input.pendingTasks.slice(0, 60).map((t: any) => ({
          id: String(t?.id || ""),
          title: String(t?.title || ""),
          skill: String(t?.skill || "General"),
          duration: Math.max(10, Math.min(240, Number(t?.duration) || 50)),
          priority: ["high", "medium", "low"].includes(String(t?.priority)) ? String(t.priority) : "medium",
          deadline: String(t?.deadline || ""),
        }))
      : [],
    lockedTasks: Array.isArray(input?.lockedTasks)
      ? input.lockedTasks.slice(0, 20).map((t: any) => ({
          id: String(t?.id || ""),
          time: String(t?.time || ""),
          duration: Math.max(10, Math.min(240, Number(t?.duration) || 50)),
          title: String(t?.title || ""),
          skill: String(t?.skill || "General"),
          priority: String(t?.priority || "medium"),
          locked: true,
        }))
      : [],
    prayerTimes: input?.prayerTimes && typeof input.prayerTimes === "object" ? input.prayerTimes : null,
  };
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const apiKey = Netlify.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "Gemini is not configured yet." }, 503);

  let raw: any;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const data = safePayload(raw);
  const model = Netlify.env.get("GEMINI_MODEL") || "gemini-3.7-flash";
  const schema = {
    type: "object",
    properties: {
      summary: { type: "string", description: "One short encouraging factual summary of today's plan." },
      tasks: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            date: { type: "string" },
            time: { type: "string", description: "24-hour HH:MM local time" },
            duration: { type: "integer", minimum: 10, maximum: 180 },
            title: { type: "string" },
            skill: { type: "string" },
            type: { type: "string", enum: ["learn", "practice", "project", "review", "task", "assessment"] },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            reason: { type: "string" },
            emoji: { type: "string" },
            locked: { type: "boolean" }
          },
          required: ["id", "date", "time", "duration", "title", "skill", "type", "priority", "reason", "emoji", "locked"]
        }
      }
    },
    required: ["summary", "tasks"]
  };

  const prompt = `You are the scheduling engine for StudyForge, an adaptive personal task and skill-development planner.

Create a realistic plan ONLY for ${data.date} in timezone ${data.timezone}.

USER PROFILE\n${JSON.stringify(data.profile)}
PENDING TASK BANK\n${JSON.stringify(data.pendingTasks)}
LOCKED TASKS THAT MUST KEEP THEIR EXACT TIME\n${JSON.stringify(data.lockedTasks)}
${data.profile.prayerMode ? `PRAYER MODE IS ON. Protected prayer times: ${JSON.stringify(data.prayerTimes || {})}. Do not place work from 10 minutes before until 20 minutes after each prayer.` : "PRAYER MODE IS OFF. Do not add prayer items or prayer constraints."}

Rules:
1. Never schedule outside the user's available start/end window.
2. Preserve every locked task at its exact time and set locked=true.
3. Prioritize approaching deadlines, then high priority, then weak/core skills relevant to the goal.
4. If the task bank is sparse, create useful learn/practice/project/review sessions that advance the user's selected skills and main goal over the selected plan length.
5. Keep the day achievable. Prefer 3-7 focused sessions, include short gaps, and avoid unnecessary overload.
6. Respect the preferred session length, but shorten a session when needed to fit the day.
7. Avoid overlapping sessions.
8. Use concise task titles and a short reason explaining why the task is placed there.
9. Return an empty tasks array if today is not one of the user's available days, unless a locked task exists.
10. This is task scheduling, not religious instruction; Prayer Mode only protects time blocks when enabled.
`;

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model,
        input: prompt,
        store: false,
        generation_config: { temperature: 0.25 },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema,
        },
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      const message = result?.error?.message || `Gemini request failed (${response.status})`;
      return json({ error: message }, 502);
    }

    const text = extractText(result);
    if (!text) return json({ error: "Gemini returned no schedule." }, 502);
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed?.tasks)) return json({ error: "Gemini returned an invalid schedule." }, 502);
    return json(parsed);
  } catch (error: any) {
    return json({ error: error?.message || "AI planning failed." }, 500);
  }
};

export const config = { path: "/api/plan" };
