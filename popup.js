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
    eventType: getEl("eventType"),    // ★追加: 予定/タスク切り替え用
    isAllDay: getEl("isAllDay"),
    startDate: getEl("startDate"),
    startTime: getEl("startTime"),
    endDate: getEl("endDate"),
    endTime: getEl("endTime"),
    location: getEl("location"),
    description: getEl("description"),
    calendarSelect: getEl("calendarSelect"),
    registerBtn: getEl("registerBtn")
  };

  applyI18n();

  // --- 2. 終日チェックボックスの連動ロジック ---
  el.isAllDay.addEventListener("change", () => {
    const checked = el.isAllDay.checked;
    el.startTime.disabled = checked;
    el.endTime.disabled = checked;

    if (checked) {
      el.endDate.value = el.startDate.value;
      el.startTime.style.opacity = "0.5";
      el.endTime.style.opacity = "0.5";
    } else {
      el.startTime.style.opacity = "1";
      el.endTime.style.opacity = "1";
    }
  });

  el.startDate.addEventListener("change", () => {
    if (el.isAllDay.checked) {
      el.endDate.value = el.startDate.value;
    }
  });

  // --- 3. URL引数からデータを解析して表示 ---
  const urlParams = new URLSearchParams(window.location.search);
  const eventParam = urlParams.get("event");

if (eventParam) {
    try {
      const eventData = JSON.parse(decodeURIComponent(eventParam));
      
      // 基本は "event" をデフォルトとし、AIが明確に "todo" を指定した時のみ反映
      if (el.eventType) {
        el.eventType.value = (eventData.type === "todo") ? "todo" : "event";
      }

      el.title.value = eventData.title || "";
      el.location.value = eventData.location || "";
      el.description.value = eventData.description || "";    

      // ★AIからの判定 (event or todo) を反映
      if (el.eventType && eventData.type) {
        el.eventType.value = eventData.type;
      }

      el.isAllDay.checked = !!eventData.isAllDay;

      if (eventData.start) {
        const [d, t] = eventData.start.split("T");
        el.startDate.value = d;
        el.startTime.value = t || "09:00";
      }
      if (eventData.end) {
        const [d, t] = eventData.end.split("T");
        el.endDate.value = d;
        el.endTime.value = t || "10:00";
      }

      el.isAllDay.dispatchEvent(new Event('change'));
      
    } catch (e) {
      console.error("JSON解析エラー", e);
    }
  }

  // --- 4. カレンダー一覧取得 --- (省略: 変更なし)
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
      opt.textContent = browser.i18n.getMessage("noCalendarWarning");
      el.calendarSelect.appendChild(opt);
      el.registerBtn.disabled = true;
    }
  } catch (e) { console.error(e); }

  // --- 5. 登録ボタンのイベント ---
  el.registerBtn.addEventListener("click", async () => {
    el.registerBtn.disabled = true;
    const originalBtnText = el.registerBtn.textContent;
    el.registerBtn.textContent = browser.i18n.getMessage("registeringStatus");

    const isAllDay = el.isAllDay.checked;
    
    // background.js へ送るデータの構築
    const updatedEvent = {
      type: el.eventType ? el.eventType.value : "event", // ★ type を追加
      title: el.title.value,
      start: isAllDay ? el.startDate.value : `${el.startDate.value}T${el.startTime.value}`,
      end: isAllDay ? el.endDate.value : `${el.endDate.value}T${el.endTime.value}`,
      location: el.location.value,
      description: el.description.value,
      isAllDay: isAllDay
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
      el.registerBtn.textContent = originalBtnText;
    }
  });
})();
