export interface TreemapBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface TreemapRect<T> extends TreemapBounds {
  item: T
}

interface TreemapInput<T> {
  item: T
  value: number
}

/** 按数值对半切开的矩形树图，切分方向沿较长的一边。间距从每个格子向内收缩。 */
export function binaryTreemap<T>(
  items: TreemapInput<T>[],
  x: number,
  y: number,
  width: number,
  height: number,
  gap = 0
): TreemapRect<T>[] {
  const sorted = items
    .filter((entry) => entry.value > 0)
    .sort((left, right) => right.value - left.value)
  return layout(sorted, { x, y, width, height }).filter((rect) => rect.width > 1 && rect.height > 1)

  function layout(entries: TreemapInput<T>[], bounds: TreemapBounds): TreemapRect<T>[] {
    if (entries.length === 0 || bounds.width <= 1 || bounds.height <= 1) {
      return []
    }
    if (entries.length === 1) {
      return [inset({ item: entries[0].item, ...bounds }, gap)]
    }

    const splitIndex = balancedSplit(entries)
    const firstEntries = entries.slice(0, splitIndex)
    const secondEntries = entries.slice(splitIndex)
    if (firstEntries.length === 0 || secondEntries.length === 0) {
      const sliceHeight = bounds.height / entries.length
      return entries.map((entry, index) =>
        inset(
          {
            item: entry.item,
            x: bounds.x,
            y: bounds.y + sliceHeight * index,
            width: bounds.width,
            height: sliceHeight
          },
          gap
        )
      )
    }

    const total = sumValues(entries)
    const { first, second } = splitBounds(bounds, sumValues(firstEntries) / total)
    return [...layout(firstEntries, first), ...layout(secondEntries, second)]
  }
}

function balancedSplit<T>(items: TreemapInput<T>[]): number {
  if (items.length <= 1) {
    return items.length
  }
  const target = sumValues(items) / 2
  let cumulative = 0
  let bestIndex = 1
  let bestDiff = Number.POSITIVE_INFINITY
  for (let index = 1; index < items.length; index += 1) {
    cumulative += items[index - 1].value
    const diff = Math.abs(target - cumulative)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIndex = index
    }
  }
  return bestIndex
}

function sumValues<T>(items: TreemapInput<T>[]): number {
  let total = 0
  for (const entry of items) {
    total += entry.value
  }
  return total
}

function splitBounds(
  bounds: TreemapBounds,
  ratio: number
): { first: TreemapBounds; second: TreemapBounds } {
  if (bounds.width >= bounds.height) {
    const leftWidth = bounds.width * ratio
    return {
      first: { x: bounds.x, y: bounds.y, width: leftWidth, height: bounds.height },
      second: {
        x: bounds.x + leftWidth,
        y: bounds.y,
        width: Math.max(0, bounds.width - leftWidth),
        height: bounds.height
      }
    }
  }
  const topHeight = bounds.height * ratio
  return {
    first: { x: bounds.x, y: bounds.y, width: bounds.width, height: topHeight },
    second: {
      x: bounds.x,
      y: bounds.y + topHeight,
      width: bounds.width,
      height: Math.max(0, bounds.height - topHeight)
    }
  }
}

function inset<T>(rect: TreemapRect<T>, gap: number): TreemapRect<T> {
  const pad = gap / 2
  return {
    ...rect,
    x: rect.x + pad,
    y: rect.y + pad,
    width: Math.max(0, rect.width - gap),
    height: Math.max(0, rect.height - gap)
  }
}
