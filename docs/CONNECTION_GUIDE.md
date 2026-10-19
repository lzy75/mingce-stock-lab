# 仓库授权与接口测试

## GitHub
ChatGPT GitHub连接是只读，不应反复重连来期待获得推送能力。官方说明：https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt
本项目通过官方GitHub CLI网页登录，凭据使用系统钥匙串。已确认登录lzy75，具备repo和workflow授权；不把Token复制到对话、Git远程URL或仓库。

以后在本机执行：
```bash
gh auth status --hostname github.com
gh auth login --hostname github.com --git-protocol https --web
```
仅在尚未登录时执行第二条。原有连接若只是缺少仓库读取权限，可在GitHub Settings → Applications → Installed GitHub Apps选择对应应用并勾选本仓库；这与CLI推送授权是两条链路。
官方CLI文档：https://cli.github.com/manual/gh_auth_login

## DS配置
本地文件.env.ai.local不是网址。通过Codex文件编辑器填写AI_API_KEY、AI_BASE_URL=https://api.deepseek.com、AI_MODEL=deepseek-flash，再将这三项合并到忽略的.dev.vars并重启本地服务；线上由项目所有者设置服务端Secret并重新发布。不要使用NEXT_PUBLIC_或VITE_前缀。
模型名称已按2026-10-19官方文档核对：https://api-docs.deepseek.com/

## 网页检查
“方法与口径 → 接入检查”分别点击“验证金融数据”和“验证AI解析”。
- 金融数据：请求2只固定研究池，检查HTTP结果、字段质量、实际MCP工具与request_id。
- AI：只有engine=model且未blocked才显示通过；rules不算模型接通。
- 导出记录只含调用元数据，不含Key、持仓和原始行情数字。

## 可重复命令
```bash
npm test
npm run typecheck
npm run test:report
node scripts/check-web.mjs
MINGCE_TEST_URL=https://mingce-stock-lab.justslug1.chatgpt.site MINGCE_TEST_REPORT=docs/PRODUCTION_HTTP_VALIDATION.json node scripts/check-web.mjs
```
本地需要先npm run dev。HTTP脚本覆盖配置、真实模型、显式条件不增减、错单位、附加未知要求、非法JSON、非法代码、空指标、跨站请求与真实MCP快照。
入口非JSON/403、网络失败、超时与应用业务错误分开记录。部署成功、Key存在、HTTP200都不能单独代表整个链路通过。生产入口被环境访问层限制时保留失败记录，改用实际页面检查；不要把本地结果写成生产结果。
