// Общая компоновка режима: доска в центре (~65 % ширины), справа — панель тренера.
export default function ModeLayout({ board, side, below }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,65fr)_minmax(320px,35fr)] items-start">
      <div className="min-w-0">
        <div className="mx-auto w-full" style={{ maxWidth: 'min(100%, calc(100vh - 7rem))' }}>{board}</div>
        {below && <div className="mt-3">{below}</div>}
      </div>
      <aside className="flex flex-col gap-3 min-w-0">{side}</aside>
    </div>
  )
}

/** Карточка-панель в правой колонке. */
export function Panel({ title, children, className = '' }) {
  return (
    <section className={`bg-panel rounded-xl p-3.5 ${className}`}>
      {title && <h3 className="text-xs uppercase tracking-wide text-neutral-400 font-semibold mb-2">{title}</h3>}
      {children}
    </section>
  )
}
