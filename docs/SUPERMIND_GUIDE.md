# SuperMind接续（可选扩展）

本功能不是原题必交项。明策可复制i问财条件表达，或生成SuperMind研究板块脚本；当前不提供公开网页一键写入账户。

## 使用网页导出的脚本

1. 完成真实数据筛选，在“导出到同花顺 → 候选名单 → SuperMind”填写独立板块名并生成脚本。
2. 打开[研究环境](https://quant.10jqka.com.cn/view/study-research.html)，登录后新建Python Notebook，检查并运行脚本。
3. 脚本使用官方`custom_sector`：新建后回读核对名称和代码；同名同名单不重复写入，同名不同内容拒绝覆盖。只有回读一致才输出`verified`。

构造样本、已修改但未重新执行的条件、空名单或非法名称不能导出为真实研究板块。脚本没有下单或交易指令。

## 已验证与未实现

官方supermind-quant-developer Skill已由所有者安装并配置本机MGLLM_API_KEY。通过官方run.py实际验证只读查询、新建、回读、重复执行和冲突拒绝，见[最终验收](FINAL_ACCEPTANCE.json)。Key未放入浏览器或公开仓库。

用户确认同一手机号登录行情客户端仍没有测试分组，跨端显示未通过，原因未确定。官方文档另有supermind-cli，但当前账户只提供quant-developer，不能假称已接入。

网站运行在Cloudflare Workers，不能直接启动本机Python/CLI。网页一键写入仍需正式Web接口或受保护执行服务；任何后续接入必须限制本人访问，不能将所有者账户开放给匿名访客。

## 官方依据

- [API与custom_sector](https://quant.10jqka.com.cn/view/help/4?from=ifind)
- [AI Lab与Skill](https://quant.10jqka.com.cn/view/help/24)
- [账户中心](https://quant.10jqka.com.cn/view/account-center)
