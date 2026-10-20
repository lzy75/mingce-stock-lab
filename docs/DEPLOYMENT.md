# 交付与部署状态（2026-10-20）

## 当前状态（优先于后面的历史记录）
- 单一宽大策略输入、下方条件/名单/证据、超过20只的研究池自动分批均已发布于第7版。
- 第7版独立生产验收两次失败：2026-10-19 21:12与2026-10-20 10:15（北京时间），公开入口与配置返回200；真实案例在扶摇MCP环节返回HTTP530，应用返回502。不是旧403入口问题，不能使用第6版通过记录替代本次结果。
- 2026-10-20本机使用同一授权直连官方文档、MCP初始化与REST行情均HTTP200；线上与本机存在出站链路差异。Cloudflare官方将530定义为源站域名解析问题，具体子码需线上诊断确认：https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-530/
- 新增MCP530诊断编号及请求标识透传；只保留数字错误码，不回传上游HTML或密钥。验收摘要保留业务错误；错误HTTP不能被内容检查覆盖为通过。三类生产检查独立运行，整体失败仍保留失败状态。
- 当前92项自动测试与类型检查通过。最新发布与生产结果见下方追加记录；账户写入与手机/PC自选互通尚未验证。

## 历史交付摘要

- 网页：https://mingce-stock-lab.justslug1.chatgpt.site
- 托管发布：已成功，public；服务端金融数据Secret已配置，前端/源码未包含密钥。
- 应用验证：82项自动测试通过，TypeScript检查通过；生产构建与密钥扫描通过。
- 生产主链路：GitHub独立运行器已验证AI/MCP/筛选/证据链路，Worker日志验收ID一致。本地浏览器交互通过；生产浏览器自动点击检查仍遇工具超时。旧环境403保留作历史记录。
- GitHub目标：https://github.com/lzy75/mingce-stock-lab 。聊天GitHub连接只读；用户已完成官方GitHub CLI登录，系统钥匙串授权有效，通过CLI上传本项目。最终提交SHA以GitHub main为准。
- 模型：已配置DeepSeek官方接口（deepseek-flash）；本地实际模型主链路和显式阈值均通过，Secret不进入源码。开发/测试由Codex执行。
- 同花顺：官方扶摇MCP只读数据已接入；提供问财条件复制和SuperMind官方自选板块脚本生成。目标账户写入未执行。

源码包仅包含Git跟踪源码和公开验证元数据；不含.dev.vars、node_modules、缓存或受限原始数据报告。

## 上一轮发布验证
- 应用源码提交：7002a80dda9423043c72e42e0b5040edcd87b366，已推送GitHub main；线上第3版使用同一应用提交，环境版本2。
- GitHub干净环境CI已通过：https://github.com/lzy75/mingce-stock-lab/actions/runs/39249227255
- 生产独立HTTP验收：PRODUCTION_HTTP_VALIDATION.json保留403且非JSON的访问层失败，不伪称全部通过。
- 托管Worker日志另确认生产GET /与GET /api/status返回200；这只能证明页面与状态接口可达，不能代替模型/金融POST链路验证。
- 页面内“方法与口径 → 接入检查”可在实际浏览器独立验证并导出结果；用户侧生产双接口结果以实际检查为准。

## 本轮导览与15指标发布
新增可操作导览、6类场景、15项指标、三组真实案例验收及GitHub Production acceptance。82项自动测试、类型检查通过；真实本地验收以docs/LIVE_CASE_VALIDATION.json为准。实际独立生产结果如下。

### 独立生产验收已完成
- 2026-10-19 20:39（北京时间），GitHub独立运行器直接访问公开域名；未使用托管绕过令牌、Cookie或额外Key。
- [Production acceptance成功](https://github.com/lzy75/mingce-stock-lab/actions/runs/39253736465)，对应应用源码89b96cc6c4be55337088f89421db4fcd038400bd；[该源码CI成功](https://github.com/lzy75/mingce-stock-lab/actions/runs/39253618211)。
- GET /api/status HTTP200，指标15、AI/数据配置均true；POST /api/acceptance HTTP200，三组模型调用均为deepseek-flash且有独立模型ID，实际金融证据为MCP。
- 验收ID：31e05397-cd26-4821-a1cc-b65540d030a5。生产Worker日志确认相同ID、POST HTTP200与一致三态计数，requestId=7ed22715bda030011617dba46a179be3。
- 实际机器报告：[PRODUCTION_ACCEPTANCE.json](PRODUCTION_ACCEPTANCE.json)。链路通过；现金流场景2项条件数据不适用，整体证据状态partial，未声称全字段通过。
- 旧PRODUCTION_HTTP_VALIDATION.json的403保留为历史记录；本次独立运行器已验证生产可达，不能据此保证所有网络持续可达。当前浏览器自动检查生产页仍发生工具超时，本地同源码交互已实际验证。
- 本次收尾将结果表收紧为价格/涨跌幅与已执行条件相关指标，避免显示未请求字段造成的空列；案例进入工作台时沿用4只固定研究池。

### 最终公开双接口与边界验收
线上第6版应用源码7629752acf688431dcb79a11e8e34659670f87da；后续提交仅更新GitHub验收工作流和记录，不改变线上应用。
[最终生产验收通过](https://github.com/lzy75/mingce-stock-lab/actions/runs/39254655619)：三场景真实链路及10项公开HTTP验收全部通过，包括真实POST /api/parse、POST /api/market、错单位/未知条件、非法JSON、非法研究池、空指标及预期跨站403。
最新三场景验收ID：cdaa4e8c-eade-4f58-b47b-16655cd75279。公开双接口报告：[PRODUCTION_HTTP_GITHUB.json](PRODUCTION_HTTP_GITHUB.json)；三场景报告：[PRODUCTION_FINAL_ACCEPTANCE.json](PRODUCTION_FINAL_ACCEPTANCE.json)。字段不适用继续标记partial。
[最终验证工作流源码CI通过](https://github.com/lzy75/mingce-stock-lab/actions/runs/39254631661)。

## 单版面主线与研究池分批更新
- 单一宽大输入框，条件核对、名单与证据依次在同页下方；手机和平板响应式已复核。
- 股票研究池不设20只总量上限，20只仅是单次传输批量；分批进度、取消、429有界重试、完整覆盖检查均已实现。不是自动全市场筛选。
- 本地真实24只MCP池分两批完整读取；45只构造池和异常回归包含于88项通过的自动测试。
- SuperMind入口与Notebook具体步骤内置于导出面板；脚本补全mindgo_api导入与查询回读，Python语法检查通过，未执行账户写入。
- GitHub生产验收已增加24只研究池批次检查；本次发布后的实际运行结果另外追加，不预先记为通过。
