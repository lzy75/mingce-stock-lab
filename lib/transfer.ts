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
  if (new Set(codes).size !== codes.length)
    throw Error("结果包含重复股票代码，请重新核对研究池");
  const spec = JSON.stringify({
    schema: "mingce-strategy-v1",
    conditions,
    snapshotId: run.snapshotId,
    note: "只记录本次筛选条件和快照标识，不保证同花顺重新筛选口径完全相同。",
  });
  return `# 明策 → SuperMind 研究板块接续脚本
# 需在本人已授权的SuperMind环境检查后运行；不代表行情客户端自选同步。
# 仅新建独立板块；同名同内容重复运行不再写入，同名不同内容拒绝覆盖。
# 官方API: https://quant.10jqka.com.cn/view/help/4#custom_sector
import json
import pandas as pd
from mindgo_api import custom_sector

STRATEGY = json.loads(${JSON.stringify(spec)})
SYMBOLS = ${JSON.stringify(codes)}
SECTOR_NAME = ${JSON.stringify(sector.trim())}


def read_sector():
    row = custom_sector(name=SECTOR_NAME)
    if not isinstance(row, pd.Series):
        raise RuntimeError('板块查询返回类型异常，未继续写入。')
    return row


def matches(row):
    if row.empty:
        return False
    if 'name' not in row.index or 'symbol' not in row.index:
        raise RuntimeError('板块查询缺少名称或股票代码，无法核验。')
    actual = row['symbol']
    return (row['name'] == SECTOR_NAME and isinstance(actual, list)
            and len(actual) == len(SYMBOLS) and set(actual) == set(SYMBOLS))


def main():
    print('正在查询SuperMind研究板块…')
    before = read_sector()
    if before.empty:
        created = custom_sector(name=SECTOR_NAME, action='insert', symbol=SYMBOLS)
        if created is not True:
            raise RuntimeError('创建未返回True，未标记成功；请按名称查询后核对。')
        state = 'created'
    elif matches(before):
        state = 'already_present'
    else:
        raise RuntimeError('同名板块已存在且内容不同，未覆盖；请换一个新名称。')
    after = read_sector()
    if not matches(after):
        raise RuntimeError('回读与本次名单不一致，未标记成功；请核对目标板块。')
    print(json.dumps({'event': 'mingce_supermind_transfer', 'state': state,
                      'verified': True, 'sector': SECTOR_NAME, 'symbols': SYMBOLS,
                      'snapshotId': STRATEGY['snapshotId'],
                      'clientSync': 'unverified'}, ensure_ascii=False))
    print('SuperMind研究板块回读一致；行情客户端自选同步未验证。')


if __name__ == '__main__':
    main()
`;
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
