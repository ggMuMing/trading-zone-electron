import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  FormControl,
  InputLabel
} from "@mui/material";
import styled from "@emotion/styled";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useSnapshot } from "valtio";
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CreateOpenRecordDialog from "./CreateOpenRecordDialog";
import { getOpenRecordList, deleteOpenRecord, getRecordSymbolList } from "../../api/api";
import type { OpenRecord, Stock } from "../../api/apiType";
import navState from "../Nav/NavState";

const StyledTableHeadCell = styled(TableCell)({
  color: 'var(--c-texSec)',
  fontWeight: 600,
  borderColor: 'var(--c-borPri)',
  backgroundColor: 'var(--c-bacPri)',
});

function OpenRecordView() {
  const navStateSnapshot = useSnapshot(navState);
  const { accountIndex: accountName } = useParams<{ accountIndex: string }>();
  const accountId = navStateSnapshot.accountNameIdMap[accountName || ''];
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [records, setRecords] = useState<OpenRecord[]>([]);
  const [symbolList, setSymbolList] = useState<Stock[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<Stock | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRecord, setSelectedRecord] = useState<OpenRecord | null>(null);
  const [isReasonDialogOpen, setIsReasonDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  const loadRecords = useCallback(async (currentPage: number, currentRowsPerPage: number, symbolName: string = '') => {
    if (!accountId) return;
    const data = await Promise.all([
      getOpenRecordList(accountId, currentPage + 1, currentRowsPerPage, symbolName), // API 的 page 从 1 开始，所以需要 +1
      getRecordSymbolList(accountId),
    ]);
    setRecords(data[0].data);
    setTotalCount(data[0].count);
    setSymbolList(data[1]);
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    const loadData = async () => {
      const data = await Promise.all([
        getOpenRecordList(accountId, 1, 10, ''), // 使用初始值 10
        getRecordSymbolList(accountId),
      ]);
      setRecords(data[0].data);
      setTotalCount(data[0].count);
      setSymbolList(data[1]);
      setPage(0); // 重置到第一页
    };
    loadData();
  }, [accountId]);

  const handleDialogClose = (isSuccess: boolean) => {
    setIsDialogOpen(false);
    if (isSuccess) {
      loadRecords(page, rowsPerPage, selectedSymbol?.symbol || '');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, record: OpenRecord) => {
    setAnchorEl(event.currentTarget);
    console.log(record);
    setSelectedRecord(record);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRecord(null);
  };

  const handleDelete = () => {
    // TODO: 实现删除功能
    console.log('删除记录:', selectedRecord);
    deleteOpenRecord(selectedRecord?.id || '')
      .then((res) => {
        console.log(res)
        loadRecords(page, rowsPerPage, selectedSymbol?.symbol || '');
      })
      .catch((err) => {
        console.error(err)
      })
    handleMenuClose();
  };

  const handleShowReason = () => {
    setIsReasonDialogOpen(true);
    handleMenuClose();
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
    loadRecords(newPage, rowsPerPage, selectedSymbol?.symbol || '');
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    loadRecords(0, newRowsPerPage, selectedSymbol?.symbol || '');
  };

  return (
    <>
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        height: 'calc(100vh - 44px)',
        overflow: 'hidden',
        padding: '10px 16px',
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography
            sx={{
              color: 'var(--c-texPri)',
              fontSize: '20px',
              fontWeight: 600,
            }}
          >
            交易计划
          </Typography>
          <Box sx={{ display: 'flex', gap: '20px' }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel sx={{ color: 'var(--c-texSec)' }}>标的名称/代码</InputLabel>
              <Select
                value={selectedSymbol?.symbol || ''}
                onChange={(event) => {
                  const selectedSymbolValue = event.target.value;
                  const symbol = symbolList.find(s => s.symbol === selectedSymbolValue);
                  setSelectedSymbol(symbol || null);
                  // 选择改变时重新获取数据
                  setPage(0);
                  loadRecords(0, rowsPerPage, selectedSymbolValue || '');
                }}
                label="标的名称/代码"
                sx={{
                  color: 'var(--c-texPri)',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'var(--c-borPri)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'var(--c-borStr)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'var(--c-borStr)',
                  },
                  '& .MuiSelect-icon': {
                    color: 'var(--c-texSec)',
                  },
                }}
              >
                <MenuItem value="">
                  <em>全部</em>
                </MenuItem>
                {symbolList.map((symbol) => (
                  <MenuItem key={symbol.symbol} value={symbol.symbol}>
                    {`${symbol.name}${symbol.symbol}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {
              accountId && (<Button
                startIcon={<AddIcon />}
                onClick={() => setIsDialogOpen(true)}
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
                创建新单
              </Button>)
            }
          </Box>


        </Box>

        <TableContainer
          component={Paper}
          sx={{
            backgroundColor: 'var(--c-bacPri)',
            border: '1px solid var(--c-borPri)',
            borderRadius: '8px',
            flexGrow: 1,
            overflow: 'auto',
          }}
        >
          <Table sx={{ minWidth: 650 }} aria-label="开单记录表格" stickyHeader>
            <TableHead sx={{ position: 'sticky', top: 0, backgroundColor: 'var(--c-bacPri)', zIndex: 1000 }}>
              <TableRow>
                <StyledTableHeadCell sx={{ color: 'var(--c-texSec)', fontWeight: 600, borderColor: 'var(--c-borPri)' }}>
                  标的名称/代码
                </StyledTableHeadCell>
                <StyledTableHeadCell sx={{ color: 'var(--c-texSec)', fontWeight: 600, borderColor: 'var(--c-borPri)' }}>
                  进场时间
                </StyledTableHeadCell>
                <StyledTableHeadCell sx={{ color: 'var(--c-texSec)', fontWeight: 600, borderColor: 'var(--c-borPri)' }}>
                  买入价
                </StyledTableHeadCell>
                <StyledTableHeadCell sx={{ color: 'var(--c-texSec)', fontWeight: 600, borderColor: 'var(--c-borPri)' }}>
                  止损价
                </StyledTableHeadCell>
                <StyledTableHeadCell sx={{ color: 'var(--c-texSec)', fontWeight: 600, borderColor: 'var(--c-borPri)' }}>
                  止赢价
                </StyledTableHeadCell>
                <StyledTableHeadCell sx={{ color: 'var(--c-texSec)', fontWeight: 600, borderColor: 'var(--c-borPri)' }}>
                  盈亏比
                </StyledTableHeadCell>
                <StyledTableHeadCell sx={{ color: 'var(--c-texSec)', fontWeight: 600, borderColor: 'var(--c-borPri)' }}>
                  数量
                </StyledTableHeadCell>
                <StyledTableHeadCell sx={{ color: 'var(--c-texSec)', fontWeight: 600, borderColor: 'var(--c-borPri)' }}>
                  总金额
                </StyledTableHeadCell>
                <StyledTableHeadCell sx={{ color: 'var(--c-texSec)', fontWeight: 600, borderColor: 'var(--c-borPri)' }}>
                  预计亏损
                </StyledTableHeadCell>
                <StyledTableHeadCell sx={{ color: 'var(--c-texSec)', fontWeight: 600, borderColor: 'var(--c-borPri)' }}>
                  预计收益
                </StyledTableHeadCell>
                <StyledTableHeadCell sx={{ color: 'var(--c-texSec)', fontWeight: 600, borderColor: 'var(--c-borPri)' }}>
                  操作
                </StyledTableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ color: 'var(--c-texSec)', borderColor: 'var(--c-borPri)' }}>
                    暂无开单记录
                  </TableCell>
                </TableRow>
              ) : (
                records?.map((record, index) => (
                  <TableRow key={`${record.symbol_name}-${record.entry_time}-${index}`} hover>
                    <TableCell sx={{ color: 'var(--c-texPri)', borderColor: 'var(--c-borPri)' }}>
                      {record.symbol_name}
                    </TableCell>
                    <TableCell sx={{ color: 'var(--c-texPri)', borderColor: 'var(--c-borPri)' }}>
                      {formatDate(record.entry_time)}
                    </TableCell>
                    <TableCell sx={{ color: 'var(--c-texPri)', borderColor: 'var(--c-borPri)' }}>
                      {record.buy_price.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ color: 'var(--cd-palGre500)', borderColor: 'var(--c-borPri)' }}>
                      {record.stop_loss_price.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ color: 'var(--cd-palRed700)', borderColor: 'var(--c-borPri)' }}>
                      {record.take_profit_price.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ color: 'var(--c-texPri)', borderColor: 'var(--c-borPri)' }}>
                      {record.profit_loss_ratio.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ color: 'var(--c-texPri)', borderColor: 'var(--c-borPri)' }}>
                      {record.plan_quantity}
                    </TableCell>
                    <TableCell sx={{ color: 'var(--c-texPri)', borderColor: 'var(--c-borPri)' }}>
                      {record.total_amount.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ color: 'var(--cd-palGre500)', borderColor: 'var(--c-borPri)' }}>
                      {((record['buy_price'] - record['stop_loss_price']) * record['plan_quantity']).toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ color: 'var(--cd-palRed700)', borderColor: 'var(--c-borPri)' }}>
                      {((record['take_profit_price'] - record['buy_price']) * record['plan_quantity']).toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ color: 'var(--c-texPri)', borderColor: 'var(--c-borPri)' }}>
                      <IconButton
                        onClick={(e) => handleMenuOpen(e, record)}
                        sx={{
                          color: 'var(--c-texSec)',
                          '&:hover': {
                            backgroundColor: 'rgba(255,255,243,.082)',
                            color: 'var(--c-texPri)',
                          },
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Box>
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
            labelRowsPerPage="每页显示:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} 共 ${count !== -1 ? count : `超过 ${to}`} 条`}
            sx={{
              color: 'var(--c-texSec)',
              borderTop: '1px solid var(--c-borPri)',
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                color: 'var(--c-texSec)',
                fontSize: '14px',
              },
              '& .MuiTablePagination-select': {
                color: 'var(--c-texPri)',
                fontSize: '14px',
              },
              '& .MuiTablePagination-actions': {
                color: 'var(--c-texSec)',
                '& .MuiIconButton-root': {
                  color: 'var(--c-texSec)',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,243,.082)',
                    color: 'var(--c-texPri)',
                  },
                  '&.Mui-disabled': {
                    color: 'var(--c-borSec)',
                  },
                },
              },
              '& .MuiTablePagination-selectIcon': {
                color: 'var(--c-texSec)',
              },
            }}
          />
        </Box>
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        sx={{
          '& .MuiPaper-root': {
            backgroundColor: 'var(--c-bacPri)',
            border: '1px solid var(--c-borPri)',
            borderRadius: '8px',
            minWidth: '160px',
          },
        }}
      >
        <MenuItem
          onClick={handleShowReason}
          sx={{
            color: '#ada9a3',
            fontSize: '14px',
            padding: '10px 16px',
            '&:hover': {
              backgroundColor: 'rgba(255,255,243,.082)',
              color: 'var(--c-texPri)',
            },
          }}
        >
          <VisibilityIcon sx={{ marginRight: '8px', fontSize: '18px' }} />
          查看开仓理由
        </MenuItem>
        <MenuItem
          onClick={handleDelete}
          sx={{
            color: 'var(--c-texSec)',
            fontSize: '14px',
            padding: '10px 16px',
            '&:hover': {
              backgroundColor: 'rgba(255,255,243,.082)',
              color: 'var(--cd-palRed700)',
            },
          }}
        >
          <DeleteIcon sx={{ marginRight: '8px', fontSize: '18px' }} />
          删除
        </MenuItem>
      </Menu>
      <CreateOpenRecordDialog
        isOpen={isDialogOpen}
        onClose={handleDialogClose}
        accountID={accountId || ''}
      />
      {/* 显示开仓理由的对话框 */}
      <Dialog
        open={isReasonDialogOpen}
        onClose={() => setIsReasonDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            background: '#202020',
            color: '#9b9b9b',
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
          开仓理由
        </DialogTitle>
        <DialogContent sx={{ padding: '24px' }}>
          <Typography
            sx={{
              color: 'var(--c-texPri)',
              fontSize: '14px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
            }}
          >
            {selectedRecord?.entry_reason || '暂无开仓理由'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px 24px 24px', borderTop: '1px solid var(--c-borSec)' }}>
          <Button
            onClick={() => setIsReasonDialogOpen(false)}
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
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default OpenRecordView