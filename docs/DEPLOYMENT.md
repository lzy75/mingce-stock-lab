# 部署与运行指南

- 公开网页：https://mingce-stock-lab.justslug1.chatgpt.site/
- GitHub：https://github.com/lzy75/mingce-stock-lab
- 应用：Sites第9版，2026-10-20 11:17（北京时间）发布成功。
- 应用源码：`1a2b4459d384987a3c292116cc1746b5eaed06fd`；后续提交整理交付文档和测试输出目录。
- 技术栈：React/Vinext与Cloudflare Workers；包含`.openai/hosting.json`及构建适配。

## 本地启动

```bash
npm ci
cp .env.example .dev.vars
# 填写服务端环境变量后启动
npm run dev
```

服务端变量包括`FUYAO_API_KEY`、`FUYAO_TRANSPORT`、`AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`，含义见README。配置仅放本机忽略文件或托管服务端Secret。公开网页已配置模型和扶摇服务端授权。

## 构建与发布

1. 运行自动测试、类型检查与密钥扫描。
2. 使用`npm run build`构建；`npm start`进行本地Worker预览。
3. 托管端配置模型与数据服务Secret，发布构建产物。
4. 打开公开域名，运行真实案例，查看模型调用ID、MCP追踪及字段证据。

GitHub Actions CI执行自动测试、类型、构建与密钥扫描；Production acceptance用于从独立网络检查公开域名、真实模型/数据案例和HTTP边界。探测结果保留各次运行状态，验收来源见[FINAL_ACCEPTANCE.json](FINAL_ACCEPTANCE.json)。

页面分别展示获取时间与证据时间；自动刷新、缓存和数据质量规则见README。中间报告默认写入忽略的`artifacts/`目录。
