# 打开 SuperMind 研究环境

这里的环境是SuperMind网站内可运行Python的Jupyter Notebook页面，用来查询及导入自选板块。

1. 打开官方入口：https://quant.10jqka.com.cn/view/study-research.html 。也可从 https://quant.10jqka.com.cn/ 的“我的研究 → 研究环境”进入。
2. 点击右上角“登录”，按平台流程登录同花顺账号。
3. 若出现环境选择，选择可用的Python 3环境并启动；最终应看到文件列表和Notebook界面。
4. 点击“新建 / New → Python 3”，在代码单元格粘贴下面的只读查询，按Shift+Enter运行。

```python
from mindgo_api import custom_sector
custom_sector()
```

能返回板块表格（也可能为空）说明当前环境可查询该账户的自选板块。若模块、权限或环境不可用，应先根据平台提示处理；截图可用于定位具体页面，但本仓库不记录账号或密钥。

5. 在明策完成真实数据筛选，点击“导出到同花顺 → 候选名单 → SuperMind”，填写新板块名并下载Python脚本。
6. 在Notebook中粘贴脚本代码并检查后运行。脚本包含官方API导入、新建板块和查询回读。核对返回的板块名及代码是否与明策入选名单一致。

2026-10-20用户已在本人Notebook完成独立测试板块的创建和回读：insert返回True；回读是Series，name与symbol均匹配两只固定接口样本。此前空DataFrame仅是查询未列出板块，不代表写入失败。最初记录来自用户回传，见[人工验收记录](SUPERMIND_MANUAL_ACCEPTANCE.json)。

随后Codex通过官方Skill远端执行，独立读取到原测试板块，并用产品生成器的脚本完成新板块创建、回读一致、重复执行不重复写入、同名不同名单拒绝覆盖及原名单未改变。查询不存在板块实际返回空Series，故脚本使用Series语义判断。见[远端验收](SUPERMIND_REMOTE_ACCEPTANCE.json)。脚本仅在回读匹配后输出verified；创建返回False、空回读或错误类型均不能标记成功。

用户已确认同一手机号登录客户端仍未找到测试分组，跨端显示当前未通过；不是“已同步但用户未找到”的已知结论。具体差异待官方确认，见[排查问题单](SUPERMIND_SYNC_DIAGNOSTIC.md)。

## 后续自动接续的官方通道
官方AI Lab文档列出Skill，可通过MGLLM_API_KEY在远端研究环境执行代码；用户提供的supermind-quant-developer已安装并验证。supermind-cli另支持自选板块管理，文档称添加后同花顺行情客户端可见，但用户账户工具包目前只有quant-developer。两者不能当作同一个已安装工具。

本机.env.supermind.local已配置并被Git忽略，Key未部署至公开网页。官方run.py初次遇到CERTIFICATE_VERIFY_FAILED，进程指定系统可信CA `/etc/ssl/cert.pem` 后doctor和执行均通过；不关闭证书验证。远端沙箱拒绝getattr，改为普通Series字段访问后通过；CLI退出码0仍可能包含error，必须检查执行结果与业务事件。

公开网站运行于Cloudflare Workers，不能直接启动本机Python/CLI；公开网页一键触发尚未实现。后续需要官方正式Web接口或受保护的执行服务，并在服务端限制本人访问，不能把本机Key放进浏览器，也不能把拥有者账户开放给匿名访问者。

## 官方依据
- 官网导航及研究环境说明：https://quant.10jqka.com.cn/
- Jupyter新建Python Notebook说明：https://quant.10jqka.com.cn/view/help/22
- mindgo_api导入与custom_sector查询/新建说明：https://quant.10jqka.com.cn/view/help/4?from=ifind
- 远端研究Skill说明：https://quant.10jqka.com.cn/view/help/24

核对日期：2026-10-20。远端执行使用用户已授权的官方Skill，未操作客户端自选，也未执行交易。
