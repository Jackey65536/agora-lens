# Agora Lens 真实可用实施计划

版本：0.3
日期：2026-05-14
状态：阶段 1 已完成，阶段 2 的服务化部署已完成

## 目标

把 Agora Lens 从可展示的静态 Demo 推进到可真实试用的 MVP：用户可以输入真实市场信号，生成 market brief，保存和分享结果，后续再把证据哈希锚定到 Arc Testnet。

## 架构决策

- 先做垂直链路，不一次性重写：每一阶段都必须保持 `npm test`、`npm run lint`、`npm run build` 通过。
- 第一阶段保留前端 deterministic agent：它稳定、可测试，适合继续作为 fallback；后续再引入 LLM。
- 先加轻量 Node API 和文件持久化：避免引入数据库运维成本，先证明真实保存和分享流。
- 链上动作必须显式确认：钱包签名、私钥、助记词和真实资金不进入自动流程。
- 每个 brief 修改后都应重新生成证据哈希；链上只存 digest 和最小元数据，完整 trace 放链下。

## 阶段 1：可保存和可分享的 MVP

### Task 1：写入实施计划

**描述：** 在 repo 内记录从 Demo 到真实可用 MVP 的阶段计划、验收标准和风险。

**验收标准：**
- [x] 计划文件存在于 `docs/implementation-plan.zh-CN.md`
- [x] 计划拆成可验证的小任务

**验证：**
- [x] `git diff --check`

**依赖：** 无

**文件：**
- `docs/implementation-plan.zh-CN.md`

### Task 2：新增 brief 持久化 API

**描述：** 增加 Node 静态/API 服务，支持健康检查、保存 brief、按 ID 读取 brief、列出最近 brief。

**验收标准：**
- [x] `POST /api/briefs` 可以保存 `{ signal, brief }`
- [x] `GET /api/briefs/:id` 可以取回完整记录
- [x] `GET /api/briefs` 返回最近记录摘要
- [x] 无效请求返回 400

**验证：**
- [x] `npm test`
- [x] `npm run build`
- [x] 手动 `curl /api/health` 和 `curl /api/briefs/:id`

**依赖：** Task 1

**文件：**
- `server/briefStore.mjs`
- `server/index.mjs`
- `server/briefStore.test.mjs`
- `package.json`

### Task 3：前端接入保存和分享

**描述：** 在 evidence 面板增加保存 brief、复制分享链接、通过 `?brief=<id>` 加载归档 brief 的能力。

**验收标准：**
- [x] 用户点击保存后，UI 显示归档 ID
- [x] 复制分享链接后，链接包含 `?brief=<id>`
- [x] 打开分享链接可以恢复 brief 和原始 signal
- [x] API 不可用时显示清晰错误，不影响本地 agent 继续运行

**验证：**
- [x] `npm test`
- [x] `npm run lint`
- [x] `npm run build`
- [x] 浏览器打开生产服务，保存 brief 后刷新分享链接

**依赖：** Task 2

**文件：**
- `src/App.tsx`
- `src/App.css`
- `src/lib/briefArchive.ts`
- `src/lib/briefArchive.test.ts`

### Checkpoint 1：可真实保存的 MVP

- [x] 本地生产服务可运行
- [x] 在线服务器可以保存和读取 brief
- [x] GitHub main 已推送
- [x] 线上 Demo 已重新部署

## 阶段 2：稳定部署

### Task 4：生产部署服务化

**描述：** 用 systemd 或 PM2 管理 Node 服务，替代 `nohup + python http.server`。

**验收标准：**
- [x] 服务重启后自动恢复
- [x] 日志可查询
- [x] 部署脚本可以 build、上传、reload

**验证：**
- [x] `systemctl status agora-lens` 或 `pm2 status`
- [x] 重启服务后外网 Demo 正常

**文件：**
- `deploy/systemd/agora-lens.service`
- `scripts/deploy-server.sh`
- `README.md`

**当前状态：** 已安装为 `jackey` 用户级 systemd 服务 `agora-lens.service`，并启用
`loginctl enable-linger jackey`。已通过 SIGKILL 主进程验证 `Restart=always` 会自动拉起。

### Task 5：Nginx、域名和 HTTPS

**描述：** 把公网访问从裸 IP 端口升级为正式域名和 HTTPS。

**验收标准：**
- [ ] 域名解析到服务器
- [ ] Nginx 反代到 Node 服务
- [ ] HTTPS 证书可自动续期

**依赖：** 用户提供域名或确认使用现有域名

**当前状态：** 服务器已有 Nginx 并监听 80/443，但当前还没有项目域名；裸 IP HTTPS
不能申请正常浏览器信任的证书。下一步需要先提供域名并完成 DNS 解析。

### Task 5A：公网 API 基础防护

**描述：** 在跳过域名/HTTPS 的前提下，先补公开写入接口的最低限度防护。

**验收标准：**
- [x] `POST /api/briefs` 有按客户端 key 的固定窗口限流
- [x] 限流触发时返回 429 和 `Retry-After`
- [x] API 和静态响应带基础安全头
- [x] 限流参数可通过环境变量调整

**验证：**
- [x] `npm test`
- [x] `npm run lint`
- [x] `npm run build`
- [x] 临时生产服务设置 `AGORA_LENS_POST_RATE_LIMIT=2` 后，第三次 POST 返回 429

**文件：**
- `server/rateLimiter.mjs`
- `server/rateLimiter.test.mjs`
- `server/index.mjs`
- `deploy/systemd/agora-lens.service`

## 阶段 3：Arc Testnet 证据锚定

### Task 6：Trace anchoring 合约

**描述：** 编写最小 Arc Testnet 合约，只记录 trace hash、signal ID、publisher 和 URI。

**验收标准：**
- [x] 合约测试覆盖 ABI、事件、输入校验和 append-only 约束
- [x] 部署路径不包含私钥，使用浏览器钱包显式签名
- [x] UI 能展示交易哈希和 explorer 链接
- [x] HTTP 裸 IP 环境也能生成标准 SHA-256 `bytes32` trace hash
- [x] Arc Testnet 已完成一次真实部署和一次真实 trace anchoring

**依赖：** 钱包、测试网 USDC/gas、用户确认签名

**验证：**
- [x] `npm run contracts:compile`
- [x] `npm test`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `eth_getCode(0x19b8ea4ac5be5f6b4c4c86f874a911f80978c506)` 返回合约 bytecode
- [x] `isAnchored(0x9dd8004651df6deeae006b333f8702cdab7726dc23dc0d5aebdab3b62004cdc2)` 返回 `true`

**Arc Testnet 实测记录：**
- 合约地址：`0x19b8ea4ac5be5f6b4c4c86f874a911f80978c506`
- 部署交易：`https://testnet.arcscan.app/tx/0x08548941b9392f92c96918d5abc7e88ef8ca2da7817359091de8b22cabab1c83`
- 首次锚定交易：`https://testnet.arcscan.app/tx/0x61dc72ce8f900c1b38b0f1de3bf9dc697055b7d14e6a6a672c6a63791a075368`
- 首次锚定 brief：`http://60.204.151.206:18080/?brief=brief_20260514170832_e7433097`

**文件：**
- `contracts/TraceAnchor.sol`
- `contracts/TraceAnchor.test.mjs`
- `scripts/compile-contracts.mjs`
- `src/contracts/traceAnchor.ts`
- `src/lib/traceAnchor.ts`
- `src/lib/traceAnchor.test.ts`
- `src/lib/sha256.ts`
- `src/lib/sha256.test.ts`
- `.env.production`

### Task 7：钱包连接和用户确认流

**描述：** 接入 MetaMask/Rabby，所有链上写入都由用户显式签名。

**验收标准：**
- [x] 不读取私钥或助记词
- [x] 钱包未连接时可以继续本地保存
- [x] 可检测 EIP-1193 钱包并在用户点击后连接
- [x] 可请求钱包切换或添加 Arc Testnet
- [x] 链上写入前展示清晰确认内容
- [x] 只有用户点击确认后才调用 `eth_sendTransaction`

**验证：**
- [x] `npm test`
- [x] `npm run lint`
- [x] `npm run build`
- [x] 浏览器无钱包环境下 UI 正常降级，无 console error

**文件：**
- `src/lib/wallet.ts`
- `src/lib/wallet.test.ts`
- `src/components/TraceAnchorPanel.tsx`
- `src/lib/traceAnchor.ts`
- `src/App.tsx`
- `src/App.css`

## 阶段 4：真实信号和 LLM

### Task 8：真实数据源导入

**描述：** 支持手动 URL、RSS、研究笔记和社交信号导入。

**验收标准：**
- [x] 支持公开 URL 导入，并提取页面标题和正文
- [x] 支持 RSS/Atom 导入，并保留 item URL 和发布时间
- [x] 支持研究笔记和社交信号粘贴导入
- [x] 每条 rationale 可以绑定来源 URL 和时间戳
- [x] 重复来源会被去重
- [x] 远程 URL 导入会拦截本机/私网目标，避免 SSRF 基础风险

**验证：**
- [x] `npm test -- server/sourceImporter.test.mjs src/lib/sourceImport.test.ts`
- [x] `npm test -- src/lib/agoraAgent.test.ts server/briefStore.test.mjs`
- [x] `npm run build`

**文件：**
- `server/sourceImporter.mjs`
- `server/sourceImporter.test.mjs`
- `server/index.mjs`
- `src/lib/sourceImport.ts`
- `src/lib/sourceImport.test.ts`
- `src/lib/agoraAgent.ts`
- `src/lib/agoraAgent.test.ts`
- `src/App.tsx`
- `src/App.css`
- `server/briefStore.mjs`
- `server/briefStore.test.mjs`

### Task 9：LLM 生成 + 规则校验

**描述：** LLM 负责翻译和草拟市场，规则层负责结算标准、风险和 JSON schema 校验。

**验收标准：**
- [ ] LLM 输出必须通过 schema
- [ ] 失败时返回人工补充提示
- [ ] 保留 deterministic agent 作为 fallback

## 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 自动生成错误市场 | 高 | 人工审核、risk flags、invalid 条件、来源引用 |
| 服务器重启导致 Demo 掉线 | 中 | systemd/PM2 + Nginx |
| API 被刷写入垃圾数据 | 中 | body size limit、基础 rate limit、后续登录 |
| 链上交易误签 | 高 | 用户显式确认，不自动签名，不保存密钥 |
| LLM 幻觉来源 | 高 | 来源 URL 必填、schema 校验、人工审批 |

## 当前执行顺序

1. Task 1：写入实施计划。
2. Task 2：新增 brief 持久化 API。
3. Task 3：前端保存和分享。
4. Checkpoint 1：部署新版到服务器。
5. Task 4/5：稳定服务和正式入口。
6. Task 6/7：Arc Testnet 锚定。
7. Task 8：真实数据源导入。
8. Task 9：LLM 生成 + 规则校验。
