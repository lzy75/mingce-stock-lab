# 同花顺研究工具接续指南

明策提供i问财条件表达复制与SuperMind研究板块脚本导出。已在官方SuperMind环境完成板块新建、回读一致、重复执行与同名冲突检查。

## 从筛选结果创建研究板块

1. 完成真实数据筛选，核对当前条件与名单。
2. 在“导出到同花顺 → 候选名单 → SuperMind”填写独立板块名称并生成脚本。
3. 打开[SuperMind研究环境](https://quant.10jqka.com.cn/view/study-research.html)，登录后新建Python Notebook。
4. 将脚本粘贴到代码单元，检查板块名称和股票代码，运行整个单元。
5. 查看`verified`回读验证结果；相同名称与名单再次运行时返回`already_present`。

脚本调用官方`custom_sector`，创建后严格比较名称与代码集合；同名不同内容在写入前拒绝覆盖。导出前会校验真实快照、当前条件、名单与名称。

## 官方Skill验证

通过官方`supermind-quant-developer` Skill的`run.py`完成只读查询、新建、回读、重复执行及冲突拒绝验证。使用系统可信CA完成TLS验证，所有者授权存放于本机配置中。验收来源见[FINAL_ACCEPTANCE.json](FINAL_ACCEPTANCE.json)。

## 官方入口

- [研究环境](https://quant.10jqka.com.cn/view/study-research.html)
- [API与custom_sector](https://quant.10jqka.com.cn/view/help/4?from=ifind)
- [AI Lab与Skill](https://quant.10jqka.com.cn/view/help/24)
- [账户中心](https://quant.10jqka.com.cn/view/account-center)
