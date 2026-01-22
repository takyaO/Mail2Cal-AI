// options.js

// --- 多言語化適用関数 ---
function applyI18n() {
  // テキストコンテンツの置換 (data-i18n)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const msg = browser.i18n.getMessage(el.getAttribute('data-i18n'));
    if (msg) el.textContent = msg;
  });

  // Placeholderの置換 (data-i18n-placeholder)
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const msg = browser.i18n.getMessage(el.getAttribute('data-i18n-placeholder'));
    if (msg) el.placeholder = msg;
  });
}

async function getDefaultsWithRetry(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await browser.runtime.sendMessage({ type: "getDefaultSettings" });
    } catch (e) {
      if (i === retries - 1) throw e;
      console.log(`Retrying connection to background... (${i + 1})`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

async function initOptions() {
  try {
    applyI18n();
    
    // 全ての項目を取得（未保存時のデフォルト値もここで指定しておくと安全です）
    let settings = await browser.storage.local.get({
      ollamaUrl: "http://127.0.0.1:11434",
      ollamaModel: "qwen2.5:7b",
      ollamaPrompt: "",
      calendarList: [],
      username: "",
      password: "",
      autoTodo: false
    });

    // プロンプトやリストが空の場合のリカバリ
    if (!settings.ollamaPrompt || !settings.calendarList || settings.calendarList.length === 0) {
      const defaults = await getDefaultsWithRetry();
      // 取得したデフォルト値で上書き
      settings = { ...settings, ...defaults };
    }

    // --- 各入力欄に値を反映させる (ここが不足していました) ---
    if (document.getElementById("ollamaUrl")) {
      document.getElementById("ollamaUrl").value = settings.ollamaUrl;
    }
    if (document.getElementById("ollamaModel")) {
      document.getElementById("ollamaModel").value = settings.ollamaModel;
    }
    if (document.getElementById("username")) {
      document.getElementById("username").value = settings.username;
    }
    if (document.getElementById("password")) {
      document.getElementById("password").value = settings.password;
    }
    if (document.getElementById("autoTodo")) {
      document.getElementById("autoTodo").checked = settings.autoTodo;
    }

    // プロンプトの反映
    const promptEl = document.getElementById("ollamaPrompt");
    if (promptEl) {
      promptEl.value = settings.ollamaPrompt || "";
    }

    // カレンダーリスト（オブジェクト/配列をJSON文字列に変換して表示）
    const calendarEl = document.getElementById("calendarList");
    if (calendarEl) {
      calendarEl.value = JSON.stringify(settings.calendarList, null, 2); 
    }

    // ===============================
    // reset ボタン（既存の処理）
    // ===============================
    const resetBtn = document.getElementById("resetPromptButton");
    if (resetBtn && !resetBtn.dataset.bound) {
      resetBtn.dataset.bound = "true";
      resetBtn.addEventListener("click", async () => {
        try {
          const defaults = await getDefaultsWithRetry();
          if (promptEl) promptEl.value = defaults.ollamaPrompt || "";
          await browser.storage.local.set({
            ollamaPrompt: defaults.ollamaPrompt
          });
        } catch (e) {
          console.error("Prompt reset failed:", e);
        }
      });
    }

  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}

// 保存ボタンのクリックイベント
document.getElementById("save").addEventListener("click", async () => {
  try {
    const ollamaUrl = document.getElementById("ollamaUrl").value;
    const calendarListRaw = document.getElementById("calendarList").value;
    const calendars = JSON.parse(calendarListRaw || "[]");

    // --- 1. 権限リクエスト用リストを作成 ---
    const originsToRequest = [];

    const safeGetOrigin = (urlString) => {
      try {
        const url = new URL(urlString);
        return `${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}/*`;
      } catch (e) { return null; }
    };

    // Ollama URL を追加
    const ollamaOrigin = safeGetOrigin(ollamaUrl);
    if (ollamaOrigin) originsToRequest.push(ollamaOrigin);

    // JSON内の全カレンダーURLをループして追加
      calendars.forEach((cal, index) => {
      // JSONのキーが "id" なので、cal.id を参照する
      console.log(`Checking calendar ${index}:`, cal.id); 
      const cOrigin = safeGetOrigin(cal.id);
      if (cOrigin && !originsToRequest.includes(cOrigin)) {
        originsToRequest.push(cOrigin);
      }
    });

    // --- 2. まとめて権限リクエスト ---
    if (originsToRequest.length > 0) {
      console.log("Requesting permissions for:", originsToRequest);
      const granted = await browser.permissions.request({
        origins: originsToRequest
      });

      if (!granted) {
        alert("Permission denied. Some servers may not be accessible.");
        // 開発時はここで return せず、どこまで進めるか試すのもアリです
      }
    }

    // --- 3. 設定の保存処理 ---
    const newSettings = {
      ollamaUrl: ollamaUrl,
      ollamaModel: document.getElementById("ollamaModel").value,
      ollamaPrompt: document.getElementById("ollamaPrompt").value,
      autoTodo: document.getElementById("autoTodo").checked,
      calendarList: calendars,
      username: document.getElementById("username").value,
      password: document.getElementById("password").value
    };

    await browser.storage.local.set(newSettings);
    alert(browser.i18n.getMessage("saveSuccess"));
  } catch (e) {
    alert(browser.i18n.getMessage("saveError") + "\n" + e.message);
  }
});

// 初期化実行
document.addEventListener("DOMContentLoaded", () => {
  initOptions();
});

