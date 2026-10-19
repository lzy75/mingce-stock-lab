import {
  METRICS,
  validateConditions,
  type Condition,
  type Run,
} from "./domain.ts";
export function strategySentence(conditions: Condition[]) {
  const errors = validateConditions(conditions);
  if (errors.length) throw Error(errors.join("；"));
  const ops = {
    ">": "大于",
    ">=": "不低于",
    "<": "小于",
    "<=": "不超过",
    "=": "等于",
  };
  return conditions
    .filter((c) => c.enabled)
    .map(
      (c) =>
        `${METRICS[c.metric].label}${ops[c.op]}${c.value}${METRICS[c.metric].unit}`,
    )
    .join("，");
}
export function supermindScript(
  conditions: Condition[],
  run: Run,
  sector: string,
) {
  if (JSON.stringify(conditions) !== JSON.stringify(run.conditions))
    throw Error("条件已修改，请重新执行后再同步");
  if (run.mode !== "live") throw Error("构造样本不能同步为真实自选股");
  const errors = validateConditions(conditions);
  if (errors.length) throw Error(errors.join("；"));
  if (!sector.trim() || sector.length > 40 || /[\n\r]/.test(sector))
    throw Error("板块名称需为1—40字且不含换行");
  const codes = run.pass.map((s) => s.code);
  if (!codes.length) throw Error("没有入选股票，不能创建空的自选同步脚本");
  if (codes.some((c) => !/^\d{6}\.(SH|SZ|BJ)$/.test(c)))
    throw Error("结果包含非标准真实股票代码");
  const spec = JSON.stringify({
    schema: "mingce-strategy-v1",
    conditions,
    snapshotId: run.snapshotId,
    note: "只记录本次筛选条件和快照标识，不保证同花顺重新筛选口径完全相同。",
  });
  return `# 明策 → 同花顺 SuperMind 自选板块接续脚本\n# 需用户在已登录、有权限的SuperMind研究环境中检查后运行。\n# 仅新建自选板块；不调用下单、交易或覆盖已有板块接口。\n# 官方API: https://quant.10jqka.com.cn/view/help/4#custom_sector\nimport json\nSTRATEGY = json.loads(${JSON.stringify(spec)})\nSYMBOLS = ${JSON.stringify(codes)}\nSECTOR_NAME = ${JSON.stringify(sector.trim())}\n\n# 若名称已存在，创建应失败；请换新名称，不自动覆盖。\ncustom_sector(name=SECTOR_NAME, action='insert', symbol=SYMBOLS)\nprint('请在SuperMind自选板块中核验名称和股票列表。')\n`;
}
export function transferManifest(conditions: Condition[], run: Run | null) {
  const current =
    !!run && JSON.stringify(conditions) === JSON.stringify(run.conditions);
  return {
    schema: "mingce-transfer-v1",
    destination: "同花顺",
    strategy: strategySentence(conditions),
    conditions,
    snapshotId: current ? run!.snapshotId : null,
    mode: run?.mode ?? null,
    codes: current && run?.mode === "live" ? run.pass.map((s) => s.code) : [],
    capabilities: {
      fuyaoMcp: "只读金融数据，不能写入用户自选账户",
      supermind: "生成官方custom_sector接续脚本，需用户在目标环境运行",
      accountSync: "未授权 / 未执行",
    },
    boundaries: [
      "不包含密钥或持仓",
      "选股语句跨平台的财务周期和波动率口径需要逐条核对",
      "导出不等于目标账户同步成功",
    ],
  };
}
