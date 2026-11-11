# 🗓️ 面試行事曆 (Job Interview Calendar PWA)

> 一款專為求職者打造的高效面試行程管理工具，支援 AI 信件截圖解析、Notion CSV 資料匯入、時間衝突預警、自訂 React Combobox 與動態面試統計儀表板。

---

## ✨ 核心特色 (Key Features)

- 🤖 **AI 截圖自動辨識**：整合 Gemini API，上傳面試邀請 Email 截圖即可自動提取公司名稱、日期與時間並一鍵帶入表單。
- 📊 **求職統計儀表板 (Dashboard)**：即時計算總面試場次、關卡分佈，並支援點擊「面試公司數」動態展開不重複應徵公司清單。
- 📥 **Notion CSV 批次匯入**：支援一鍵匯入 Notion 求職追蹤表（Job Tracker）的 CSV 資料並自動轉換格式。
- ⚠️ **時間衝突預警 (Collision Warning)**：新增行程時自動比對同日期的時間區間，若時段重疊即時給予黃色醒目警告。
- 📝 **獨立面試紀錄 Modal**：面試結束後可獨立填寫/編輯檢討筆記、面試考題與 Follow-up 備忘錄，不影響原始時間欄位。
- 📱 **iOS PWA 支援與雙向無限滾動**：針對 Mobile Safari 優化，支援「加入 iPhone 主畫面」以全螢幕運行；日曆支援雙向無限向下滾動與平滑捲動回到當月 (`scrollToThisMonth`)。
- ⚡ **智慧 UX 優化**：選擇開始時間自動連動 +1 小時結束時間；自訂 React Combobox 兼具歷史公司下拉搜尋與自由手動輸入。
- 🔐 **多租戶資料隔離 (User Data Isolation)**：整合 Firebase Authentication (匿名認證)，所有面試行程皆儲存於個人專屬路徑 `users/{uid}/events`，確保用戶個人求職隱私不外洩。
- 📱 **雙欄式動態側邊欄 (Sidebar List)**：
  - **狀態分流**：提供「即將到來 (Upcoming)」與「已完成 (Completed)」頁籤，依據日期自動歸類面試卡片。
  - **卡片快捷操作**：卡片直觀顯示「已確認/提議中」與「線上/實體」標籤，並支援一鍵開啟「面試檢討筆記」與「快速修改行程」。
  - **底部固定操作區**：側邊欄底部常駐「新增行程 / 提議時段」主要按鈕與「Notion CSV 匯入」入口，符合單手操作與直覺點擊習慣。

---

## 🛠️ 技術棧 (Tech Stack)

- **前端框架**：React + Vite
- **UI 樣式與圖示**：Tailwind CSS + Lucide React Icons
- **後端與資料庫**：Firebase Auth (匿名認證) + Firestore (Realtime Data Sync)
- **AI 服務**：Google Gemini API
- **部署模式**：iOS Progressive Web App (PWA)

---

## ⚖️ 架構取捨與設計決策 (Design Trade-offs)

1. **棄用原生 `<datalist>`，改寫自訂 React Combobox (相容性取捨)**：
   原生 `<datalist>` 在 iOS Safari 行動端常有點擊下拉選單失靈的 Bug。改為自訂 React `Combobox` 並結合 `click outside` 監聽，徹底解決跨裝置相容性。
2. **抽離「面試紀錄」為獨立 Modal (表單 UX 取捨)**：
   將面試後的檢討筆記與考題備忘錄從主行程表單中解耦，防止求職者在填寫筆記時誤觸或修改到原始的日期與時間資料。
3. **移除視覺干擾的 Tag 標籤 (視覺簡化)**：
   移除卡片上過多的「(已結束)」舊標籤，改以「即將到來 / 已完成」分頁與簡潔的橫向單行卡片排版，呈現極致流暢的視覺體驗。
4. **採用 Firebase 匿名登入 (Onboarding 門檻取捨)**：
   使用 `signInAnonymously` 降低使用者試用門檻，無需經歷繁瑣的註冊流程即可立即體驗雲端即時同步。


## 🔐 資安與數據結構 (Security & Data Architecture)

為了滿足多用戶使用時的數據安全與隱私需求，本專案實施嚴格的 Firestore 安全規則與 UID 路徑隔離：

### 數據隔離路徑 (Firestore Structure)
```text
users/
  └── {userId}/
        └── events/
              └── {eventId} (面試行程資料)

---

## 🚀 Git Commit 演進紀錄 (Atomic Commit Roadmap)

本專案採用規範的 **Atomic Commit** 進行版控，展現完整的產品反覆運算與技術思維：

1. `feat: create interview calendar MVP` - 基礎日曆與 Firebase CRUD
2. `feat: add Notion CSV data import` - CSV 解析與批次寫入 Firestore
3. `feat: add schedule time collision warning` - 時間衝突比對演算法
4. `feat: add AI-powered interview screenshot parsing` - 整合 Gemini API 截圖自動辨識
5. `ux: auto-set end time to +1 hour on start time change` - 開始時間連動結束時間 (+1hr)
6. `fix: add infinite calendar scroll and smooth scroll to current month` - 無限向下滾動與回到本月平滑捲動
7. `style: refactor calendar card layout and update iOS PWA touch icon` - 卡片排版優化、修復手機破版與 PWA Icon
8. `feat: add dedicated post-interview notes record modal` - 獨立的面試後紀錄/筆記 Modal
9. `feat: add dashboard insights with interactive company list breakdown` - 統計 Modal 與點擊公司數展開清單
10. `refactor: replace native datalist with custom React company combobox` - 棄用原生 datalist，改用自訂 Combobox 解決行動端相容性
11. `docs: add project documentation and architecture design trade-offs` - 補充完整專案說明與架構設計決策文件

---

## 🔧 如何在本地端執行 (Getting Started)

```bash
# 複製專案
git clone https://github.com/kelseyyyychang/interview-calendar.git

# 安裝依賴
npm install

# 設定環境變數 (.env.local)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
...

# 啟動本地開發伺服器
npm run dev