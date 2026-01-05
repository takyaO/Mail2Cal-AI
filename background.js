// background.js の一番上に配置
console.log("Mail2Cal: Background Script Loading...");

// プロンプト以外の、言語に依存しないデフォルト値
const DEFAULT_SETTINGS = {
  ollamaUrl: "http://100.127.x.y:11434",
  ollamaModel: "qwen2.5:7b",
  calendarList: [
    { "id": "http://example.com/dav/personal/", "name": "Default Calendar" }
  ]
};

async function initSettings() {
  const settings = await browser.storage.local.get([
    "ollamaUrl", 
    "ollamaModel", 
    "ollamaPrompt", 
    "calendarList"
  ]);

  const newSettings = {};
  let needsUpdate = false;

  if (!settings.ollamaPrompt) {
    newSettings.ollamaPrompt = browser.i18n.getMessage("defaultAiPrompt");
    needsUpdate = true;
  }

  for (const key in DEFAULT_SETTINGS) {
    if (!settings[key]) {
      newSettings[key] = DEFAULT_SETTINGS[key];
      needsUpdate = true;
    }
  }

  if (needsUpdate) {
    await browser.storage.local.set(newSettings);
    console.log("Initial settings initialized:", newSettings);
  }
}

// 起動・インストール時の初期化
initSettings(); 
browser.runtime.onInstalled.addListener(initSettings);
browser.runtime.onStartup.addListener(initSettings);

// メッセージリスナー
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "getDefaultSettings") {
    sendResponse(DEFAULT_SETTINGS);
    return false;
  }
  
  if (msg.type === "getCalendars") {
    browser.storage.local.get("calendarList").then(data => {
      sendResponse({ calendars: data.calendarList || [] });
    });
    return true; 
  }

  if (msg.type === "addEvent") {
    handleAddEvent(msg, sendResponse);
    return true;
  }
});

// コンテキストメニュー作成
browser.menus.create({
  id: "mail-to-cal-ai",
  title: browser.i18n.getMessage("contextMenuTitle"),
  contexts: ["all"]
});

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "mail-to-cal-ai") return;

  try {
    const message = await browser.messageDisplay.getDisplayedMessage(tab.id);
    const full = await browser.messages.getFull(message.id);
    
    const mailData = {
      subject: message.subject,
      from: message.author,
      date: new Date(message.date),
      body: (extractBody(full) || "").trim()
    };

    console.log("Processing with LLM...");
    const raw = await sendToOllama(mailData);
    const llmJson = extractJSON(raw);
    const eventData = normalizeEvent(llmJson, mailData);

    browser.windows.create({
      url: browser.runtime.getURL("popup.html") + `?event=${encodeURIComponent(JSON.stringify(eventData))}`,
      type: "popup",
      width: 450,
      height: 550
    });
  } catch (err) {
    console.error("Main Flow Error:", err);
  }
});

// --- Ollama送信 ---
async function sendToOllama(mailData) {
  const config = await browser.storage.local.get({
    ...DEFAULT_SETTINGS,
    ollamaPrompt: browser.i18n.getMessage("defaultAiPrompt")
  });

  const dateStr = mailData.date.toLocaleString("ja-JP");
  let prompt = config.ollamaPrompt
    .replace("{{subject}}", mailData.subject)
    .replace("{{body}}", mailData.body)
    .replace("{{date}}", dateStr)
    .replace("{{from}}", mailData.from);
    
  const res = await fetch(`${config.ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ollamaModel,
      prompt: prompt,
      stream: false
    })
  });

  if (!res.ok) throw new Error("Ollama API Error: " + res.status);
  const json = await res.json();
  return json.response;
}

// --- CalDAV登録 ---
async function handleAddEvent(msg, sendResponse) {
  try {
    const { calendarId, eventData } = msg;
    const auth = await browser.storage.local.get(["username", "password"]);

    if (!auth.username || !auth.password) {
      throw new Error(browser.i18n.getMessage("errorNoCredentials"));
    }
    
    const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const authHeader = "Basic " + btoa(unescape(encodeURIComponent(`${auth.username}:${auth.password}`)));
    const uid = crypto.randomUUID();
    const f = (s) => s.replace(/[-:]/g, "") + "00";

    const icsData = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Mail2Cal//NONSGML v1.1//EN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `SUMMARY:${eventData.title}`,
      `DTSTART;TZID=${systemTimeZone}:${f(eventData.start)}`,
      `DTEND;TZID=${systemTimeZone}:${f(eventData.end)}`,
      `LOCATION:${eventData.location || ""}`,
      `DESCRIPTION:${(eventData.description || "").replace(/\n/g, "\\n")}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const url = `${calendarId}${uid}.ics`;
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Authorization": authHeader
      },
      body: icsData
    });

    if (response.ok) {
      sendResponse({ ok: true });
    } else {
      const errorText = await response.text();
      sendResponse({ ok: false, error: `HTTP ${response.status}: ${errorText}` });
    }
  } catch (e) {
    sendResponse({ ok: false, error: e.message });
  }
}

// --- 補助関数 (抽出・正規化) ---
function extractBody(full) {
  if (!full || !full.parts) return "";
  const plain = findPart(full.parts, "text/plain");
  if (plain && plain.body) return plain.body;
  const html = findPart(full.parts, "text/html");
  if (html && html.body) return stripHtml(html.body);
  return "";
}

function findPart(parts, mime) {
  for (const part of parts) {
    if (part.contentType && part.contentType.startsWith(mime)) return part;
    if (part.parts) {
      const found = findPart(part.parts, mime);
      if (found) return found;
    }
  }
  return null;
}

function stripHtml(html) {
  return html.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, "").trim();
}

function extractJSON(text) {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) text = fenceMatch[1];
  text = text.trim();
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) text = braceMatch[0];
  return JSON.parse(text);
}

function normalizeEvent(llmJson, mailData) {
  const schedule = llmJson.日程 || llmJson.schedule || llmJson || {};
  let startRaw = schedule.start || schedule.開始 || llmJson.start || null;
  if (!startRaw) startRaw = mailData.date.toISOString();
  
  const endRaw = schedule.end || schedule.終了 || llmJson.end || null;
  const startDate = fixYear(new Date(startRaw), mailData.date);
  const endDate = endRaw ? fixYear(new Date(endRaw), mailData.date) : new Date(startDate.getTime() + 60 * 60 * 1000);

  return {
    title: llmJson.title || llmJson.内容 || mailData.subject || "予定",
    start: toLocalISO(startDate),
    end: toLocalISO(endDate),
    location: llmJson.location || llmJson.場所 || "",
    description: buildDescription(mailData),
    confidence: llmJson.confidence || "high"
  };
}

function fixYear(date, mailDate) {
  if (date.getFullYear() !== mailDate.getFullYear()) {
    date.setFullYear(mailDate.getFullYear() + 1);
  }
  return date;
}

function buildDescription(mailData) {
  return `${mailData.body}\n\n---\n[Mail-ID]\nFrom: ${mailData.from}\nSent: ${mailData.date.toLocaleString("ja-JP")} JST\nSubject: ${mailData.subject}`.trim();
}

function toLocalISO(date) {
  const pad = n => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

console.log("Mail2Cal: Background Script Ready.");
