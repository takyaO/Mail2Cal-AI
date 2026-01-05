// options.js

async function getDefaultsWithRetry(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await browser.runtime.sendMessage({ type: "getDefaultSettings" });
    } catch (e) {
      if (i === retries - 1) throw e;
      console.log(`Retrying connection to background... (${i + 1})`);
      await new Promise(resolve => setTimeout(resolve, 500)); // 0.5秒待機
    }
  }
}

async function initOptions() {
  try {
    let settings = await browser.storage.local.get();

    // プロンプトがない、またはカレンダーリストが空（未設定）の場合にデフォルトを取得
    if (!settings.ollamaPrompt || !settings.calendarList || settings.calendarList.length === 0) {
      console.log("Settings incomplete. Fetching defaults...");
      settings = await getDefaultsWithRetry();
    }

    // 1. 各入力フィールドへの反映
    document.getElementById("ollamaUrl").value = settings.ollamaUrl || "";
    document.getElementById("ollamaModel").value = settings.ollamaModel || "";
    document.getElementById("ollamaPrompt").value = settings.ollamaPrompt || "";
    
    // 2. カレンダーリストの表示処理
    if (settings.calendarList) {
      // 常に整形されたJSON文字列として表示する
      document.getElementById("calendarList").value = JSON.stringify(settings.calendarList, null, 2);
    }
    
    // 3. 認証情報
    if (settings.username) document.getElementById("username").value = settings.username;
    if (settings.password) document.getElementById("password").value = settings.password;

  } catch (error) {
    console.error("Failed to load settings:", error);
    alert("初期設定の読み込みに失敗しました。アドオンマネージャーから再読み込みを試してください。");
  }
}

initOptions();


// --- 保存ボタンの処理 ---
document.getElementById("save").addEventListener("click", async () => {
  try {
    // 画面上の入力を取得
    const calendarListRaw = document.getElementById("calendarList").value;
    const newSettings = {
      ollamaUrl: document.getElementById("ollamaUrl").value,
      ollamaModel: document.getElementById("ollamaModel").value,
      ollamaPrompt: document.getElementById("ollamaPrompt").value,
      calendarList: JSON.parse(calendarListRaw || "[]"), // JSONとして保存
      username: document.getElementById("username").value,
      password: document.getElementById("password").value
    };

    // ストレージに保存
    await browser.storage.local.set(newSettings);
    alert("設定を保存しました。");
  } catch (e) {
    alert("保存に失敗しました。カレンダー一覧のJSON形式を確認してください。\n" + e.message);
  }
});
