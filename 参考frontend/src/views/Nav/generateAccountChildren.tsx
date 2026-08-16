import type { NavItemData } from '../../../data/type'
import TourOutlinedIcon from '@mui/icons-material/TourOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';
import type { Account } from '../../api/apiType';
import DeleteIcon from '@mui/icons-material/Delete';
import { deleteAccount } from '../../api/api';

export function generateAccountNode(account: Account): NavItemData {
  return {
    index: account.name,
    type: 'branch',
    text: account.name,
    icon: <LocalAtmIcon fontSize="small" />,
    children: Object.values(generateAccountChildren(account.name)),
    textSx: { fontWeight: 'normal', color: 'inactive' },
    extraButtons: [
      {
        icon: <DeleteIcon fontSize="small" />,
        onClick: () => {
          deleteAccount({ id: account.id }).then((res) => {
            console.log(res)
          }).catch((err) => {
            console.error(err)
          })
        }
      }
    ],
    level: 1,
    route: `/account/${account.name}`,
    parentIndex: 'account',
  }
}

export function generateAccountChildren(accountName: string): Record<string, NavItemData> {
  return {
    accountTradeRecord: {
      index: `${accountName}-trade-plan`,
      type: 'leaf',
      text: '交易计划',
      icon: <TourOutlinedIcon fontSize="small" />,
      textSx: { fontWeight: 'normal', color: 'inactive' },
      extraButtons: [],
      level: 2,
      children: null,
      route: `/account/${accountName}/trade-plan`,
      parentIndex: accountName,
    },
    accountDeliverySlip: {
      index: `${accountName}-delivery-slip`,
      type: 'leaf',
      text: '交割单',
      icon: <ListAltOutlinedIcon fontSize="small" />,
      textSx: { fontWeight: 'normal', color: 'inactive' },
      extraButtons: [],
      level: 2,
      children: null,
      route: `/account/${accountName}/delivery-slip`,
      parentIndex: accountName,
    },
  }
}

