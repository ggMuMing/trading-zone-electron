import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Autocomplete from '@mui/material/Autocomplete'
import { createOpenRecord, getStockAll } from '../../api/api'
import { useState, useEffect } from 'react'
import { Box, Typography } from '@mui/material'
import type { OpenRecordVO, Stock } from '../../api/apiType'
import { StyledTextField } from '../../components/styled'

function CreateOpenRecordDialog({ isOpen, onClose, accountID }: { isOpen: boolean, onClose: (isSuccess: boolean) => void, accountID: string }) {
  const [calculatedTotalAmount, setCalculatedTotalAmount] = useState<number>(0)
  const [calculatedProfitLossRatio, setCalculatedProfitLossRatio] = useState<number>(0)
  const [calculatedExpectedLoss, setCalculatedExpectedLoss] = useState<number>(0)
  const [calculatedExpectedProfit, setCalculatedExpectedProfit] = useState<number>(0)
  const [stockList, setStockList] = useState<Stock[]>([])
  const [filteredStockList, setFilteredStockList] = useState<Stock[]>([])
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null)
  const [symbolInputValue, setSymbolInputValue] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      getStockAll().then((stocks) => {
        setStockList(stocks)
        // 初始只显示前 50 条，提升初始加载性能
        setFilteredStockList(stocks.slice(0, 50))
      })
    }
  }, [isOpen])

  const handleCloseDialog = (isCreateSuccess: boolean) => {
    setSelectedStock(null)
    setSymbolInputValue('')
    setFilteredStockList([])
    setCalculatedTotalAmount(0)
    setCalculatedProfitLossRatio(0)
    setCalculatedExpectedLoss(0)
    setCalculatedExpectedProfit(0)
    onClose(isCreateSuccess)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const form = e.currentTarget.form
    if (!form) return

    const formData = new FormData(form)
    const buyPrice = parseFloat(formData.get('buyPrice') as string) || 0
    const stopLoss = parseFloat(formData.get('stopLoss') as string) || 0
    const takeProfit = parseFloat(formData.get('takeProfit') as string) || 0
    const plannedQuantity = parseFloat(formData.get('plannedQuantity') as string) || 0

    // 计算总金额
    const totalAmount = buyPrice * plannedQuantity
    setCalculatedTotalAmount(totalAmount)

    // 计算预计亏损 = (买入价 - 止损价) * 计划买入数量
    const expectedLoss = (buyPrice - stopLoss) * plannedQuantity
    setCalculatedExpectedLoss(expectedLoss)

    // 计算预计收益 = (止盈价 - 买入价) * 计划买入数量
    const expectedProfit = (takeProfit - buyPrice) * plannedQuantity
    setCalculatedExpectedProfit(expectedProfit)

    // 计算盈亏比：(止盈价 - 买入价) / (买入价 - 止损价)
    if (buyPrice > stopLoss && buyPrice > 0 && takeProfit > buyPrice) {
      const profit = takeProfit - buyPrice
      const loss = buyPrice - stopLoss
      const ratio = loss > 0 ? profit / loss : 0
      setCalculatedProfitLossRatio(ratio)
    } else {
      setCalculatedProfitLossRatio(0)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget as HTMLFormElement)
    // 如果选择了股票，使用格式化的名称代码；否则使用输入的值
    const symbol_name = selectedStock
      ? `${selectedStock.name}${selectedStock.symbol}`
      : symbolInputValue
    const entry_time = formData.get('entryTime') as string
    const entry_reason = formData.get('entryReason') as string
    const buy_price = parseFloat(formData.get('buyPrice') as string)
    const stop_loss_price = parseFloat(formData.get('stopLoss') as string)
    const take_profit_price = parseFloat(formData.get('takeProfit') as string)
    const plan_quantity = parseFloat(formData.get('plannedQuantity') as string)
    const total_amount = buy_price * plan_quantity

    // 计算盈亏比：(止盈价 - 买入价) / (买入价 - 止损价)
    const profit = take_profit_price - buy_price
    const loss = buy_price - stop_loss_price
    const profit_loss_ratio = loss > 0 ? parseFloat((profit / loss).toFixed(1)) : 0

    // 目标价使用止盈价
    const target_price = take_profit_price

    const record: OpenRecordVO = {
      account_id: accountID,
      symbol_name,
      entry_time,
      entry_reason,
      buy_price,
      target_price,
      stop_loss_price,
      take_profit_price,
      profit_loss_ratio,
      plan_quantity,
      total_amount,
    }

    console.log(record)

    createOpenRecord(record)
      .then((res) => {
        console.log(res)
        handleCloseDialog(true)
      })
      .catch((err) => {
        console.error(err)
        handleCloseDialog(false)
      })
  }

  return (
    <Dialog
      open={isOpen}
      onClose={() => handleCloseDialog(false)}
      maxWidth={false}
      sx={{
        '& .MuiDialog-paper': {
          background: '#202020',
          color: '#9b9b9b',
          width: '1332px',
          maxWidth: '90vw',
        }
      }}
    >
      <DialogTitle
        sx={{
          color: '#f0efed',
          fontSize: '20px',
          fontWeight: 600,
          padding: '24px 24px 16px 24px',
          borderBottom: '1px solid var(--c-borSec)',
        }}
      >
        创建开单记录
      </DialogTitle>
      <DialogContent sx={{ padding: '24px' }}>
        <DialogContentText
          sx={{
            color: 'var(--c-texSec)',
            marginBottom: '24px',
            fontSize: '14px',
          }}
        >
          请输入开单记录的基本信息和交易计划
        </DialogContentText>
        <form onSubmit={handleSubmit} id="create-open-record-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 基本信息 */}
          <Box>
            <Typography
              sx={{
                color: '#f0efed',
                fontSize: '16px',
                fontWeight: 600,
                marginBottom: '16px',
              }}
            >
              基本信息
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Box sx={{ display: 'flex', gap: '20px' }}>
                <Autocomplete
                  freeSolo
                  options={filteredStockList}
                  getOptionLabel={(option) => {
                    if (typeof option === 'string') return option
                    return `${option.name}${option.symbol}`
                  }}
                  value={selectedStock}
                  onChange={(_event, newValue) => {
                    if (newValue && typeof newValue !== 'string') {
                      setSelectedStock(newValue)
                      setSymbolInputValue(`${newValue.name}${newValue.symbol}`)
                    } else {
                      setSelectedStock(null)
                      if (typeof newValue === 'string') {
                        setSymbolInputValue(newValue)
                      }
                    }
                  }}
                  onInputChange={(_event, newInputValue) => {
                    setSymbolInputValue(newInputValue)
                    if (!newInputValue) {
                      setSelectedStock(null)
                      // 输入为空时，显示前 50 条
                      setFilteredStockList(stockList.slice(0, 50))
                      return
                    }

                    // 根据输入动态过滤，只显示匹配的前 100 条，提升性能
                    const searchValue = newInputValue.toLowerCase()
                    const filtered = stockList.filter((stock) => {
                      return (
                        stock.name.toLowerCase().includes(searchValue) ||
                        stock.symbol.toLowerCase().includes(searchValue) ||
                        `${stock.name}${stock.symbol}`.toLowerCase().includes(searchValue)
                      )
                    }).slice(0, 100) // 限制最多显示 100 条

                    setFilteredStockList(filtered)

                    // 如果输入值匹配某个股票，自动选择
                    const matchedStock = stockList.find(
                      stock => `${stock.name}${stock.symbol}` === newInputValue ||
                        stock.name === newInputValue ||
                        stock.symbol === newInputValue
                    )
                    if (matchedStock) {
                      setSelectedStock(matchedStock)
                    } else {
                      // 尝试解析"名称代码"格式的输入
                      const parsedStock = stockList.find(stock => {
                        const fullFormat = `${stock.name}${stock.symbol}`
                        return fullFormat === newInputValue
                      })
                      if (parsedStock) {
                        setSelectedStock(parsedStock)
                      } else {
                        setSelectedStock(null)
                      }
                    }
                  }}
                  filterOptions={(options) => {
                    // 由于已经在 onInputChange 中过滤，这里直接返回
                    // 这样可以避免重复过滤，提升性能
                    return options
                  }}
                  inputValue={symbolInputValue}
                  renderInput={(params) => (
                    <StyledTextField
                      {...params}
                      label="标的名称/代码"
                      required
                      sx={{ flex: '0 0 calc((100% - 20px) / 2)' }}
                    />
                  )}
                  sx={{ flex: '0 0 calc((100% - 20px) / 2)' }}
                  slotProps={{
                    paper: {
                      sx: {
                        backgroundColor: 'var(--c-bacPri)',
                        color: 'var(--c-texPri)',
                        borderColor: 'var(--c-borPri)',
                        borderRadius: '8px',
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': {
                            borderColor: 'var(--c-borPri)',
                          },
                        },
                        '& .MuiAutocomplete-option:hover': {
                          backgroundColor: 'rgba(255,255,243,.082)',
                        },
                      },
                    },
                  }}
                />
                <StyledTextField
                  label="进场时间"
                  name="entryTime"
                  type="datetime-local"
                  required
                  sx={{ flex: '0 0 calc((100% - 20px) / 2)' }}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Box>
              <StyledTextField
                label="明确进场理由"
                name="entryReason"
                required
                fullWidth
                multiline
                rows={3}
              />
            </Box>
          </Box>

          {/* 交易计划 */}
          <Box>
            <Typography
              sx={{
                color: '#f0efed',
                fontSize: '16px',
                fontWeight: 600,
                marginBottom: '16px',
              }}
            >
              交易计划
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Box sx={{ display: 'flex', gap: '20px' }}>
                <StyledTextField
                  label="买入价"
                  name="buyPrice"
                  type="number"
                  required
                  sx={{ flex: '0 0 calc((100% - 60px) / 4)' }}
                  inputProps={{ step: '0.01' }}
                  onChange={handleInputChange}
                />
                <StyledTextField
                  label="止损价"
                  name="stopLoss"
                  type="number"
                  required
                  sx={{
                    flex: '0 0 calc((100% - 60px) / 4)',
                    '& .MuiOutlinedInput-root': {
                      '& input': {
                        color: 'var(--cd-palGre500)', // 绿色
                      },
                    },
                  }}
                  inputProps={{ step: '0.01' }}
                  onChange={handleInputChange}
                />
                <StyledTextField
                  label="止盈价"
                  name="takeProfit"
                  type="number"
                  required
                  sx={{
                    flex: '0 0 calc((100% - 60px) / 4)',
                    '& .MuiOutlinedInput-root': {
                      '& input': {
                        color: 'var(--cd-palRed700)', // 红色
                      },
                    },
                  }}
                  inputProps={{ step: '0.01' }}
                  onChange={handleInputChange}
                />
                <StyledTextField
                  label="盈亏比"
                  name="profitLossRatio"
                  type="number"
                  sx={{
                    flex: '0 0 calc((100% - 60px) / 4)',
                    '& .MuiOutlinedInput-root': {
                      '& input': {
                        cursor: 'not-allowed',
                      },
                    },
                  }}
                  inputProps={{ step: '0.01', readOnly: true }}
                  value={calculatedProfitLossRatio.toFixed(2)}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: '20px' }}>
                <StyledTextField
                  label="计划买入数量"
                  name="plannedQuantity"
                  type="number"
                  required
                  sx={{ flex: '0 0 calc((100% - 60px) / 4)' }}
                  inputProps={{ step: '1' }}
                  onChange={handleInputChange}
                />
                <StyledTextField
                  label="预计亏损"
                  name="expectedLoss"
                  type="number"
                  sx={{
                    flex: '0 0 calc((100% - 60px) / 4)',
                    '& .MuiOutlinedInput-root': {
                      '& input': {
                        cursor: 'not-allowed',
                        color: 'var(--cd-palGre500)', // 绿色
                      },
                    },
                  }}
                  inputProps={{ step: '0.01', readOnly: true }}
                  value={calculatedExpectedLoss.toFixed(2)}
                />
                <StyledTextField
                  label="预计收益"
                  name="expectedProfit"
                  type="number"
                  sx={{
                    flex: '0 0 calc((100% - 60px) / 4)',
                    '& .MuiOutlinedInput-root': {
                      '& input': {
                        cursor: 'not-allowed',
                        color: 'var(--cd-palRed700)', // 红色
                      },
                    },
                  }}
                  inputProps={{ step: '0.01', readOnly: true }}
                  value={calculatedExpectedProfit.toFixed(2)}
                />
                <StyledTextField
                  label="总金额"
                  name="totalAmount"
                  type="number"
                  sx={{
                    flex: '0 0 calc((100% - 60px) / 4)',
                    '& .MuiOutlinedInput-root': {
                      '& input': {
                        cursor: 'not-allowed',
                      },
                    },
                  }}
                  inputProps={{ step: '0.01', readOnly: true }}
                  value={calculatedTotalAmount.toFixed(2)}
                />
              </Box>
            </Box>
          </Box>
        </form>
      </DialogContent>
      <DialogActions sx={{ padding: '16px 24px 24px 24px', gap: '12px', borderTop: '1px solid var(--c-borSec)' }}>
        <Button
          onClick={() => handleCloseDialog(false)}
          sx={{
            color: 'var(--c-texSec)',
            backgroundColor: 'transparent',
            border: '1px solid var(--c-borPri)',
            borderRadius: '8px',
            padding: '8px 20px',
            textTransform: 'none',
            fontSize: '14px',
            fontWeight: 500,
            '&:hover': {
              backgroundColor: 'rgba(255,255,243,.082)',
              borderColor: 'var(--c-borStr)',
              color: 'var(--c-texPri)',
            },
          }}
        >
          取消
        </Button>
        <Button
          type="submit"
          form="create-open-record-form"
          sx={{
            color: 'var(--c-texSec)',
            backgroundColor: 'transparent',
            border: '1px solid var(--c-borPri)',
            borderRadius: '8px',
            padding: '8px 20px',
            textTransform: 'none',
            fontSize: '14px',
            fontWeight: 500,
            '&:hover': {
              backgroundColor: 'rgba(255,255,243,.082)',
              borderColor: 'var(--c-borStr)',
              color: 'var(--c-texPri)',
            },
          }}
        >
          创建
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CreateOpenRecordDialog
