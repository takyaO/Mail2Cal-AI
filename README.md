# Mail to Calendar AI (Thunderbird Add-on)

Thunderbirdで受信したメールの内容をローカルAI（Ollama）で解析し、CalDAVカレンダー（ownCloud/Nextcloud等）へ予定をシームレスに登録するアドオンです。既存の標準機能やアドオンでは不十分だった「日本語メールの高度な解析」を、LLMの力で解決するために作成しました。

A Thunderbird add-on that analyzes email content using a local AI (Ollama) and seamlessly registers events to CalDAV calendars (ownCloud, Nextcloud, etc.). 
Created to solve the limitations of standard features by leveraging LLMs for high-precision extraction, especially effective for complex email contexts.

---

## Features / 特徴

* **Privacy Focused / プライバシー重視**
  * Uses *Ollama* running locally. Email content is never sent to external cloud APIs.
  * ローカルで動作する Ollama を使用するため、メールの内容が外部に送信される心配がありません。
* **Calendar Integration / カレンダー連携**
  * Directly registers events to CalDAV servers via PUT requests.
  * ownCloud や Nextcloud などの CalDAV サーバーへ直接予定を登録します。
* **AI-Powered Extraction / 自動抽出**
  * LLM (e.g., Qwen2.5) automatically extracts Title, Date/Time, Location, and Details.
  * AIがメールから情報を自動抽出。曖昧な表現や日本語の文脈を的確に理解します。

---

## Setup / セットアップ

### 1. Installation / アドオンのインストール
* Download the latest `mail2cal.xpi` from [Releases].
*  In Thunderbird, go to "Add-ons and Themes" > Gear icon > "Install Add-on From File...".
* Select the `.xpi` file and confirm the permissions.

* 最新の `mail2cal.xpi` を [Releases] からダウンロードします。
* Thunderbird の「アドオンとテーマ」画面の歯車アイコンから「ファイルからアドオンをインストール」を選択します。
* ダウンロードした `.xpi` を選択し、必要な権限を確認してインストールします。

### 2. Configuration / 設定
Configure the following in the Add-on Options / アドオンの設定画面で以下を入力してください:

* **CalDAV Credentials**: Server username and password. 
* **Calendar List**: URLs and display names in JSON format.
* **Ollama Info**: API URL (e.g., `http://localhost:11434`) and Model name.
* **AI Prompt**: Customize the instruction (Variables like `{{subject}}` are auto-replaced).

 * **CalDAV認証情報 (OwnCloud)** ：CalDAV サーバーのユーザー名とパスワード
* **カレンダー一覧**: 保存先カレンダーのURLと表示名を JSON 形式で入力。
* **Ollama 情報**: API URL（例: `http://localhost:11434`）とモデル名（例: `qwen2.5:7b`）。
* **AIプロンプト**: {{date}}, {{subject}}などの変数はコード側で置換します 
---

## Usage / 使い方

1. **Right-click** in the email body area. / メールの本文エリアで**右クリック**します。
2. Select **"Mail to Calendar AI"**. / **「Mail to Calendar AI」**を選択します。
3. Review and edit the AI analysis results in the popup. / 表示されたポップアップで解析結果を確認・修正します。
4. Select the target calendar and click **"Register to Calendar"**. / 登録先を選んで**「カレンダーに登録」**をクリックします。

---

## License
MIT License
