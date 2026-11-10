// Карточка исторического факта. Текст приходит с бэкенда и собран только
// из записей базы партий Фишера — фронтенд ничего не «досочиняет».
import { BookOpen } from 'lucide-react'

export default function InsightCard({ insight, text }) {
  if (!insight || insight.match === 'none') return null
  const body = text || insight.message
  return (
    <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
      <div className="flex items-center gap-1.5 text-accent font-semibold text-xs uppercase tracking-wide mb-1">
        <BookOpen size={14} />
        {insight.match === 'exact' ? 'Из партий Фишера: точное совпадение' : 'Из партий Фишера: та же пешечная структура'}
      </div>
      <p className="text-neutral-200 leading-snug">{body}</p>
      {insight.score && insight.total_games > 1 && (
        <p className="text-neutral-400 text-xs mt-1.5">
          Партий в базе: {insight.total_games} · результат Фишера: +{insight.score.wins} ={insight.score.draws} −{insight.score.losses}
          {insight.score.score_pct !== null && ` (${insight.score.score_pct}% очков)`}
        </p>
      )}
    </div>
  )
}
