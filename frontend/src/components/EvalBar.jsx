// Вертикальная шкала преимущества (как в Chess.com): белая часть — шансы белых.
import { formatEval, winPercent } from '../lib/chessUtil.js'

export default function EvalBar({ cp = 0, mate, orientation = 'w' }) {
  const white = winPercent(cp)
  const label = formatEval(cp, mate)
  const whiteOnBottom = orientation === 'w'
  const whiteAhead = cp >= 0
  return (
    <div className="relative w-6 shrink-0 rounded overflow-hidden bg-[#403d39] self-stretch" title={`Оценка: ${label}`}>
      <div
        className="absolute left-0 right-0 bg-neutral-100 transition-all duration-500"
        style={whiteOnBottom ? { bottom: 0, height: `${white}%` } : { top: 0, height: `${white}%` }}
      />
      <div
        className={`absolute left-0 right-0 text-center text-[10px] font-bold ${whiteAhead ? 'text-neutral-800' : 'text-neutral-100'}`}
        style={whiteAhead === whiteOnBottom ? { bottom: 4 } : { top: 4 }}
      >
        {label.replace(/^[+−]/, '')}
      </div>
    </div>
  )
}
