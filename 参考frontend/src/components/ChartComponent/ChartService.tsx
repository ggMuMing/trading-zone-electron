import { useRef } from 'react';
import Paper, { type PaperProps } from '@mui/material/Paper';
import Draggable from 'react-draggable';
async function findTargetPaneTd(chartContainer: HTMLElement | null, paneIndex: number) {
    if (!chartContainer) return null
    for (let attempt = 0; attempt < 12; attempt += 1) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
        const paneTable = chartContainer.querySelector('table')
        const rows = paneTable?.querySelectorAll('tr')
        if (!rows || rows.length <= paneIndex * 2) continue
        const targetRow = rows[paneIndex * 2]
        const targetChartTd = targetRow?.getElementsByTagName('td')[1]
        if (targetChartTd) return targetChartTd
    }
    return null
}

function DialogPaperComponent(props: PaperProps) {
    const nodeRef = useRef<HTMLDivElement>(null);
    return (
        <Draggable
            nodeRef={nodeRef}
            handle="#draggable-dialog-title"
            cancel={'[class*="MuiDialogContent-root"]'}
        >
            <Paper {...props} ref={nodeRef} />
        </Draggable>
    )
}

export {
    findTargetPaneTd,
    DialogPaperComponent
}