import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import CropSquareIcon from '@mui/icons-material/CropSquare'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule'
import RemoveIcon from '@mui/icons-material/Remove'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import SvgIcon from '@mui/material/SvgIcon'
import TimelineIcon from '@mui/icons-material/Timeline'
import { useRef, useState, type ComponentType, type RefObject } from 'react'
import type { SvgIconProps } from '@mui/material/SvgIcon'
import {
  DEFAULT_DRAWING_STROKE,
  type DrawingLineStyle,
  type DrawingLineWidth,
  type DrawingStroke,
  type DrawingTool
} from '../../../../shared/types/chartDrawing'
import { CHART_ICON_HOVER } from '../../theme/chartChrome'
import { StylePalette } from './StylePalette'

/** 与主工具栏 `size="small"` 按钮图标同号。 */
const TOOLBAR_ICON_FONT = 18

interface ToolOption {
  tool: DrawingTool
  label: string
  Icon: ComponentType<SvgIconProps>
}

const LINE_TOOLS: ToolOption[] = [
  { tool: 'hline', label: '水平线', Icon: HorizontalRuleIcon },
  { tool: 'trend', label: '线段', Icon: TimelineIcon },
  { tool: 'hsegment', label: '水平线段', Icon: RemoveIcon },
  { tool: 'xline', label: '直线', Icon: ShowChartIcon }
]

const SHAPE_TOOLS: ToolOption[] = [{ tool: 'rect', label: '矩形', Icon: CropSquareIcon }]

const LINE_STYLE_OPTIONS: ReadonlyArray<{ value: DrawingLineStyle; label: string }> = [
  { value: 'solid', label: '实线' },
  { value: 'dashed', label: '虚线' },
  { value: 'dotted', label: '点线' }
]

const LINE_WIDTH_OPTIONS: readonly DrawingLineWidth[] = [1, 2, 3, 4]

function MagnetIcon(props: SvgIconProps): React.JSX.Element {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d="M4 2h5v10a3 3 0 0 0 6 0V2h5v10a8 8 0 0 1-16 0V2z" />
    </SvgIcon>
  )
}

export interface DrawingToolbarProps {
  drawingTool?: DrawingTool | null
  onDrawingToolChange?: (tool: DrawingTool | null) => void
  drawingStroke?: DrawingStroke
  onDrawingStrokeChange?: (stroke: DrawingStroke) => void
  drawingDisabled?: boolean
  canDeleteDrawing?: boolean
  onDeleteDrawing?: () => void
  canDeleteAllDrawings?: boolean
  onDeleteAllDrawings?: () => void
  snapEnabled?: boolean
  onSnapEnabledChange?: (enabled: boolean) => void
}

const buttonSx = {
  pl: 0,
  pr: 0.75,
  py: 0,
  minWidth: 0,
  minHeight: 0,
  textTransform: 'none',
  '& .MuiButton-startIcon': {
    ml: 0,
    mr: 0.5
  }
} as const

const selectedSx = {
  color: CHART_ICON_HOVER,
  bgcolor: 'transparent',
  '&:hover': { color: CHART_ICON_HOVER, bgcolor: 'transparent' },
  '&.Mui-selected': { color: CHART_ICON_HOVER, bgcolor: 'transparent' },
  '&.Mui-selected:hover': { color: CHART_ICON_HOVER, bgcolor: 'transparent' }
}

function menuItemSx(selected: boolean): Record<string, unknown> {
  return {
    px: 1,
    py: 0.5,
    minHeight: 28,
    gap: 0.5,
    ...(selected ? selectedSx : {})
  }
}

function DropArrow({
  label,
  disabled,
  expanded,
  onOpen
}: {
  label: string
  disabled: boolean
  expanded: boolean
  onOpen: () => void
}): React.JSX.Element {
  return (
    <Box
      component="span"
      role="button"
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={expanded}
      aria-disabled={disabled || undefined}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.stopPropagation()
        if (!disabled) {
          onOpen()
        }
      }}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        lineHeight: 1,
        px: '3px',
        color: 'text.secondary',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        '&:hover': disabled ? undefined : { color: CHART_ICON_HOVER }
      }}
    >
      <ArrowDropDownIcon sx={{ fontSize: TOOLBAR_ICON_FONT }} />
    </Box>
  )
}

function LineStyleMark({ style }: { style: DrawingLineStyle }): React.JSX.Element {
  return (
    <Box
      sx={{
        width: 18,
        borderTopWidth: 2,
        borderTopStyle: style,
        borderTopColor: 'currentColor'
      }}
    />
  )
}

function LineWidthMark({ width }: { width: DrawingLineWidth }): React.JSX.Element {
  return <Box sx={{ width: 18, height: `${width}px`, bgcolor: 'currentColor' }} />
}

function StrokeMenus({
  stroke,
  disabled,
  onChange
}: {
  stroke: DrawingStroke
  disabled: boolean
  onChange?: (stroke: DrawingStroke) => void
}): React.JSX.Element {
  const colorRef = useRef<HTMLDivElement>(null)
  const styleRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef<HTMLDivElement>(null)
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null)
  const [styleAnchor, setStyleAnchor] = useState<HTMLElement | null>(null)
  const [widthAnchor, setWidthAnchor] = useState<HTMLElement | null>(null)
  const locked = disabled || !onChange

  const openFrom = (ref: RefObject<HTMLDivElement | null>, setAnchor: (el: HTMLElement | null) => void): void => {
    if (!locked && ref.current) {
      setAnchor(ref.current)
    }
  }

  return (
    <>
      <Box ref={colorRef} title="颜色" sx={{ display: 'inline-flex', alignItems: 'center', mr: 0.25 }}>
        <Box
          component="button"
          type="button"
          title="颜色"
          aria-label="颜色"
          disabled={locked}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => openFrom(colorRef, setColorAnchor)}
          sx={{
            width: 14,
            height: 14,
            p: 0,
            border: 1,
            borderColor: 'divider',
            borderRadius: '2px',
            bgcolor: stroke.color,
            cursor: locked ? 'not-allowed' : 'pointer',
            opacity: locked ? 0.35 : 1
          }}
        />
        <DropArrow
          label="颜色"
          disabled={locked}
          expanded={Boolean(colorAnchor)}
          onOpen={() => openFrom(colorRef, setColorAnchor)}
        />
      </Box>
      <StylePalette
        color={stroke.color}
        anchorEl={colorAnchor}
        onClose={() => setColorAnchor(null)}
        onChange={(next) => onChange?.({ ...stroke, color: next.color })}
      />
      <Box ref={styleRef} title="线条类型" sx={{ display: 'inline-flex', alignItems: 'center', mr: 0.25, color: 'text.primary' }}>
        <Box
          component="button"
          type="button"
          title="线条类型"
          aria-label="线条类型"
          disabled={locked}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => openFrom(styleRef, setStyleAnchor)}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            p: 0,
            border: 0,
            bgcolor: 'transparent',
            color: 'inherit',
            cursor: locked ? 'not-allowed' : 'pointer',
            opacity: locked ? 0.35 : 1
          }}
        >
          <LineStyleMark style={stroke.lineStyle} />
        </Box>
        <DropArrow
          label="线条类型"
          disabled={locked}
          expanded={Boolean(styleAnchor)}
          onOpen={() => openFrom(styleRef, setStyleAnchor)}
        />
      </Box>
      <Menu
        anchorEl={styleAnchor}
        open={Boolean(styleAnchor)}
        onClose={() => setStyleAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {LINE_STYLE_OPTIONS.map((item) => (
          <MenuItem
            key={item.value}
            selected={stroke.lineStyle === item.value}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange?.({ ...stroke, lineStyle: item.value })
              setStyleAnchor(null)
            }}
            sx={menuItemSx(stroke.lineStyle === item.value)}
          >
            <LineStyleMark style={item.value} />
            {item.label}
          </MenuItem>
        ))}
      </Menu>
      <Box ref={widthRef} title="线条粗细" sx={{ display: 'inline-flex', alignItems: 'center', mr: 1, color: 'text.primary' }}>
        <Box
          component="button"
          type="button"
          title="线条粗细"
          aria-label="线条粗细"
          disabled={locked}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => openFrom(widthRef, setWidthAnchor)}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            width: 18,
            height: 14,
            p: 0,
            border: 0,
            bgcolor: 'transparent',
            color: 'inherit',
            cursor: locked ? 'not-allowed' : 'pointer',
            opacity: locked ? 0.35 : 1
          }}
        >
          <LineWidthMark width={stroke.lineWidth} />
        </Box>
        <DropArrow
          label="线条粗细"
          disabled={locked}
          expanded={Boolean(widthAnchor)}
          onOpen={() => openFrom(widthRef, setWidthAnchor)}
        />
      </Box>
      <Menu
        anchorEl={widthAnchor}
        open={Boolean(widthAnchor)}
        onClose={() => setWidthAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {LINE_WIDTH_OPTIONS.map((item) => (
          <MenuItem
            key={item}
            selected={stroke.lineWidth === item}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange?.({ ...stroke, lineWidth: item })
              setWidthAnchor(null)
            }}
            sx={menuItemSx(stroke.lineWidth === item)}
          >
            <LineWidthMark width={item} />
            {`${item}px`}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

function ToolMenuButton({
  tools,
  drawingTool,
  disabled,
  onChange
}: {
  tools: readonly ToolOption[]
  drawingTool: DrawingTool | null
  disabled: boolean
  onChange?: (tool: DrawingTool | null) => void
}): React.JSX.Element {
  const groupRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [remembered, setRemembered] = useState(tools[0].tool)
  const armed = tools.some((item) => item.tool === drawingTool) ? drawingTool : null
  const shown = tools.find((item) => item.tool === (armed ?? remembered)) ?? tools[0]
  const pressed = armed === shown.tool

  const choose = (tool: DrawingTool): void => {
    setRemembered(tool)
    onChange?.(tool)
    setAnchor(null)
  }

  return (
    <>
      <Box ref={groupRef} sx={{ display: 'inline-flex', alignItems: 'center', mr: 0.25 }}>
        <Button
          size="small"
          startIcon={<shown.Icon />}
          disabled={disabled}
          aria-pressed={pressed}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onChange?.(pressed ? null : shown.tool)}
          sx={{ ...buttonSx, pr: 0, ...(pressed ? selectedSx : {}) }}
        >
          {shown.label}
        </Button>
        <Box
          component="span"
          role="button"
          aria-label={`${shown.label}更多`}
          aria-haspopup="menu"
          aria-expanded={Boolean(anchor)}
          aria-disabled={disabled || undefined}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation()
            if (!disabled && groupRef.current) {
              setAnchor(groupRef.current)
            }
          }}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            lineHeight: 1,
            px: '3px',
            color: 'text.secondary',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.35 : 1,
            '&:hover': disabled ? undefined : { color: CHART_ICON_HOVER }
          }}
        >
          <ArrowDropDownIcon sx={{ fontSize: TOOLBAR_ICON_FONT }} />
        </Box>
      </Box>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {tools.map((item) => (
          <MenuItem
            key={item.tool}
            selected={shown.tool === item.tool}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(item.tool)}
            sx={{
              px: 1,
              py: 0.5,
              minHeight: 28,
              gap: 0.5
            }}
          >
            <item.Icon sx={{ fontSize: TOOLBAR_ICON_FONT }} />
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export function DrawingToolbar({
  drawingTool = null,
  onDrawingToolChange,
  drawingStroke = DEFAULT_DRAWING_STROKE,
  onDrawingStrokeChange,
  drawingDisabled = false,
  canDeleteDrawing = false,
  onDeleteDrawing,
  canDeleteAllDrawings = false,
  onDeleteAllDrawings,
  snapEnabled = true,
  onSnapEnabledChange
}: DrawingToolbarProps): React.JSX.Element {
  const disabled = drawingDisabled || !onDrawingToolChange
  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{ pl: 1, pr: 2, py: 0.25, borderBottom: 1, borderColor: 'divider', minHeight: 28 }}
    >
      <StrokeMenus stroke={drawingStroke} disabled={false} onChange={onDrawingStrokeChange} />
      <ToolMenuButton
        tools={LINE_TOOLS}
        drawingTool={drawingTool}
        disabled={disabled}
        onChange={onDrawingToolChange}
      />
      <ToolMenuButton
        tools={SHAPE_TOOLS}
        drawingTool={drawingTool}
        disabled={disabled}
        onChange={onDrawingToolChange}
      />
      <Button
        size="small"
        startIcon={<DeleteOutlineIcon />}
        disabled={drawingDisabled || !canDeleteDrawing}
        onClick={onDeleteDrawing}
        sx={{ ...buttonSx, mx: 0.25 }}
      >
        删除
      </Button>
      <Button
        size="small"
        startIcon={<DeleteOutlineIcon />}
        disabled={drawingDisabled || !canDeleteAllDrawings}
        onClick={onDeleteAllDrawings}
        sx={{ ...buttonSx, mx: 0.25 }}
      >
        全部删除
      </Button>
      <Button
        size="small"
        startIcon={<MagnetIcon />}
        aria-pressed={snapEnabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onSnapEnabledChange?.(!snapEnabled)}
        sx={{ ...buttonSx, mx: 0.25, ...(snapEnabled ? selectedSx : {}) }}
      >
        吸附
      </Button>
    </Stack>
  )
}
