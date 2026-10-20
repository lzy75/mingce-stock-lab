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

2026-10-20用户已在本人Notebook完成独立测试板块的创建和回读：insert返回True；回读是Series，name与symbol均匹配两只固定接口样本。此前空DataFrame仅是查询未列出板块，不代表写入失败。该记录来自用户回传，非Codex独立执行；脱敏证据见[人工验收记录](SUPERMIND_MANUAL_ACCEPTANCE.json)。手机/PC客户端互通、重复执行和网页实际候选名单脚本尚未验证。

## 后续自动接续的官方通道
官方AI Lab文档现列出Skill，可通过另行授权的MGLLM_API_KEY在远端研究环境上传/执行代码并取回结果；supermind-cli另支持自选板块管理，文档称添加后同花顺行情客户端可见。当前网页尚未安装或接入这条远端授权通道；人工创建成功不能代替网页一键同步验收。该授权与现有扶摇金融数据Key不同。

需要所有者配合：进入SuperMind账户中心的“密钥 → 新建密钥”，将Key填入本机被Git忽略的.env.supermind.local的MGLLM_API_KEY；再在账户中心“Skill”下载官方安装包。Key不放入公开源码或前端，完成配置后再验证远端只读查询，随后执行独立测试板块的写入与回读。

## 官方依据
- 官网导航及研究环境说明：https://quant.10jqka.com.cn/
- Jupyter新建Python Notebook说明：https://quant.10jqka.com.cn/view/help/22
- mindgo_api导入与custom_sector查询/新建说明：https://quant.10jqka.com.cn/view/help/4?from=ifind
- 远端研究Skill说明：https://quant.10jqka.com.cn/view/help/24

核对日期：2026-10-20。以上是按官方公开导航及用户人工测试整理的记录；助手未直接操作用户登录后的账户。
