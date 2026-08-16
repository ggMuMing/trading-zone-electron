import { proxy } from 'valtio'

interface NavState {
  isCreateAccountDialogOpen: boolean,
  accountNameIdMap: Record<string, string>,
}

const navState = proxy<NavState>({
  isCreateAccountDialogOpen: false,
  accountNameIdMap: {},
})

export const setIsCreateAccountDialogOpen = (isOpen: boolean) => {
  navState.isCreateAccountDialogOpen = isOpen
}

export const setAccountNameIdMap = (name: string, id: string) => {
  navState.accountNameIdMap[name] = id
}

export const getAccountId = (name: string) => {
  return navState.accountNameIdMap[name]
}

export default navState