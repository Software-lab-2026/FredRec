import { FORMAT_LABELS, type ProgressStatus, type WorkspaceItem } from '../types/resource'

const STATUS_LABELS: Record<ProgressStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
}

interface Props {
  item: WorkspaceItem
  onProgress: (status: ProgressStatus, percent: number) => void
  onRemove?: () => void
}

export default function WorkspaceItemRow({ item, onProgress, onRemove }: Props) {
  const { resource, status, percent } = item

  function setPercent(p: number) {
    onProgress(p === 0 ? 'not_started' : p === 100 ? 'completed' : 'in_progress', p)
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="text-xs text-ink-500">{FORMAT_LABELS[resource.format]} · {resource.source}</p>
        <a href={resource.url} target="_blank" rel="noreferrer" className="font-medium hover:text-brand-600 dark:hover:text-brand-400">
          {resource.title}
        </a>
        <div className="mt-2 h-2 w-full max-w-sm rounded-full bg-ink-100 dark:bg-ink-800">
          <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-600 dark:text-ink-400">
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            aria-label="Progress"
          />
          <span className="w-24">{STATUS_LABELS[status]} {percent > 0 && percent < 100 ? `${percent}%` : ''}</span>
        </label>
        {onRemove && (
          <button onClick={onRemove} className="text-sm text-rose-600 dark:text-rose-400 hover:underline">
            Remove
          </button>
        )}
      </div>
    </li>
  )
}
