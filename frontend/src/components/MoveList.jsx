// Нотация партии. Ходы можно пометить классом (цветная точка) и сделать кликабельными.
import { useEffect, useRef } from 'react'
import { CLASSES } from '../lib/chessUtil.js'

/**
 * props:
 *  sans     — массив ходов в SAN
 *  current  — индекс выделенного полухода (0 = первый ход), -1 — начало
 *  classes  — необязательный массив классов ходов (ключи CLASSES)
 *  onSelect — (index) => void
 *  hiddenFrom — с какого индекса скрывать ходы (режим «Угадай ход»)
 */
export default function MoveList({ sans, current = -1, classes, onSelect, hiddenFrom, maxHeight = 220 }) {
  const activeRef = useRef(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [current, sans.length])

  const rows = []
  for (let i = 0; i < sans.length; i += 2) rows.push(i)

  const cell = (i) => {
    if (i >= sans.length) return <span />
    const hidden = hiddenFrom !== undefined && i >= hiddenFrom
    const cls = classes?.[i]
    const active = i === current
    return (
      <button
        type="button"
        ref={active ? activeRef : null}
        disabled={!onSelect || hidden}
        onClick={() => onSelect?.(i)}
        className={`text-left px-1.5 py-0.5 rounded font-medium ${active ? 'bg-accent text-neutral-900' : onSelect ? 'hover:bg-white/10' : ''}`}
      >
        {cls && <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: CLASSES[cls].color }} title={CLASSES[cls].label} />}
        {hidden ? '···' : sans[i]}
      </button>
    )
  }

  return (
    <div className="overflow-y-auto text-sm tabular-nums pr-1" style={{ maxHeight }}>
      {rows.length === 0 && <div className="text-neutral-500 text-sm">Ходов пока нет.</div>}
      <div className="grid grid-cols-[2.2rem_1fr_1fr] gap-x-1 gap-y-0.5">
        {rows.map((i) => (
          <div key={i} className="contents">
            <span className="text-neutral-500 py-0.5">{i / 2 + 1}.</span>
            {cell(i)}
            {cell(i + 1)}
          </div>
        ))}
      </div>
    </div>
  )
}
