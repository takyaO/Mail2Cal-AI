// options.js

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
    // 0. 多言語化を適用
    applyI18n();

    let settings = await browser.storage.local.get();

    if (!settings.ollamaPrompt || !settings.calendarList || settings.calendarList.length === 0) {
      console.log("Settings incomplete. Fetching defaults...");
      settings = await getDefaultsWithRetry();
    }

    document.getElementById("ollamaUrl").value = settings.ollamaUrl || "";
    document.getElementById("ollamaModel").value = settings.ollamaModel || "";
    document.getElementById("ollamaPrompt").value = settings.ollamaPrompt || "";
    
    if (settings.calendarList) {
      document.getElementById("calendarList").value = JSON.stringify(settings.calendarList, null, 2);
    }
    
    if (settings.username) document.getElementById("username").value = settings.username;
    if (settings.password) document.getElementById("password").value = settings.password;

  } catch (error) {
    console.error("Failed to load settings:", error);
    // エラーメッセージも辞書化する場合は browser.i18n.getMessage("errorLoadSettings")
    alert(browser.i18n.getMessage("errorLoadSettings") || "Failed to load settings.");
  }
}

// 初期化実行
initOptions();

// --- 保存ボタンの処理 ---
document.getElementById("save").addEventListener("click", async () => {
  try {
    const calendarListRaw = document.getElementById("calendarList").value;
    const newSettings = {
      ollamaUrl: document.getElementById("ollamaUrl").value,
      ollamaModel: document.getElementById("ollamaModel").value,
      ollamaPrompt: document.getElementById("ollamaPrompt").value,
      calendarList: JSON.parse(calendarListRaw || "[]"),
      username: document.getElementById("username").value,
      password: document.getElementById("password").value
    };

    await browser.storage.local.set(newSettings);
    // 保存完了メッセージの多言語化
    alert(browser.i18n.getMessage("saveSuccess"));
  } catch (e) {
    // エラーメッセージの多言語化
    alert(browser.i18n.getMessage("saveError") + "\n" + e.message);
  }
});

