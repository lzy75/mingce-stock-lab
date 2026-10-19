# 交付与部署状态（2026-10-19）

- 网页：https://mingce-stock-lab.justslug1.chatgpt.site
- 托管发布：已成功，public；服务端金融数据Secret已配置，前端/源码未包含密钥。
- 应用验证：75项自动测试通过，TypeScript检查通过；生产构建与密钥扫描通过。
- 浏览器：本地真实MCP读取与交互通过；生产入口独立请求遇到Cloudflare403/error1010，不能把这次请求算作线上数据链路通过。
- GitHub目标：https://github.com/lzy75/mingce-stock-lab 。聊天GitHub连接只读；用户已完成官方GitHub CLI登录，系统钥匙串授权有效，通过CLI上传本项目。最终提交SHA以GitHub main为准。
- 模型：已配置DeepSeek官方接口（deepseek-flash）；本地实际模型主链路和显式阈值均通过，Secret不进入源码。开发/测试由Codex执行。
- 同花顺：官方扶摇MCP只读数据已接入；提供问财条件复制和SuperMind官方自选板块脚本生成。目标账户写入未执行。

源码包仅包含Git跟踪源码和公开验证元数据；不含.dev.vars、node_modules、缓存或受限原始数据报告。
