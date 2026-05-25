# TODO - CTRCHK Support Mode / Admin Tools / Discord Button

## 0. 客服模式（Support Threads）
- [x] 擴充資料庫：`support_threads` + `chat_messages.thread_id`（含索引）
- [x] `api/chat.js`：新增 GET `support_threads` / `support_messages`
- [x] `api/chat.js`：新增 POST `start_support_thread` / `support_claim` / `support_send`
- [ ] `chat.html`：支援 `/chat?support=1&thread_id=...` 进入客服模式
- [ ] `chat.html`：在聊天页加入「客服」按钮（触发 `start_support_thread`；显示提示文案 + Discord 入口文案）
- [ ] `admin.html`：新增「客服模式」tab（claimed 才显示输入，其他只读）
- [ ] `notification`：统一客服 thread 的 push url / tag 与前端读取逻辑一致

## 1. 管理員頁：更改用戶里程數和卡級
- [ ] 確認資料表欄位（里程/卡級）實際存在哪：`user_game_profile` / 其他表
- [ ] `api/admin-users.js`：新增 action 更新里程/卡級
- [ ] `admin.html`：新增輸入欄位與儲存按鈕

## 2. 主頁：加入 Discord 按鈕
- [ ] `index.html`：加入按鈕（`https://discord.gg/hkQNZ6UADC`）
- [ ]（如需）app home：加入按鈕

## 3. 測試 / 驗證
- [ ] 流程：user 點客服 -> 多个 senior_admin 收到 push -> first claim 可回覆
- [ ] 流程：其他 senior_admin 只能觀看，不可回覆
- [ ] UI：客服按鈕提示文案與 Discord 入口顯示
- [ ] 部署：確保無新增超過 Vercel 的 serverless function 數量（本專案優先集中到既有 `api/chat.js`）

