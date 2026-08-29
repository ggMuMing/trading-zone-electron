> 完整迭代说明见：[Sprint5迭代文档.md](./Sprint5迭代文档.md)。全量股票列表已移至 [Sprint5.1](./Sprint5.1迭代文档.md)。

# `pro.daily`接口的输出参数
|名称	|类型|	默认显示	|描述|
|-|-|-|-|
|ts_code	|str|Y|	股票代码
|trade_date	|str|	Y|	交易日期
|open	|float|	Y|	开盘价
|high	|float|	Y|	最高价
|low	|float|	Y|	最低价
|close	|float|	Y|	收盘价
|pre_close	|float|	Y|	昨收价【除权价】
|change	|float|Y|	涨跌额
|pct_chg	|float|	Y|	涨跌幅（%） 【基于除权后的昨收计算的涨跌幅：（今收-除权昨收）/除权昨收 】
|vol	|float|	Y|	成交量 （手）
|amount	|float|	Y|	成交额 （千元）
|ah_vol	|float|	N|	盘后成交量 （手）
|ah_amount	|float|	N|	盘后成交额 （千元）

# 本期需求
## 数据对齐
- 前端、main、python层、数据库各级的日线行情数据的参数、参数名、参数类型都和上述接口的输出参数保持一致。
- 缺少的需要补全，不同的需要对齐
- 后续lightweight-charts的参数与pro.daily的输出参数不一致时，单独做映射处理，当前不考虑。

## 行情页面
- 当前只显示10支股票。新的迭代要求全量显示。
- 列表改动
  - 补全字段
  - 前端增加可选列表显示字段功能。
    - 日期、开盘、收盘、最高价、最低价、成交量、成交额为必选。其他参数可以选择是否显示
  - 增加按单列排序功能
  - 分页功能支持上述的排序功能
