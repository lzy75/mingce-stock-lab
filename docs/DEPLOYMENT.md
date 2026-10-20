# 部署与运行边界

- 公开网页：https://mingce-stock-lab.justslug1.chatgpt.site/
- GitHub：https://github.com/lzy75/mingce-stock-lab
- 当前应用：Sites第9版，2026-10-20 11:17（北京时间）发布成功，公开访问。
- 运行应用源码：`1a2b4459d384987a3c292116cc1746b5eaed06fd`。后续仓库提交整理说明、测试输出目录和最终验收，不改变已部署应用。
- 运行环境：React/Vinext，Cloudflare Workers；保留`.openai/hosting.json`与构建适配。
- 授权：模型及扶摇Key保存在托管服务端Secret；本机配置被Git忽略。SuperMind Key只用于所有者本机官方Skill测试，未部署至公开网页。

## 当前可用性结论

用户已在公开网页完成真实PE区间筛选并提供结果截图，真实快照与证据时间可见。独立GitHub运行器仍出现扶摇超时/522，本机直连成功，具体路径差异未确定。应区分“本次用户入口已通过”与“所有网络持续可用”，不将历史通过代替新的失败。

上游失败不生成新正常名单，旧结果保留其原始快照时点；不同快照的变化不归因于单一条件。新鲜度规则、缓存与数据范围见README。

## 可重复验证

- `npm test`、`npm run typecheck`、`npm run build`、`npm run security:check`。
- GitHub Actions的Production acceptance针对公开域名检查真实模型、数据、边界与24只分批，不需要把额外Key放到Actions。
- 页面“运行真实案例”或“方法与口径”可返回模型调用ID、MCP追踪与三态结果；字段不适用保留待核状态。

最终结果与验收来源统一见[FINAL_ACCEPTANCE.json](FINAL_ACCEPTANCE.json)。中间文件默认生成到忽略的`artifacts/`；旧探测与设计复核已归档本机`work/`，不再放在仓库当前展示目录。

Git传输端点遇网络故障时，本次通过已授权官方GitHub API补齐完全相同的文件树与提交对象；核对SHA后非强制更新main，没有改写提交历史。
