// Главный экран: профиль, индивидуальный план тренировок, настройки.
import { useState } from 'react'
import { ArrowRight, RefreshCw, Save } from 'lucide-react'
import Coach, { useCoach } from '../components/Coach.jsx'
import { Panel } from '../components/Layout.jsx'
import { api } from '../api.js'

export default function Home({ profile, health, onProfile, onNavigate }) {
  const coach = useCoach(
    profile.calibrated
      ? `Твой рейтинг — ${profile.estimated_rating}. План ниже. Работай каждый день — талант без труда ничего не стоит.`
      : 'Сначала я должен понять, как ты играешь. Пройди калибровку.',
  )
  const [name, setName] = useState(profile.username)
  const [confirmReset, setConfirmReset] = useState(false)

  const stat = (value, label) => (
    <div className="bg-panel rounded-xl p-3 text-center">
      <div className="text-2xl font-bold text-accent">{value}</div>
      <div className="text-xs text-neutral-400">{label}</div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4">
      <Panel><Coach coach={coach} /></Panel>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {stat(profile.estimated_rating, 'рейтинг')}
        {stat(profile.games_played, 'партий сыграно')}
        {stat(profile.tactics_solved, 'задач решено')}
        {stat(`${Math.round(profile.fischer_repertoire_progress * 100)}%`, 'репертуар Фишера')}
        {stat(profile.guess_points, 'очков «Угадай ход»')}
      </div>

      {!profile.calibrated ? (
        <button type="button" className="btn btn-primary text-base py-3" onClick={() => onNavigate('calibration')}>
          Пройти калибровку <ArrowRight size={18} />
        </button>
      ) : (
        <Panel title="Индивидуальный план тренировок">
          <div className="flex flex-col gap-2">
            {(profile.training_plan || []).map((item, i) => (
              <button key={i} type="button" onClick={() => onNavigate(item.mode)}
                className="text-left bg-bg hover:bg-panel-2 rounded-lg p-3 flex gap-3 items-start transition-colors cursor-pointer">
                <span className="w-7 h-7 shrink-0 rounded-full bg-accent text-neutral-900 font-bold flex items-center justify-center">{i + 1}</span>
                <span className="flex-1">
                  <span className="font-semibold block">{item.title}</span>
                  <span className="text-sm text-neutral-300">{item.text}</span>
                </span>
                <ArrowRight size={18} className="text-neutral-500 mt-1" />
              </button>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Настройки профиля">
        <div className="flex gap-2 flex-wrap items-center">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Имя игрока"
            className="bg-bg rounded-lg px-3 py-2 text-sm border border-white/10 focus:border-accent outline-none flex-1 min-w-40" />
          <button type="button" className="btn" disabled={!name.trim() || name === profile.username}
            onClick={() => api.updateProfile(name.trim()).then(onProfile)}>
            <Save size={15} /> Сохранить имя
          </button>
          {!confirmReset ? (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmReset(true)}>
              <RefreshCw size={15} /> Сбросить профиль
            </button>
          ) : (
            <span className="flex items-center gap-2 text-sm">
              Удалить рейтинг, историю и прогресс?
              <button type="button" className="btn btn-danger" onClick={() => api.resetProfile().then((p) => { onProfile(p); setConfirmReset(false); onNavigate('calibration') })}>Да, сбросить</button>
              <button type="button" className="btn" onClick={() => setConfirmReset(false)}>Отмена</button>
            </span>
          )}
        </div>
        {health && (
          <p className="text-xs text-neutral-500 mt-3">
            База: {health.fischer_games} партий Фишера, {health.fischer_positions.toLocaleString('ru-RU')} проиндексированных позиций, {health.puzzles} задач Lichess.
          </p>
        )}
      </Panel>
    </div>
  )
}
