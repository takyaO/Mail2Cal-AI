// background.js の一番上に配置
console.log("Mail2Cal: Background Script Loading...");

const DEFAULT_SETTINGS = {
    ollamaUrl: "http://100.127.x.y:11434",
    ollamaModel: "qwen2.5:7b",
    ollamaPrompt: `あなたは日本語のビジネスメールから予定情報を抽出するエンジンです。

制約:
- 出力は JSON のみ
- Markdown禁止、説明文禁止
- 時刻は24時間表記で JSTとして扱う

出力形式（JSONのみ）:
{
  "title": "予定タイトル",
  "start": "YYYY-MM-DDTHH:MM",
  "end": "YYYY-MM-DDTHH:MM",
  "location": "場所",
  "description": "説明",
  "confidence": "high|medium|low"
}

メール受信日時: {{date}}

件名:
{{subject}}

本文:
{{body}}

差出人:
{{from}}

例:
メール受信日: 2025年12月30日
本文: "日時：1月13日 12:45 ～ 14:15"
→ start="2026-01-13T12:45" end="2026-01-13T14:15"
`, 
    calendarList: [
    { 
      "id": "http://100.119.x.y/owncloud/remote.php/dav/calendars/okabe/personal/", 
      "name": "個人用" 
    },
    { 
      "id": "http://100.119.x.y/owncloud/remote.php/dav/calendars/okabe/--2/", 
      "name": "仕事用" 
    }
  ]
};

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Mail2Cal: Message received ->", msg.type);

  if (msg.type === "getDefaultSettings") {
    sendResponse(DEFAULT_SETTINGS);
    return false;
  }
  
  if (msg.type === "getCalendars") {
    // 登録先が表示されない問題の修正: ストレージから返却
    browser.storage.local.get("calendarList").then(data => {
      sendResponse({ calendars: data.calendarList || [] });
    });
    return true; 
  }

  if (msg.type === "addEvent") {
    handleAddEvent(msg, sendResponse); // CalDAVへの送信処理
    return true;
  }
});

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "mail2cal") return;

  console.log("Menu clicked");

  try {
    const message = await browser.messageDisplay.getDisplayedMessage(tab.id);
    const full = await browser.messages.getFull(message.id);
    
    // 既存の補助関数（extractBody, sendToOllama等）を呼び出し
    const mailData = {
      subject: message.subject,
      from: message.author,
      date: new Date(message.date),
      body: (extractBody(full) || "").trim()
    };

    console.log("Sending to LLM...");
    const raw = await sendToOllama(mailData);
    const llmJson = extractJSON(raw);
    const eventData = normalizeEvent(llmJson, mailData);

    console.log("Opening popup window...");
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


console.log("Mail2Cal: Background Script Ready.");


// 認証ヘッダー作成関数
async function getAuthHeader() {
  const data = await browser.storage.local.get(["username", "password"]);
  if (!data.username || !data.password) {
    throw new Error("認証情報が設定されていません");
  }
  const credentials = `${data.username}:${data.password}`;
  // Unicode対応のBase64エンコード
  const encoded = btoa(unescape(encodeURIComponent(credentials)));
  return `Basic ${encoded}`;
}


// --- 2. メニュー作成とクリックイベント ---
browser.menus.create({
  id: "mail2cal",
  title: "Mail to Calendar AIで解析",
  // エラーリストにある有効な値のみを使用します
  contexts: ["page"]
});


// --- 補助関数 (extractBody, sendToOllama, normalizeEvent 等は以前のものをここに貼り付け) ---

// ===== 本文抽出（text/plain 優先） =====
function extractBody(full) {
  if (!full || !full.parts) return "";

  // text/plain 優先
  const plain = findPart(full.parts, "text/plain");
  if (plain && plain.body) {
    return plain.body;
  }

  // fallback: html
  const html = findPart(full.parts, "text/html");
  if (html && html.body) {
    return stripHtml(html.body);
  }

  return "";
}

function findPart(parts, mime) {
  for (const part of parts) {
    if (part.contentType && part.contentType.startsWith(mime)) {
      return part;
    }
    if (part.parts) {
      const found = findPart(part.parts, mime);
      if (found) return found;
    }
  }
  return null;
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}


async function sendToOllama(mailData) {
// getの第1引数に DEFAULT_SETTINGS を渡せば、未設定項目のみデフォルトが適用される
  const config = await browser.storage.local.get(DEFAULT_SETTINGS);    
    let prompt = config.ollamaPrompt
	.replace("{{subject}}", mailData.subject)
	.replace("{{body}}", mailData.body);
    
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

function cleanLLMOutput(text) {
  return text
    .replace(/```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function fixYear(date, mailDate) {
  if (date.getFullYear() !== mailDate.getFullYear()) {
    date.setFullYear(mailDate.getFullYear() + 1);
  }
  return date;
}

function buildDescription(mailData) {
  return `
${mailData.body}

---
[Mail-ID]
From: ${mailData.from}
Sent: ${mailData.date.toLocaleString("ja-JP")} JST
Subject: ${mailData.subject}
`.trim();
}

function toLocalISO(date) {
  const pad = n => String(n).padStart(2, "0");
  return (
    date.getFullYear() + "-" +
    pad(date.getMonth() + 1) + "-" +
    pad(date.getDate()) + "T" +
    pad(date.getHours()) + ":" +
    pad(date.getMinutes())
  );
}

function extractJSON(text) {
  // ```json ... ``` を除去
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    text = fenceMatch[1];
  }

  // 前後のゴミ除去
  text = text.trim();

  // 最初と最後の { } だけ抜き出す（保険）
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    text = braceMatch[0];
  }

  return JSON.parse(text);
}



function normalizeEvent(llmJson, mailData) {
  const schedule = llmJson.日程 || llmJson.schedule || llmJson || {};

  // ✅ 修正：変数の再定義エラーを回避
  let startRaw = schedule.start || schedule.開始 || llmJson.start || null;
  
  if (!startRaw) {
    startRaw = mailData.date.toISOString();
  }

  const endRaw = schedule.end || schedule.終了 || llmJson.end || null;

  const startDate = fixYear(new Date(startRaw), mailData.date);
  const endDate = endRaw
    ? fixYear(new Date(endRaw), mailData.date)
    : new Date(startDate.getTime() + 60 * 60 * 1000);

  return {
    title: llmJson.title || llmJson.内容 || mailData.subject || "予定",
    start: toLocalISO(startDate),
    end: toLocalISO(endDate),
    location: llmJson.location || llmJson.場所 || "",
    description: buildDescription(mailData),
    confidence: llmJson.confidence || "high"
  };
}

// --- 予定を CalDAV サーバーに登録する関数 ---
async function handleAddEvent(msg, sendResponse) {
  try {
    const { calendarId, eventData } = msg;
    
    // ストレージから認証情報を取得
    const auth = await browser.storage.local.get(["username", "password"]);
    if (!auth.username || !auth.password) {
      throw new Error("設定画面でユーザー名とパスワードを入力してください。");
    }

    // Basic認証ヘッダーの作成
    const authHeader = "Basic " + btoa(unescape(encodeURIComponent(`${auth.username}:${auth.password}`)));
    
    // ICSデータの生成
    const uid = crypto.randomUUID();
    const f = (s) => s.replace(/[-:]/g, "") + "00"; // YYYYMMDDTHHmm00 形式へ

    const icsData = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Mail2Cal//NONSGML v1.0//EN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `SUMMARY:${eventData.title}`,
      `DTSTART;TZID=Asia/Tokyo:${f(eventData.start)}`,
      `DTEND;TZID=Asia/Tokyo:${f(eventData.end)}`,
      `LOCATION:${eventData.location || ""}`,
      `DESCRIPTION:${(eventData.description || "").replace(/\n/g, "\\n")}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    // PUTリクエストの送信
    const url = `${calendarId}${uid}.ics`;
    console.log("Sending PUT request to:", url);

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
    console.error("handleAddEvent Error:", e);
    sendResponse({ ok: false, error: e.message });
  }
}
