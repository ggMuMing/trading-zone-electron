import { readExampleMaSource, readExampleStrategySource } from '../bridge/pythonBridge'
import type { ScriptAgentKind } from '../../shared/types/scriptAgent'

const INDICATOR_RULES = [
  '指标脚本是 Python，运行在受限沙箱里。',
  '必须定义 Indicator 的子类，并在文件末尾写 indicator = 该类。Indicator、Ohlcv、input、plot、yrange、sma、ema 已预置，不要 import 它们。',
  '类属性 key、title 是非空字符串，overlay 是布尔值。overlay = True 画在主图价格上，overlay = False 画在副图。',
  '在 inputs() 里声明参数：input.int(默认整数, "标题", min=, max=)、input.float(默认数字, "标题", min=, max=)、input.bool(True或False, "标题")。默认值必须落在 min 和 max 之间。整数默认值必须是 int，不能是 True/False。',
  'compute(self, ohlcv) 里用 ohlcv.open、high、low、close、volume、time。这些序列等长。plot 的序列也必须等长，预热不足的位置填 None。',
  'plot(series, "标题", color="#2962FF", linewidth=1)。linewidth 只能是 1 到 4。柱状图用 style="histogram"，并用 color_up、color_down。',
  'yrange(下界, 上界) 只能在副图调用一次，主图调用会失败。下界必须小于上界。',
  '可以 import 的只有 numpy、typing、collections、math。不能 import pandas，不能使用 open、exec、eval、compile，不能读文件或访问网络。',
  'sma(序列, 周期) 和 ema(序列, 周期) 返回等长列表，前面不足周期的位置是 None。'
].join('\n')

const STRATEGY_RULES = [
  '策略脚本是 Python，运行在受限沙箱里。',
  '必须定义 StrategyScript 的子类，并在文件末尾写 strategy = 该类。StrategyScript、param、pd 已预置。',
  '在 declare() 里声明参数：param.int(默认整数, "标题", min=, max=)、param.float(默认数字, "标题", min=, max=)、param.enum("默认值", "标题", [("值", "标签"), ...])。默认值必须落在范围内，enum 的默认值必须是选项之一。',
  'compute(self, daily) 收到按交易日索引的 DataFrame，列至少有 open、high、low、close、vol。',
  '返回一份等长且索引相同的 DataFrame，必须包含布尔列 buy_signal 和 sell_signal。推荐 out = daily.copy() 后写入信号再 return out。',
  '可以 import 的只有 pandas、numpy、math、typing、collections。不能使用 open、exec、eval、compile，不能读文件或访问网络。',
  '不要调用 plot、input 或 yrange。'
].join('\n')

export function buildDialectPrompt(kind: ScriptAgentKind): string {
  const indicatorExample = readExampleMaSource().trim()
  const strategyExample = readExampleStrategySource().trim()
  const current = kind === 'indicator' ? '指标' : '策略'
  return [
    '你是交易应用里的脚本助手，只根据用户需求生成当前种类的完整 Python 源码。',
    `当前种类是${current}。不要改成另一种脚本。`,
    '只输出一个 JSON 对象，不要使用 Markdown 代码块，不要输出 JSON 以外的文字。',
    'JSON 字段：assistant 是给用户的简短中文说明，title 是脚本标题，source 是完整可执行源码。',
    'source 必须包含全部代码和末尾的导出语句。说明不要放进 source。',
    '如果用户要求解读一段文本，assistant 用中文说明这段文本描述的规则，source 仍是完整可执行脚本。',
    '',
    '指标规则：',
    INDICATOR_RULES,
    '',
    '指标示例：',
    indicatorExample,
    '',
    '策略规则：',
    STRATEGY_RULES,
    '',
    '策略示例：',
    strategyExample
  ].join('\n')
}
