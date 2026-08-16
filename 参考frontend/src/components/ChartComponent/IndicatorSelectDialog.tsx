import { useEffect, useRef, useState } from "react";
import {
    Dialog,
    DialogActions,
    DialogTitle,
    DialogContent,
    Typography,
    IconButton,
    Box,
    Button,
    TextField,
    InputAdornment,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    ToggleButton,
    ToggleButtonGroup,
    Popover,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useSnapshot } from "valtio";
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import BarChartIcon from "@mui/icons-material/BarChart";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import ExtensionIcon from "@mui/icons-material/Extension";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import DoNotDisturbIcon from "@mui/icons-material/DoNotDisturb";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import { DialogPaperComponent } from "./ChartService";
import {
    addChartLayoutIndicator,
    deleteChartLayoutIndicator,
    deleteCustomIndicator,
    getChartIndicatorMeta,
    getChartIndicators,
    getCustomIndicators,
    getSelectedStrategies,
    getStrategyList,
    setSelectedStrategies,
    updateChartLayoutIndicator,
} from "../../api/api";
import type {
    ChartIndicatorMeta,
    ChartIndicatorParamSpec,
    ChartIndicatorSeriesSpec,
    ChartIndicatorSummary,
    ChartLayout,
    ChartLayoutIndicatorInstance,
    StrategySummary,
} from "../../api/apiType";
import ChartComponentProxy, { syncChartLayout, syncSelectedStrategies } from "./ChartComponentProxy";

type IndicatorSelectDialogProps = {
    isOpen: boolean;
    onClose: (isSuccess: boolean) => void;
    /** 从主图/副图状态栏点击设置时，自动打开对应指标配置 */
    autoOpenConfigForInstanceId?: string | null;
    /** 仅弹出“设置/修改”对话框，不显示选择器对话框 */
    configOnly?: boolean;
    /** 模拟盘等场景只允许管理指标，不显示策略选择 */
    indicatorsOnly?: boolean;
};

type BuiltInCategory = "technicals" | "fundamentals" | "custom";
type RightTab = "indicators" | "strategies";
type ScriptItem = {
    id: string;
    name: string;
    description?: string;
};

const SCRIPT_LIST_ROW_HEIGHT = 52;

const MA_SLOT_COUNT = 5;
const DEFAULT_MA_COLORS = ["#ffeb3b", "#ff9800", "#e91e63", "#2196f3", "#9c27b0"] as const;

/** 预留：基本面 Indicators / Strategies，目前为空 */
const FUNDAMENTAL_INDICATOR_SCRIPTS: readonly string[] = [];
const FUNDAMENTAL_STRATEGY_SCRIPTS: readonly string[] = [];

type MaConfigRow = {
    key: string;
    periodKey: string;
    period: string;
    color: string;
};

function getMaConfigRows(instance: ChartLayoutIndicatorInstance): MaConfigRow[] {
    return Array.from({ length: MA_SLOT_COUNT }, (_, index) => {
        const slot = index + 1;
        const key = `ma${slot}`;
        const periodKey = `period${slot}`;
        const series = instance.series.find(item => item.key === key);
        const period = instance.params?.[periodKey];

        return {
            key,
            periodKey,
            period: typeof period === "number" || typeof period === "string" ? String(period) : "",
            color: series?.color || DEFAULT_MA_COLORS[index],
        };
    });
}

const IndicatorSelectDialog = (props: IndicatorSelectDialogProps) => {
    const { isOpen, onClose, autoOpenConfigForInstanceId, configOnly = false, indicatorsOnly = false } = props;
    const [builtIn, setBuiltIn] = useState<BuiltInCategory>("technicals");
    const [rightTab, setRightTab] = useState<RightTab>("indicators");
    const [technicalIndicators, setTechnicalIndicators] = useState<ChartIndicatorSummary[]>([]);
    const [technicalStrategies, setTechnicalStrategies] = useState<StrategySummary[]>([]);
    const [customIndicators, setCustomIndicators] = useState<ChartIndicatorSummary[]>([]);
    const [isLoadingIndicators, setIsLoadingIndicators] = useState(false);
    const [isLoadingStrategies, setIsLoadingStrategies] = useState(false);
    const [isLoadingCustomIndicators, setIsLoadingCustomIndicators] = useState(false);
    const [strategySelectionError, setStrategySelectionError] = useState("");
    const [pendingActionIds, setPendingActionIds] = useState<Set<string>>(() => new Set());
    const [editingMaInstance, setEditingMaInstance] = useState<ChartLayoutIndicatorInstance | null>(null);
    const [maRows, setMaRows] = useState<MaConfigRow[]>([]);
    const [maConfigError, setMaConfigError] = useState("");
    const [isSavingMaConfig, setIsSavingMaConfig] = useState(false);
    const [editingInstance, setEditingInstance] = useState<ChartLayoutIndicatorInstance | null>(null);
    const [editingMeta, setEditingMeta] = useState<ChartIndicatorMeta | null>(null);
    const [paramRows, setParamRows] = useState<Array<{ key: string; label: string; type: string; value: string; spec: ChartIndicatorParamSpec }>>([]);
    const [seriesColorRows, setSeriesColorRows] = useState<Array<{ key: string; label: string; color: string }>>([]);
    const [genericConfigError, setGenericConfigError] = useState("");
    const [isSavingGenericConfig, setIsSavingGenericConfig] = useState(false);
    const chartState = useSnapshot(ChartComponentProxy);
    const autoOpenedRef = useRef(false);
    const [descriptionPopoverAnchor, setDescriptionPopoverAnchor] = useState<HTMLElement | null>(null);
    const [descriptionPopoverText, setDescriptionPopoverText] = useState("");

    const refreshCustomIndicators = async () => {
        setIsLoadingCustomIndicators(true);
        try {
            const rows = await getCustomIndicators();
            setCustomIndicators(rows);
            return rows;
        } finally {
            setIsLoadingCustomIndicators(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        let cancelled = false;
        queueMicrotask(() => {
            if (!cancelled) setIsLoadingIndicators(true);
            if (!cancelled && !indicatorsOnly) setIsLoadingStrategies(true);
            if (!cancelled) setIsLoadingCustomIndicators(true);
        });
        getChartIndicators()
            .then((rows) => {
                if (!cancelled) setTechnicalIndicators(rows);
            })
            .finally(() => {
                if (!cancelled) setIsLoadingIndicators(false);
            });
        if (!indicatorsOnly) {
            getStrategyList()
                .then((rows) => {
                    if (!cancelled) setTechnicalStrategies(rows);
                })
                .finally(() => {
                    if (!cancelled) setIsLoadingStrategies(false);
                });
        } else {
            queueMicrotask(() => {
                if (cancelled) return;
                setTechnicalStrategies([]);
                setIsLoadingStrategies(false);
                setRightTab("indicators");
            });
        }
        getCustomIndicators()
            .then((rows) => {
                if (!cancelled) setCustomIndicators(rows);
            })
            .finally(() => {
                if (!cancelled) setIsLoadingCustomIndicators(false);
            });
        if (!indicatorsOnly) {
            getSelectedStrategies()
                .then((selected) => {
                    if (!cancelled) syncSelectedStrategies(selected);
                });
        }

        return () => {
            cancelled = true;
        };
    }, [isOpen, indicatorsOnly]);

    const activeRightTab: RightTab = indicatorsOnly ? "indicators" : rightTab;
    const isTechnicalStrategyTab = !indicatorsOnly && builtIn === "technicals" && activeRightTab === "strategies";
    const isCustomCategory = builtIn === "custom";

    const scripts: readonly ScriptItem[] =
        builtIn === "technicals"
            ? activeRightTab === "indicators"
                ? technicalIndicators.map((item) => ({
                      id: item.id,
                      name: item.name,
                      description: item.description,
                  }))
                : technicalStrategies.map((item) => ({
                      id: item.id,
                      name: item.name,
                      description: item.description,
                  }))
            : builtIn === "custom"
              ? customIndicators.map((item) => ({
                    id: item.id,
                    name: item.name,
                    description: item.description,
                }))
              : activeRightTab === "indicators"
                ? FUNDAMENTAL_INDICATOR_SCRIPTS.map((name) => ({ id: name, name }))
                : FUNDAMENTAL_STRATEGY_SCRIPTS.map((name) => ({ id: name, name }));

    const setIndicatorPending = (indicatorId: string, isPending: boolean) => {
        setPendingActionIds(prev => {
            const next = new Set(prev);
            if (isPending) {
                next.add(indicatorId);
            } else {
                next.delete(indicatorId);
            }
            return next;
        });
    };

    const addIndicator = async (indicatorId: string) => {
        setIndicatorPending(indicatorId, true);
        try {
            const nextLayout = await addChartLayoutIndicator(indicatorId);
            if (nextLayout) syncChartLayout(nextLayout);
        } finally {
            setIndicatorPending(indicatorId, false);
        }
    };

    const removeIndicator = async (indicatorId: string) => {
        const instances = chartState.indicatorInstances.filter(item => item.indicator_id === indicatorId);
        if (instances.length === 0) return;

        setIndicatorPending(indicatorId, true);
        try {
            let latestLayout: ChartLayout | null = null;
            for (const instance of instances) {
                const nextLayout = await deleteChartLayoutIndicator(instance.instance_id);
                if (nextLayout) latestLayout = nextLayout;
            }
            if (latestLayout) syncChartLayout(latestLayout);
        } finally {
            setIndicatorPending(indicatorId, false);
        }
    };

    const removeCustomIndicatorDefinition = async (indicatorId: string) => {
        if (!indicatorId.startsWith("custom_")) return;
        const ok = window.confirm(`确认删除自定义指标 ${indicatorId} ？\n该指标会从图表布局与常用配置中一并移除，且无法撤销。`);
        if (!ok) return;

        setIndicatorPending(indicatorId, true);
        try {
            const nextLayout = await deleteCustomIndicator(indicatorId);
            if (nextLayout) syncChartLayout(nextLayout);
            await refreshCustomIndicators();
        } finally {
            setIndicatorPending(indicatorId, false);
        }
    };

    const addStrategy = async (strategyId: string) => {
        if (chartState.selectedStrategies.includes(strategyId)) return;
        if (chartState.selectedStrategies.length >= 3) {
            setStrategySelectionError("最多支持三个策略组合。");
            return;
        }

        setStrategySelectionError("");
        setIndicatorPending(strategyId, true);
        try {
            const selected = await setSelectedStrategies([...chartState.selectedStrategies, strategyId]);
            syncSelectedStrategies(selected);
        } finally {
            setIndicatorPending(strategyId, false);
        }
    };

    const removeStrategy = async (strategyId: string) => {
        if (!chartState.selectedStrategies.includes(strategyId)) return;

        setStrategySelectionError("");
        setIndicatorPending(strategyId, true);
        try {
            const selected = await setSelectedStrategies(
                chartState.selectedStrategies.filter(item => item !== strategyId),
            );
            syncSelectedStrategies(selected);
        } finally {
            setIndicatorPending(strategyId, false);
        }
    };

    const openMaConfig = (instance: ChartLayoutIndicatorInstance) => {
        setEditingMaInstance(instance);
        setMaRows(getMaConfigRows(instance));
        setMaConfigError("");
    };

    const updateMaRow = (key: string, patch: Partial<Pick<MaConfigRow, "period" | "color">>) => {
        setMaRows(prev => prev.map(row => row.key === key ? { ...row, ...patch } : row));
    };

    const saveMaConfig = async () => {
        if (!editingMaInstance) return;

        const nextParams: Record<string, number> = {};
        for (const row of maRows) {
            const raw = row.period.trim();
            const period = raw === "" ? 0 : Number(raw);
            if (!Number.isInteger(period) || period < 0) {
                setMaConfigError("周期必须是大于等于 0 的整数，0 或留空表示隐藏。");
                return;
            }
            nextParams[row.periodKey] = period;
        }

        const nextSeries: ChartIndicatorSeriesSpec[] = maRows.map((row, index) => {
            const period = nextParams[row.periodKey];
            const current = editingMaInstance.series.find(item => item.key === row.key);
            return {
                key: row.key,
                label: period > 0 ? `MA${period}` : `MA${index + 1}`,
                plot_type: current?.plot_type || "line",
                color: row.color || DEFAULT_MA_COLORS[index],
                overlay: true,
                panel_index: 0,
            };
        });

        setIsSavingMaConfig(true);
        setMaConfigError("");
        try {
            const nextLayout = await updateChartLayoutIndicator(editingMaInstance.instance_id, {
                params: nextParams,
                series: nextSeries,
            });
            if (nextLayout) {
                syncChartLayout(nextLayout);
                setEditingMaInstance(null);
                if (configOnly) onClose(true);
            }
        } finally {
            setIsSavingMaConfig(false);
        }
    };

    const openGenericConfig = async (instance: ChartLayoutIndicatorInstance) => {
        setGenericConfigError("");
        const meta = await getChartIndicatorMeta(instance.indicator_id);
        if (!meta) {
            setGenericConfigError("获取指标元信息失败，请稍后重试。");
            return;
        }

        const nextParamRows = (meta.params || []).map(spec => {
            const raw = instance.params?.[spec.key];
            const value =
                typeof raw === "number" || typeof raw === "string" || typeof raw === "boolean"
                    ? String(raw)
                    : raw === null || raw === undefined
                      ? ""
                      : JSON.stringify(raw);
            return {
                key: spec.key,
                label: spec.label || spec.key,
                type: spec.type,
                value,
                spec,
            };
        });

        const nextSeriesColorRows = (instance.series || []).map(series => ({
            key: series.key,
            label: series.label || series.key,
            color: series.color || "#2962FF",
        }));

        setEditingInstance(instance);
        setEditingMeta(meta);
        setParamRows(nextParamRows);
        setSeriesColorRows(nextSeriesColorRows);
    };

    const openIndicatorConfig = async (instance: ChartLayoutIndicatorInstance) => {
        if (instance.indicator_id === "ma") {
            openMaConfig(instance);
            return;
        }
        await openGenericConfig(instance);
    };

    useEffect(() => {
        if (!isOpen) return;
        if (!autoOpenConfigForInstanceId) return;
        if (autoOpenedRef.current) return;
        const instance = chartState.indicatorInstances.find(item => item.instance_id === autoOpenConfigForInstanceId);
        if (!instance) return;
        autoOpenedRef.current = true;
        void openIndicatorConfig(instance as unknown as ChartLayoutIndicatorInstance);
    }, [isOpen, autoOpenConfigForInstanceId, chartState.indicatorInstances]);

    useEffect(() => {
        if (isOpen) return;
        autoOpenedRef.current = false;
        setDescriptionPopoverAnchor(null);
        setDescriptionPopoverText("");
    }, [isOpen]);

    useEffect(() => {
        setDescriptionPopoverAnchor(null);
        setDescriptionPopoverText("");
    }, [builtIn, rightTab]);

    return (
        <>
        {!configOnly && (
        <Dialog
            maxWidth="md"
            fullWidth
            scroll="paper"
            onClose={() => {
                onClose(false);
            }}
            open={isOpen}
            PaperComponent={DialogPaperComponent}
            PaperProps={{ sx: { maxHeight: "85vh" } }}
        >
            <DialogTitle
                sx={{ m: 0, pr: 6, py: 2, px: 2 }}
                id="draggable-dialog-title"
                style={{ cursor: "move" }}
            >
                <Typography component="span" variant="h6" fontWeight={600}>
                    {indicatorsOnly ? "Indicators and metrics" : "Indicators, metrics, and strategies"}
                </Typography>
            </DialogTitle>
            <IconButton
                aria-label="close"
                onClick={() => {
                    onClose(false);
                }}
                sx={(theme) => ({
                    position: "absolute",
                    right: 8,
                    top: 8,
                    color: theme.palette.grey[500],
                })}
            >
                <CloseIcon />
            </IconButton>
            <DialogContent
                dividers
                sx={{
                    p: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    minHeight: 180,
                    height: 500,
                }}
            >
                <Box sx={{ px: 2, pt: 1, pb: 2, flexShrink: 0 }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon
                                        fontSize="small"
                                        sx={{ color: "text.secondary" }}
                                    />
                                </InputAdornment>
                            ),
                        }}
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                borderRadius: 1,
                            },
                        }}
                    />
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        flex: 1,
                        minHeight: 0,
                        overflow: "hidden",
                    }}
                >
                    <Box
                        sx={{
                            width: 220,
                            flexShrink: 0,
                            borderColor: "divider",
                            py: 1,
                            px: 0.5,
                            minHeight: 0,
                            overflowY: "auto",
                        }}
                    >
                        <Typography
                            variant="overline"
                            color="text.secondary"
                            sx={{ px: 1.5, display: "block", letterSpacing: 0.08 }}
                        >
                            BUILT-IN
                        </Typography>
                        <List dense disablePadding sx={{ mt: 0.5 }}>
                            <ListItemButton
                                selected={builtIn === "technicals"}
                                onClick={() => {
                                    setBuiltIn("technicals");
                                }}
                                sx={{
                                    borderRadius: 1,
                                    mx: 0.5,
                                    py: 1,
                                    "&.Mui-selected": {
                                        bgcolor: "action.selected",
                                    },
                                }}
                            >
                                <ShowChartIcon
                                    sx={{ mr: 1.5, fontSize: 20, color: "text.secondary" }}
                                />
                                <ListItemText primary="Technicals" />
                            </ListItemButton>
                            <ListItemButton
                                selected={builtIn === "fundamentals"}
                                onClick={() => {
                                    setBuiltIn("fundamentals");
                                }}
                                sx={{
                                    borderRadius: 1,
                                    mx: 0.5,
                                    py: 1,
                                    "&.Mui-selected": {
                                        bgcolor: "action.selected",
                                    },
                                }}
                            >
                                <BarChartIcon
                                    sx={{ mr: 1.5, fontSize: 20, color: "text.secondary" }}
                                />
                                <ListItemText primary="Fundamentals" />
                            </ListItemButton>
                        </List>
                        <Typography
                            variant="overline"
                            color="text.secondary"
                            sx={{ px: 1.5, mt: 2, display: "block", letterSpacing: 0.08 }}
                        >
                            CUSTOM
                        </Typography>
                        <List dense disablePadding sx={{ mt: 0.5 }}>
                            <ListItemButton
                                selected={builtIn === "custom"}
                                onClick={() => {
                                    setBuiltIn("custom");
                                }}
                                sx={{
                                    borderRadius: 1,
                                    mx: 0.5,
                                    py: 1,
                                    "&.Mui-selected": {
                                        bgcolor: "action.selected",
                                    },
                                }}
                            >
                                <ExtensionIcon
                                    sx={{ mr: 1.5, fontSize: 20, color: "text.secondary" }}
                                />
                                <ListItemText primary="All" />
                            </ListItemButton>
                        </List>
                    </Box>
                    <Box
                        sx={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            minWidth: 0,
                            minHeight: 0,
                            overflow: "hidden",
                            padding: '8px',
                        }}
                    >
                        {!isCustomCategory && !indicatorsOnly && (
                            <Box sx={{ px: 2, pb: 1.5, flexShrink: 0 }}>
                                <ToggleButtonGroup
                                    exclusive
                                    value={activeRightTab}
                                    onChange={(_, v: RightTab | null) => {
                                        if (v) setRightTab(v);
                                    }}
                                    sx={{
                                        gap: 1,
                                        "& .MuiToggleButtonGroup-grouped": {
                                            border: 0,
                                            borderRadius: "20px !important",
                                            px: 2,
                                            py: 0.5,
                                            textTransform: "none",
                                            fontWeight: 500,
                                            bgcolor: "action.hover",
                                            "&.Mui-selected": {
                                                bgcolor: "primary.main",
                                                color: "primary.contrastText",
                                                "&:hover": {
                                                    bgcolor: "primary.dark",
                                                },
                                            },
                                        },
                                    }}
                                >
                                    <ToggleButton value="indicators">Indicators</ToggleButton>
                                    <ToggleButton value="strategies">Strategies</ToggleButton>
                                </ToggleButtonGroup>
                            </Box>
                        )}
                        <Typography
                            variant="overline"
                            color="text.secondary"
                            sx={{ px: 2, letterSpacing: 0.08, flexShrink: 0 }}
                        >
                            SCRIPT NAME
                        </Typography>
                        {strategySelectionError && isTechnicalStrategyTab && (
                            <Typography variant="body2" color="error" sx={{ px: 2, mb: 1, flexShrink: 0 }}>
                                {strategySelectionError}
                            </Typography>
                        )}
                        <List
                            dense
                            sx={{
                                flex: 1,
                                minHeight: 0,
                                overflowY: "auto",
                                py: 0,
                            }}
                        >
                            {scripts.length === 0 ? (
                                <ListItem sx={{ display: "block", py: 4, px: 2 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {isLoadingIndicators && builtIn === "technicals" && activeRightTab === "indicators"
                                            ? "指标列表加载中..."
                                            : isLoadingStrategies && isTechnicalStrategyTab
                                            ? "策略列表加载中..."
                                            : isLoadingCustomIndicators && isCustomCategory
                                            ? "自定义指标加载中..."
                                            : isCustomCategory
                                            ? "暂无自定义指标，可在 Python Editor 中创建。"
                                            : builtIn === "fundamentals"
                                            ? "基本面脚本暂未接入，列表为空。"
                                            : "暂无脚本。"}
                                    </Typography>
                                </ListItem>
                            ) : (
                                scripts.map((script) => {
                                    const isSelected = isTechnicalStrategyTab
                                        ? chartState.selectedStrategies.includes(script.id)
                                        : chartState.selectedIndicators.includes(script.id);
                                    const isPending = pendingActionIds.has(script.id);
                                    const isCustomScript = script.id.startsWith("custom_");
                                    const descTrimmed = script.description?.trim() ?? "";
                                    return (
                                        <ListItem
                                            key={script.id}
                                            disablePadding
                                            className="indicator-script-row"
                                            sx={(theme) => ({
                                                display: "flex",
                                                flexDirection: "row",
                                                alignItems: "center",
                                                minHeight: SCRIPT_LIST_ROW_HEIGHT,
                                                height: SCRIPT_LIST_ROW_HEIGHT,
                                                pl: 0,
                                                pr: 0.5,
                                                gap: 0.5,
                                                ...(isSelected && {
                                                    bgcolor: alpha(
                                                        theme.palette.primary.main,
                                                        0.14,
                                                    ),
                                                }),
                                                "&:hover": {
                                                    bgcolor: isSelected
                                                        ? alpha(
                                                              theme.palette.primary.main,
                                                              0.22,
                                                          )
                                                        : theme.palette.action.hover,
                                                },
                                                "&.indicator-script-row:hover .indicator-row-hover-only": {
                                                    opacity: 1,
                                                    pointerEvents: "auto",
                                                },
                                                "& .indicator-script-always-visible, &.indicator-script-row:hover .indicator-script-always-visible":
                                                    {
                                                        opacity: 1,
                                                        pointerEvents: "auto",
                                                    },
                                                borderRadius: "8px",
                                            })}
                                        >
                                            <Box
                                                sx={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    pl: 2,
                                                    pr: 0.5,
                                                    height: "100%",
                                                }}
                                            >
                                                <Typography
                                                    variant="body2"
                                                    component="span"
                                                    sx={{
                                                        flex: 1,
                                                        minWidth: 0,
                                                        fontWeight: 600,
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                    }}
                                                >
                                                    {script.name}
                                                </Typography>
                                            </Box>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    flexShrink: 0,
                                                    gap: 0.5,
                                                    height: "100%",
                                                    pr: 0.25,
                                                }}
                                            >
                                                {isCustomScript && (
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        flexShrink: 0,
                                                        gap: 0.25,
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    <IconButton
                                                        className="indicator-row-hover-only"
                                                        size="small"
                                                        aria-label={`删除自定义指标 ${script.name}`}
                                                        disabled={isPending}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            void removeCustomIndicatorDefinition(script.id);
                                                        }}
                                                        sx={(t) => ({
                                                            color: "text.secondary",
                                                            opacity: 0,
                                                            pointerEvents: "none",
                                                            transition: t.transitions.create("opacity", {
                                                                duration: t.transitions.duration.shortest,
                                                            }),
                                                        })}
                                                    >
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                                )}
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        minWidth: 36,
                                                        height: 36,
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {isSelected ? (
                                                        <Box
                                                            sx={{
                                                                position: "relative",
                                                                width: 36,
                                                                height: 36,
                                                                flexShrink: 0,
                                                                "&:hover .script-row-check": {
                                                                    opacity: 0,
                                                                },
                                                                "&:hover .script-row-remove": {
                                                                    opacity: 1,
                                                                    pointerEvents: "auto",
                                                                },
                                                                borderRadius: 1,
                                                            }}
                                                        >
                                                            <Box
                                                                className="script-row-check"
                                                                sx={(t) => ({
                                                                    position: "absolute",
                                                                    inset: 0,
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    color: "primary.main",
                                                                    pointerEvents: "none",
                                                                    opacity: 1,
                                                                    transition: t.transitions.create("opacity", {
                                                                        duration: t.transitions.duration.shortest,
                                                                    }),
                                                                })}
                                                            >
                                                                <CheckIcon fontSize="small" />
                                                            </Box>
                                                            <IconButton
                                                                className="script-row-remove"
                                                                edge="end"
                                                                size="small"
                                                                aria-label={`取消选择 ${script.name}`}
                                                                disabled={isPending}
                                                                sx={(t) => ({
                                                                    position: "absolute",
                                                                    inset: 0,
                                                                    opacity: 0,
                                                                    pointerEvents: "none",
                                                                    transition: t.transitions.create("opacity", {
                                                                        duration: t.transitions.duration.shortest,
                                                                    }),
                                                                })}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    e.preventDefault();
                                                                    if (isTechnicalStrategyTab) {
                                                                        removeStrategy(script.id);
                                                                    } else {
                                                                        removeIndicator(script.id);
                                                                    }
                                                                }}
                                                            >
                                                                <DoNotDisturbIcon fontSize="small" />
                                                            </IconButton>
                                                        </Box>
                                                    ) : (
                                                        <IconButton
                                                            className="indicator-row-hover-only"
                                                            size="small"
                                                            aria-label={`添加 ${script.name}`}
                                                            disabled={isPending}
                                                            sx={(t) => ({
                                                                opacity: 0,
                                                                pointerEvents: "none",
                                                                transition: t.transitions.create("opacity", {
                                                                    duration: t.transitions.duration.shortest,
                                                                }),
                                                            })}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                if (isTechnicalStrategyTab) {
                                                                    addStrategy(script.id);
                                                                } else {
                                                                    addIndicator(script.id);
                                                                }
                                                            }}
                                                        >
                                                            <AddIcon fontSize="small" />
                                                        </IconButton>
                                                    )}
                                                </Box>
                                                {descTrimmed ? (
                                                    <IconButton
                                                        className="indicator-script-always-visible"
                                                        size="small"
                                                        aria-label={`${script.name} 说明`}
                                                        disabled={isPending}
                                                        sx={{
                                                            flexShrink: 0,
                                                            color: "text.secondary",
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            setDescriptionPopoverAnchor(e.currentTarget);
                                                            setDescriptionPopoverText(descTrimmed);
                                                        }}
                                                    >
                                                        <InfoIcon fontSize="small" />
                                                    </IconButton>
                                                ) : null}
                                            </Box>
                                        </ListItem>
                                    );
                                })
                            )}
                        </List>
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
        )}
        <Popover
            open={Boolean(descriptionPopoverAnchor)}
            anchorEl={descriptionPopoverAnchor}
            onClose={() => {
                setDescriptionPopoverAnchor(null);
                setDescriptionPopoverText("");
            }}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
            slotProps={{
                paper: {
                    sx: { maxWidth: 400, maxHeight: "min(50vh, 320px)", overflow: "auto" },
                },
            }}
        >
            <Box sx={{ p: 2 }}>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {descriptionPopoverText}
                </Typography>
            </Box>
        </Popover>
        <Dialog
            maxWidth="sm"
            fullWidth
            open={Boolean(editingMaInstance)}
            onClose={() => {
                if (!isSavingMaConfig) {
                    setEditingMaInstance(null);
                    if (configOnly) onClose(false);
                }
            }}
        >
            <DialogTitle>MA 均线设置</DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    最多显示 5 条主图均线；周期填 0 或留空表示隐藏该条均线。
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {maRows.map((row, index) => (
                        <Box
                            key={row.key}
                            sx={{
                                display: "grid",
                                gridTemplateColumns: "1fr 96px",
                                gap: 1.5,
                                alignItems: "center",
                            }}
                        >
                            <TextField
                                label={`MA${index + 1} 周期`}
                                size="small"
                                type="number"
                                value={row.period}
                                inputProps={{ min: 0, step: 1 }}
                                onChange={(event) => {
                                    updateMaRow(row.key, { period: event.target.value });
                                }}
                            />
                            <TextField
                                label="颜色"
                                size="small"
                                type="color"
                                value={row.color}
                                onChange={(event) => {
                                    updateMaRow(row.key, { color: event.target.value });
                                }}
                            />
                        </Box>
                    ))}
                </Box>
                {maConfigError && (
                    <Typography variant="body2" color="error" sx={{ mt: 2 }}>
                        {maConfigError}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={() => {
                        setEditingMaInstance(null);
                        if (configOnly) onClose(false);
                    }}
                    disabled={isSavingMaConfig}
                >
                    取消
                </Button>
                <Button
                    variant="contained"
                    onClick={saveMaConfig}
                    disabled={isSavingMaConfig}
                >
                    保存
                </Button>
            </DialogActions>
        </Dialog>
        <Dialog
            maxWidth="sm"
            fullWidth
            open={Boolean(editingInstance)}
            onClose={() => {
                if (!isSavingGenericConfig) {
                    setEditingInstance(null);
                    setEditingMeta(null);
                    if (configOnly) onClose(false);
                }
            }}
        >
            <DialogTitle>{editingMeta?.name || "指标设置"}</DialogTitle>
            <DialogContent dividers>
                {editingMeta?.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {editingMeta.description}
                    </Typography>
                )}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {paramRows.map(row => (
                        <TextField
                            key={row.key}
                            label={row.label}
                            size="small"
                            type={row.type === "int" || row.type === "float" ? "number" : "text"}
                            value={row.value}
                            inputProps={{
                                min: row.spec.minimum ?? undefined,
                                max: row.spec.maximum ?? undefined,
                                step: row.type === "int" ? 1 : "any",
                            }}
                            onChange={(event) => {
                                const value = event.target.value;
                                setParamRows(prev => prev.map(item => item.key === row.key ? { ...item, value } : item));
                            }}
                        />
                    ))}
                </Box>
                {seriesColorRows.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            线条颜色
                        </Typography>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                            {seriesColorRows.map(row => (
                                <Box
                                    key={row.key}
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 96px",
                                        gap: 1.5,
                                        alignItems: "center",
                                    }}
                                >
                                    <TextField
                                        label={row.label}
                                        size="small"
                                        value={row.key}
                                        disabled
                                    />
                                    <TextField
                                        label="颜色"
                                        size="small"
                                        type="color"
                                        value={row.color}
                                        onChange={(event) => {
                                            const color = event.target.value;
                                            setSeriesColorRows(prev => prev.map(item => item.key === row.key ? { ...item, color } : item));
                                        }}
                                    />
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}
                {genericConfigError && (
                    <Typography variant="body2" color="error" sx={{ mt: 2 }}>
                        {genericConfigError}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={() => {
                        setEditingInstance(null);
                        setEditingMeta(null);
                        if (configOnly) onClose(false);
                    }}
                    disabled={isSavingGenericConfig}
                >
                    取消
                </Button>
                <Button
                    variant="contained"
                    onClick={async () => {
                        if (!editingInstance) return;
                        const nextParams: Record<string, unknown> = {};
                        for (const row of paramRows) {
                            const raw = row.value.trim();
                            if (raw === "") continue;

                            if (row.type === "int") {
                                const n = Number(raw);
                                if (!Number.isInteger(n)) {
                                    setGenericConfigError(`${row.label} 必须是整数。`);
                                    return;
                                }
                                if (row.spec.minimum != null && n < row.spec.minimum) {
                                    setGenericConfigError(`${row.label} 不能小于 ${row.spec.minimum}。`);
                                    return;
                                }
                                if (row.spec.maximum != null && n > row.spec.maximum) {
                                    setGenericConfigError(`${row.label} 不能大于 ${row.spec.maximum}。`);
                                    return;
                                }
                                nextParams[row.key] = n;
                                continue;
                            }

                            if (row.type === "float") {
                                const n = Number(raw);
                                if (!Number.isFinite(n)) {
                                    setGenericConfigError(`${row.label} 必须是数字。`);
                                    return;
                                }
                                if (row.spec.minimum != null && n < row.spec.minimum) {
                                    setGenericConfigError(`${row.label} 不能小于 ${row.spec.minimum}。`);
                                    return;
                                }
                                if (row.spec.maximum != null && n > row.spec.maximum) {
                                    setGenericConfigError(`${row.label} 不能大于 ${row.spec.maximum}。`);
                                    return;
                                }
                                nextParams[row.key] = n;
                                continue;
                            }

                            nextParams[row.key] = raw;
                        }

                        const fast = nextParams.fast ?? editingInstance.params?.fast;
                        const slow = nextParams.slow ?? editingInstance.params?.slow;
                        if (
                            (editingInstance.indicator_id === "macd" || editingInstance.indicator_id === "wr")
                            && fast != null
                            && slow != null
                        ) {
                            const fastN = typeof fast === "number" ? fast : Number(fast);
                            const slowN = typeof slow === "number" ? slow : Number(slow);
                            if (Number.isFinite(fastN) && Number.isFinite(slowN) && fastN >= slowN) {
                                setGenericConfigError("快线周期必须小于慢线周期。");
                                return;
                            }
                        }

                        const seriesColorMap = seriesColorRows.reduce<Record<string, string>>((acc, row) => {
                            acc[row.key] = row.color;
                            return acc;
                        }, {});
                        const nextSeries: ChartIndicatorSeriesSpec[] = (editingInstance.series || []).map(series => ({
                            ...series,
                            color: seriesColorMap[series.key] ?? series.color,
                        }));

                        setIsSavingGenericConfig(true);
                        setGenericConfigError("");
                        try {
                            const nextLayout = await updateChartLayoutIndicator(editingInstance.instance_id, {
                                params: nextParams,
                                series: nextSeries,
                            });
                            if (nextLayout) {
                                syncChartLayout(nextLayout);
                                setEditingInstance(null);
                                setEditingMeta(null);
                                if (configOnly) onClose(true);
                            }
                        } finally {
                            setIsSavingGenericConfig(false);
                        }
                    }}
                    disabled={isSavingGenericConfig}
                >
                    保存
                </Button>
            </DialogActions>
        </Dialog>
        </>
    );
};

export default IndicatorSelectDialog;
