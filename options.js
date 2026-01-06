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
    let settings = await browser.storage.local.get();

    if (!settings.ollamaPrompt || !settings.calendarList || settings.calendarList.length === 0) {
      settings = await getDefaultsWithRetry();
    }

    const promptEl = document.getElementById("ollamaPrompt");
    if (promptEl) {
      promptEl.value = settings.ollamaPrompt || "";
    }

    // ===============================
    // reset ボタン（完全版）
    // ===============================
    const resetBtn = document.getElementById("resetPromptButton");
    if (resetBtn && !resetBtn.dataset.bound) {
      resetBtn.dataset.bound = "true"; // 二重登録防止

      resetBtn.addEventListener("click", async () => {
        try {
          const defaults = await getDefaultsWithRetry();

          promptEl.value = defaults.ollamaPrompt || "";

          // ★ storage も即リセット（推奨）
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

document.getElementById("save").addEventListener("click", async () => {
  try {
    const calendarListRaw = document.getElementById("calendarList").value;
    const newSettings = {
      ollamaUrl: document.getElementById("ollamaUrl").value,
      ollamaModel: document.getElementById("ollamaModel").value,
      ollamaPrompt: document.getElementById("ollamaPrompt").value,
      
      // --- 追加：autoTodo の値を保存 ---
      autoTodo: document.getElementById("autoTodo").checked,

      calendarList: JSON.parse(calendarListRaw || "[]"),
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
//initOptions();
document.addEventListener("DOMContentLoaded", () => {
  initOptions();
});
