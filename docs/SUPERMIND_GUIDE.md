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

写入SuperMind板块不等于已确认与手机/PC同花顺自选互通；当前尚未执行用户账户写入验证。

## 后续自动接续的官方通道
官方AI Lab文档现列出Skill，可通过另行授权的MGLLM_API_KEY在远端研究环境上传/执行代码并取回结果。这提供了后续验证自动接续的方向，当前产品尚未安装或接入，也未验证账户写入。它与现有扶摇金融数据Key是不同授权。

## 官方依据
- 官网导航及研究环境说明：https://quant.10jqka.com.cn/
- Jupyter新建Python Notebook说明：https://quant.10jqka.com.cn/view/help/22
- mindgo_api导入与custom_sector查询/新建说明：https://quant.10jqka.com.cn/view/help/4?from=ifind
- 远端研究Skill说明：https://quant.10jqka.com.cn/view/help/24

核对日期：2026-10-19。以上是按官方公开导航整理的操作步骤，尚未操作用户登录后的账户。
