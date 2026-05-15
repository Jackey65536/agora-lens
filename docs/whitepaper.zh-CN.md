# Agora Lens 中文白皮书

版本：0.1
日期：2026-05-14
状态：Hackathon MVP 技术白皮书
在线 Demo：http://60.204.151.206:18080/
代码仓库：https://github.com/Jackey65536/agora-lens

## 摘要

Agora Lens 是一个面向预测市场和链上金融代理的多语言市场信号分析系统。它的目标不是替代交易员，也不是自动执行真实资金交易，而是把分散在新闻、社交媒体、研究笔记和交易社区里的非结构化信息，转化为可审查、可复核、可锚定的预测市场提案。

当前 MVP 已经实现一个本地确定性代理：用户输入一段市场信号，系统会识别语言、分类主题、生成英文市场命题、给出初步概率和置信度、标记风险，并生成一个适合后续写入 Arc Testnet 的证据包。证据包包含稳定序列化后的 agent trace 摘要、SHA-256 哈希、Arc Testnet chain ID、USDC 结算资产标识和可复制的 JSON 输出。

Agora Lens 的长期愿景是成为“市场问题生成层”：让 AI agents 不只是给出交易建议，而是把它们的推理过程、信息来源和市场定义变成可追踪的公共资产。对于预测市场、宏观事件、跨语言新闻、社交交易信号和链上资金流，真正有价值的不只是最后的 YES/NO，而是一个问题为什么值得被市场定价、如何结算、哪些信息支持它，以及风险在哪里。

## 背景与问题

预测市场的核心价值是信息聚合。一个好的市场问题可以把不确定事件变成可交易、可对冲、可解释的概率。但在现实中，许多高价值信息并不会自然变成高质量预测市场。

主要瓶颈包括：

- 多语言信息无法及时进入英文预测市场。中文宏观新闻、西语政策讨论、地区性监管消息，常常先在本地语境里出现，等被英语市场理解时，价格机会已经过去。
- 市场问题的书写难度高。一个可交易的问题需要明确事件边界、时间窗口、结算标准、无效条件和数据来源。
- AI 推理缺乏可审计性。很多 agent 输出只有一句结论，缺少来源、步骤、概率形成逻辑和风险说明。
- 链上结算成本和用户体验限制了高频、低金额的 agent 交互。预测、报价、翻译、推荐、验证等微型行为需要低成本且可追踪的结算层。

Agora Lens 选择从“翻译与市场生成”切入：先把多语言市场信号转化为英文预测市场 brief，再把 agent trace 做成可哈希证据包。这样即使当前阶段不执行真实交易，也可以建立后续链上锚定、声誉、奖励和市场创建的基础。

## 产品定位

Agora Lens 是一个 market-intelligence agent，而不是交易机器人。它面向三类用户：

- 市场创建者：需要把新闻、政策、研究和社区信号转化为高质量预测市场。
- 研究员和交易员：需要快速比较多个信号的可交易性、可信度和结算可行性。
- Agent 开发者：需要让自己的推理输出可以被记录、验证、复用和商业化。

当前 MVP 的第一屏就是可用工作台，而不是营销落地页。用户可以选择样例信号，也可以粘贴自己的原始文本，然后运行 agent。输出分为三块：

- Signal intake：输入原始多语言信号。
- Agent output：显示市场命题、概率、置信度、推理依据和风险。
- Arc packet：显示 chain ID、结算资产、trace hash 和可复制 JSON。

## 当前实现

当前版本使用 React、TypeScript、Vite 和轻量 Node API 构建。为了保证 hackathon demo 稳定，它保留 deterministic agent 作为默认和 fallback；当服务端配置 `OPENAI_API_KEY` 时，可以通过服务端调用 LLM 草拟翻译、市场问题、概率和 rationale。浏览器不会接触 LLM API key，规则层仍负责结算条件、风险闸门、来源绑定和证据哈希。它不会触碰真实交易账户、私钥、助记词或资金。

核心逻辑位于 `src/lib/agoraAgent.ts`。处理流程如下：

1. Ingest：接收用户输入或样例信号，清理链接和多余空白。
2. Detect：根据字符和关键词识别中文、西语或英语。
3. Classify：把信号映射到宏观政策、预测市场垂直、社交交易情报、加密市场结构等类别。
4. Translate：把非英语信号转化为英文市场 thesis。
5. Price：根据来源类型、数字触发器、官方/多源信号、早期/未确认标记等因素生成初步概率。
6. Gate：输出 low、medium 或 high 置信度，并标记翻译漂移、数据不足、来源不确定等风险。
7. Draft：生成 YES/NO 市场问题、结算标准和无效条件草案。
8. Anchor：把证据包稳定序列化并生成 SHA-256 trace hash，准备后续写入 Arc。

当前样例覆盖三类场景：

- 中文宏观政策信号：把人民币、央行公开市场操作、港股地产和美元债消息转成英文预测市场问题。
- Hyperliquid whale migration：检测社交交易和 top trader 迁移信号。
- 西语能源政策讨论：识别尚未进入英语预测市场的本地政策事件。

## 技术架构

Agora Lens 当前采用前端本地 agent 架构：

```text
Raw signal
  -> normalization
  -> language detection
  -> category classifier
  -> thesis translator
  -> probability estimator
  -> risk gate
  -> contract sketcher
  -> evidence packet builder
  -> SHA-256 trace hash
```

这种架构的优点是：

- Demo 稳定：不依赖第三方 API 可用性。
- 无敏感数据：不需要用户登录、钱包、私钥或资金。
- 可测试：核心 agent 函数可以通过单元测试覆盖。
- 可迁移：未来可把 deterministic rules 替换或增强为 LLM、检索、链上数据和外部 API。

当前应用的安全边界很明确：它只生成市场 brief 和证据包，不自动下注、不自动转账、不保存密钥、不发起链上交易。

## Arc 与 USDC 证据锚定

Agora Lens 的链上设计不是“把全文推理都放上链”，而是把完整 trace 存在链下，再把哈希写入链上。这样可以兼顾透明度、成本、隐私和可验证性。

当前证据包包含：

```json
{
  "network": "Arc Testnet",
  "chainId": 5042002,
  "settlementAsset": "USDC",
  "traceHash": "0x...",
  "storagePlan": "Pin full trace JSON offchain, then write this SHA-256 digest to an Arc contract event or memo field.",
  "payload": {
    "agent": "Agora Lens local agent v0.1",
    "signalId": "...",
    "generatedAt": "...",
    "marketQuestion": "...",
    "probability": 60,
    "confidence": "medium",
    "rationale": ["..."],
    "resolution": "..."
  }
}
```

下一阶段可以部署一个简单的 Arc Testnet 合约：

```solidity
event TraceAnchored(
    bytes32 indexed traceHash,
    string signalId,
    address indexed publisher,
    uint64 generatedAt
);
```

链下保存完整 trace，链上保存 digest 和最小元数据。任何人都可以重新计算哈希，验证某个市场问题、概率和推理依据是否被篡改。

Arc 适合这个场景的原因在于：它是 EVM-compatible 的 stablecoin-native L1，Arc Testnet 使用 USDC 作为费用和资产语境，chain ID 为 5042002。对于 agent 经济中的高频、低金额、可审计行为，稳定计价和可预测费用比传统波动 gas token 更易理解。

## 市场机制设想

Agora Lens 的输出可以服务于四类市场机制：

### 1. 市场创建前置层

Agent 先生成问题、结算标准、无效条件和证据包。市场创建者审阅后，再决定是否创建真实预测市场。

### 2. 翻译即 alpha

非英语市场信号常常先出现于本地语境。Agora Lens 可以让 agents 竞争“谁最早把本地信息翻译成可交易问题”，并把后续市场创建费、builder fee 或声誉回流给翻译者。

### 3. Trace 市场

用户不只评价某个预测是否正确，也评价某种推理模式是否持续产生有用市场。长期来看，推理 trace 可以形成可比较的数据资产。

### 4. Agent 声誉与奖励

每个 agent 输出都可以被哈希锚定。后续如果市场结算证明该问题有价值，可以把奖励分配给最早生成有效问题、提供证据、改进结算规则的参与者。

## 风险控制

Agora Lens 默认把风险显式展示，而不是藏在概率数字后面。

主要风险包括：

- 翻译漂移：非英语信号转成英语问题时，语义可能发生偏移。
- 结算模糊：市场问题如果没有客观数据源，后续容易产生争议。
- 来源可信度不足：早期传闻、多源二手信息和社交媒体截图都需要置信度折扣。
- 市场操纵：agent 可能被诱导生成对某个仓位有利的问题。
- 过度自动化：如果直接接入自动交易，错误问题会变成真实资金损失。

当前 MVP 的缓解方式：

- 不自动交易。
- 不接管钱包。
- 不处理真实资金。
- 每个输出都包含 risk flags。
- 每个市场问题都附带 resolution 和 invalid 条件。
- 证据包可复制、可检查、可重新哈希。

未来版本还应加入人工审批、来源引用、重复市场检测、oracle 可用性检查、异常概率检测和反操纵提示。

## 商业模式

Agora Lens 不需要发行代币即可商业化。潜在模式包括：

- 专业版研究工作台：面向交易员、市场创建者和研究团队。
- Agent API：把多语言信号转为市场 brief 的 API 调用收费。
- Builder fee 分成：当 Agora Lens 生成的问题或推荐带来真实交易流时，按 fill 或市场创建收入分成。
- 市场创建 SaaS：为社区、公司和 DAO 提供内部预测市场创建工具。
- Trace 数据订阅：高质量 agent trace 可作为研究、回测和训练数据。

短期内，最重要的不是收费，而是证明两个指标：

- 能否持续生成人类愿意审阅的高质量市场问题。
- 能否比人工更早发现跨语言、跨市场的信息差。

## 路线图

### v0.1：Hackathon MVP

- 本地 deterministic agent。
- 多语言样例输入。
- 市场问题、概率、置信度、风险和证据包输出。
- 静态在线 Demo 和公开 GitHub repo。

### v0.2：真实信号与来源引用

- 接入新闻、社交、研究笔记和链上数据来源。
- 给每条 rationale 附来源 URL 和时间戳。
- 增加重复市场检测。
- 增加人工审批流。

### v0.3：Arc Testnet 锚定

- 部署 trace anchoring 合约。
- 支持钱包签名和测试网交易。
- 将 trace hash 写入 Arc Testnet。
- 在 UI 中展示交易哈希和 explorer 链接。

### v0.4：市场生命周期

- 支持从 brief 进入市场创建草稿。
- 支持 oracle/resolution 数据源检查。
- 增加结算后复盘：预测是否命中、问题是否有效、trace 是否有价值。

### v1.0：Agent 市场网络

- 多 agent 竞争生成问题。
- Trace reputation。
- Builder fee / reward 分配。
- API 与第三方预测市场、钱包和结算系统集成。

## 评审匹配

Agora Lens 对 Agora Agents Hackathon 的评审标准有明确对应：

- Agentic Sophistication：系统不只是格式化文本，而是完成分类、翻译、概率估计、风险门控、市场合约草案和证据锚定准备。
- Traction：当前可通过公开 Demo 收集用户输入、比较不同信号质量，并让评委直接试用。
- Circle tool usage：当前证据包面向 Arc Testnet 和 USDC 结算语境设计，下一阶段可接入 Arc RPC、钱包和合约。
- Innovation：把“跨语言市场问题生成”和“可哈希 agent trace”结合，关注的是推理过程本身如何成为市场基础设施。

## 免责声明

Agora Lens 当前不是金融顾问、交易系统、券商、交易所或托管钱包。所有概率、市场问题和风险提示仅用于研究、产品演示和 hackathon 评审，不构成投资建议。当前 MVP 不使用真实资金，不执行交易，不保存私钥，不要求用户提供助记词。

如果未来接入真实交易或链上资产，必须加入更严格的合规、风控、审计、权限控制和用户确认机制。

## 参考资料

- Agora Agents Hackathon：https://agora.thecanteenapp.com/
- Arc Developer Docs：https://docs.arc.network/
- Connect to Arc：https://docs.arc.network/arc/references/connect-to-arc
- Arc EVM Compatibility：https://docs.arc.network/arc/references/evm-compatibility
- Arc Gas and Fees：https://docs.arc.network/arc/references/gas-and-fees
