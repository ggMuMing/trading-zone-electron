interface ExtraButton {
  icon: React.ReactNode,
  onClick: () => void,
}

interface NavItemData {
  type: 'branch' | 'leaf',
  text: string,
  index: string,
  icon: React.ReactNode,
  children: NavItemData[] | null,
  textSx: React.CSSProperties,
  extraButtons: ExtraButton[],
  level: number,
  route: string,
  parentIndex: string | null,
}

type BasicKlineData = {
  date: string,
  open: number,
  close: number,
  high: number,
  low: number,
  volume: number,
  amount: number,
}

export type { NavItemData, ExtraButton, BasicKlineData }