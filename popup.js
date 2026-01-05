(async () => {
  // --- 多言語化適用関数 ---
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const msg = browser.i18n.getMessage(el.getAttribute('data-i18n'));
      if (msg) el.textContent = msg;
    });
  }

  // --- 1. 要素の取得 ---
  const getEl = (id) => document.getElementById(id);
  
  const el = {
    title: getEl("title"),
    start: getEl("start"),
    end: getEl("end"),
    location: getEl("location"),
    description: getEl("description"),
    calendarSelect: getEl("calendarSelect"),
    registerBtn: getEl("registerBtn")
  };

  // 翻訳の適用
  applyI18n();

  for (const [key, value] of Object.entries(el)) {
    if (!value) {
      console.error(`要素が見つかりません: id="${key}"`);
      return;
    }
  }

  // --- 2. URL引数からイベントデータを解析して表示 ---
  const urlParams = new URLSearchParams(window.location.search);
  const eventParam = urlParams.get("event");
  
  if (eventParam) {
    try {
      const eventData = JSON.parse(decodeURIComponent(eventParam));
      el.title.value = eventData.title || "";
      el.start.value = eventData.start || ""; 
      el.end.value = eventData.end || "";
      el.location.value = eventData.location || "";
      el.description.value = eventData.description || "";
    } catch (e) {
      console.error("JSON解析エラー", e);
    }
  }

  // --- 3. カレンダー一覧をバックグラウンドから取得 ---
  try {
    const resp = await browser.runtime.sendMessage({ type: "getCalendars" });
    if (resp && resp.calendars && resp.calendars.length > 0) {
      resp.calendars.forEach(cal => {
        const opt = document.createElement("option");
        opt.value = cal.id;
        opt.textContent = cal.name;
        el.calendarSelect.appendChild(opt);
      });
    } else {
      const opt = document.createElement("option");
      // 辞書から「カレンダーを登録してください」を取得
      opt.textContent = browser.i18n.getMessage("noCalendarWarning");
      el.calendarSelect.appendChild(opt);
      el.registerBtn.disabled = true;
    }
  } catch (e) {
    console.error("カレンダー取得失敗", e);
  }

  // --- 4. 登録ボタンのイベント ---
  el.registerBtn.addEventListener("click", async () => {
    el.registerBtn.disabled = true;
    // 「登録中...」を多言語化
    el.registerBtn.textContent = browser.i18n.getMessage("registeringStatus");

    const updatedEvent = {
      title: el.title.value,
      start: el.start.value,
      end: el.end.value,
      location: el.location.value,
      description: el.description.value
    };

    try {
      const res = await browser.runtime.sendMessage({
        type: "addEvent",
        calendarId: el.calendarSelect.value,
        eventData: updatedEvent
      });

      if (res && res.ok) {
        alert(browser.i18n.getMessage("registerSuccess"));
        window.close();
      } else {
        alert(browser.i18n.getMessage("registerFail") + ": " + (res?.error || "Unknown Error"));
      }
    } catch (e) {
      alert(browser.i18n.getMessage("communicationError"));
    } finally {
      el.registerBtn.disabled = false;
      // 元のボタンテキストに戻す
      el.registerBtn.textContent = browser.i18n.getMessage("registerBtn");
    }
  });
})();
