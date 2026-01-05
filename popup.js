(async () => {
  // --- 1. 要素の取得 (IDがHTMLに存在するか厳密にチェック) ---
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

  // 取得漏れチェック（デバッグ用）
  for (const [key, value] of Object.entries(el)) {
    if (!value) {
      console.error(`要素が見つかりません: id="${key}"`);
      return; // 1つでも欠けていたら実行を止める
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
      opt.textContent = "設定画面でカレンダーを登録してください";
      el.calendarSelect.appendChild(opt);
      el.registerBtn.disabled = true;
    }
  } catch (e) {
    console.error("カレンダー取得失敗", e);
  }

  // --- 4. 登録ボタンのイベント (旧コードの saveAuth などは含めない) ---
  el.registerBtn.addEventListener("click", async () => {
    el.registerBtn.disabled = true;
    el.registerBtn.textContent = "登録中...";

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
        alert("登録に成功しました！");
        window.close();
      } else {
        alert("登録失敗: " + (res?.error || "不明なエラー"));
      }
    } catch (e) {
      alert("通信エラーが発生しました");
    } finally {
      el.registerBtn.disabled = false;
      el.registerBtn.textContent = "カレンダーに登録";
    }
  });
})();
