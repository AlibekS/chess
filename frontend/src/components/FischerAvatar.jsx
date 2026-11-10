// Векторный 2D-аватар тренера: Фишер образца 1972 года.
// Вытянутое скуластое лицо, тяжёлые брови, взгляд исподлобья, зачёс набок,
// чёрный костюм с узким галстуком, свет прожектора за спиной.
//
// Состояния (проп mood):
//   idle      — дыхание, моргание, тяжёлый взгляд на доску, лёгкая усмешка
//   talking   — двигается рот, рука жестикулирует
//   pleased   — уверенная улыбка и кивок
//   skeptical — вздёрнутая бровь, сжатые губы, покачивание головой
//   thinking  — кулак у подбородка, взгляд в сторону
// Анимации — CSS keyframes в index.css (классы av-*).

const SKIN = '#e9bd9c'
const SKIN_LIGHT = '#f6d3b6'
const SKIN_SHADE = '#c08e6f'
const SKIN_DEEP = '#9c6c52'
const HAIR = '#3a281c'
const HAIR_LIGHT = '#6a4a33'
const SUIT = '#15181d'
const SUIT_LIGHT = '#262b33'
const SHIRT = '#f4f2ec'
const TIE = '#0d0f12'

const FACE = 'M84 92 C82 46 158 46 156 92 L155 122 C154 136 149 150 141 162 C135 171 128 177 120 177 C112 177 105 171 99 162 C91 150 86 136 85 122 Z'

function Mouth({ mood }) {
  if (mood === 'talking') {
    return (
      <g className="av-talk-mouth">
        <path d="M109 152 Q120 147 131 152 Q120 163 109 152 Z" fill="#4a1a1a" />
        <path d="M112 151.5 Q120 149 128 151.5 L127 153.5 Q120 152 113 153.5 Z" fill="#f4f2ec" />
      </g>
    )
  }
  if (mood === 'pleased') {
    return (
      <g>
        <path d="M106 150 Q120 162 136 147" fill="none" stroke="#7a3d30" strokeWidth="3" strokeLinecap="round" />
        <path d="M136 147 q3 -1 4 -4" fill="none" stroke={SKIN_SHADE} strokeWidth="2" strokeLinecap="round" />
      </g>
    )
  }
  const d = {
    skeptical: 'M108 154 Q118 150 133 153',
    thinking: 'M110 153 Q120 151 130 153',
    // idle: едва заметная усмешка одним уголком рта
    idle: 'M108 153 Q121 156 133 150',
  }[mood] || 'M108 153 Q121 156 133 150'
  return (
    <g>
      <path d={d} fill="none" stroke="#7a3d30" strokeWidth="3" strokeLinecap="round" />
      <path d="M113 160 Q120 162 127 160" fill="none" stroke={SKIN_SHADE} strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
    </g>
  )
}

/** Один глаз: глубоко посаженный, с тяжёлым верхним веком. */
function Eye({ cx, gaze, open }) {
  return (
    <g>
      {/* тень глазницы */}
      <ellipse cx={cx} cy="112" rx="11.5" ry="7.5" fill={SKIN_SHADE} opacity=".55" />
      <path d={`M${cx - 9} 113 Q${cx} ${113 - open * 2} ${cx + 9} 113 Q${cx} ${113 + open * 1.5} ${cx - 9} 113 Z`} fill="#fbfaf6" />
      <g style={{ transform: `translate(${gaze.x}px, ${gaze.y}px)`, transition: 'transform .3s' }}>
        <circle cx={cx} cy="113" r="3.6" fill="#2a3b3f" />
        <circle cx={cx} cy="113" r="1.7" fill="#0b0d0e" />
        <circle cx={cx + 1.2} cy="111.8" r="1" fill="#fff" />
      </g>
      {/* тяжёлое верхнее веко срезает зрачок — взгляд исподлобья */}
      <path d={`M${cx - 10} 113 Q${cx} ${113 - open * 2 - 1} ${cx + 10} 113 L${cx + 10} 107 L${cx - 10} 107 Z`} fill={SKIN_SHADE} />
      <path d={`M${cx - 10} 113 Q${cx} ${113 - open * 2 - 1} ${cx + 10} 113`} fill="none" stroke="#2b1b12" strokeWidth="2.2" strokeLinecap="round" />
      <path d={`M${cx - 7} 117.5 Q${cx} 119.5 ${cx + 7} 117.5`} fill="none" stroke={SKIN_DEEP} strokeWidth="1" opacity=".6" />
    </g>
  )
}

export default function FischerAvatar({ mood = 'idle', size = 150 }) {
  const headClass = mood === 'pleased' ? 'av-nod' : mood === 'skeptical' ? 'av-shake' : ''
  const gaze = mood === 'thinking' ? { x: 2.4, y: -0.6 } : mood === 'talking' ? { x: 0, y: 0.4 } : { x: -1.6, y: 0.8 }
  // Насколько открыты глаза: прищур в покое, шире в разговоре
  const open = mood === 'talking' ? 3.4 : mood === 'pleased' ? 2.4 : mood === 'skeptical' ? 2.2 : 2.8
  const leftBrow = mood === 'skeptical' ? 'translate(0,-7) rotate(-10 104 100)' : mood === 'pleased' ? 'translate(0,-2)' : mood === 'talking' ? 'translate(0,-1.5)' : ''
  const rightBrow = mood === 'skeptical' ? 'translate(0,1.5) rotate(5 136 100)' : mood === 'pleased' ? 'translate(0,-2)' : mood === 'talking' ? 'translate(0,-1.5)' : ''

  return (
    <svg viewBox="0 0 240 260" width={size} height={(size * 260) / 240} role="img" aria-label={`Тренер Бобби Фишер: ${mood}`}>
      <defs>
        <linearGradient id="av-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141713" />
          <stop offset="1" stopColor="#0a0b0a" />
        </linearGradient>
        <radialGradient id="av-aura" cx="50%" cy="38%" r="62%">
          <stop offset="0" stopColor="#b9e27c" stopOpacity=".55" />
          <stop offset=".45" stopColor="#81b64c" stopOpacity=".22" />
          <stop offset="1" stopColor="#81b64c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="av-suit" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={SUIT_LIGHT} />
          <stop offset=".55" stopColor={SUIT} />
          <stop offset="1" stopColor="#0c0e11" />
        </linearGradient>
        <linearGradient id="av-hair" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={HAIR_LIGHT} />
          <stop offset=".6" stopColor={HAIR} />
          <stop offset="1" stopColor="#22160e" />
        </linearGradient>
        <clipPath id="av-clip"><rect x="0" y="0" width="240" height="260" rx="24" /></clipPath>
        <clipPath id="av-face"><path d={FACE} /></clipPath>
      </defs>
      <g clipPath="url(#av-clip)">
        <rect width="240" height="260" fill="url(#av-bg)" />
        {/* Клетки доски на заднем плане и «аура» — свет прожектора за спиной */}
        <g opacity=".05" fill="#fff">
          {[0, 1, 2, 3, 4, 5, 6, 7].flatMap((r) => [0, 1, 2, 3, 4, 5, 6, 7].filter((c) => (r + c) % 2 === 0).map((c) => (
            <rect key={`${r}-${c}`} x={c * 30} y={r * 32.5} width="30" height="32.5" />
          )))}
        </g>
        <rect className="av-aura" width="240" height="260" fill="url(#av-aura)" />

        <g className="av-breathe">
          {/* Чёрный костюм, широкие плечи */}
          <path d="M18 262 C20 214 58 198 102 188 L120 204 L138 188 C182 198 220 214 222 262 Z" fill="url(#av-suit)" />
          {/* Рубашка, узкий чёрный галстук */}
          <path d="M103 188 L120 232 L137 188 L129 179 L111 179 Z" fill={SHIRT} />
          <path d="M103 188 L120 232 L112 205 Z" fill="#d9d5cb" />
          <path d="M116 193 L124 193 L122.5 201 L117.5 201 Z" fill={TIE} />
          <path d="M117.5 201 L122.5 201 L125 246 L120 256 L115 246 Z" fill={TIE} />
          <path d="M102 189 L111 178 L120 194 L109 204 Z" fill="#ffffff" />
          <path d="M138 189 L129 178 L120 194 L131 204 Z" fill="#e9e6de" />
          {/* Лацканы */}
          <path d="M102 189 L120 234 L96 262 L66 262 L82 199 Z" fill={SUIT_LIGHT} />
          <path d="M138 189 L120 234 L144 262 L174 262 L158 199 Z" fill="#1c2027" />
          <path d="M82 199 L92 226 L102 189 Z" fill="#30363f" />
          {/* Шея */}
          <path d="M104 160 L136 160 L138 189 L120 204 L102 189 Z" fill={SKIN_SHADE} />
          <path d="M104 166 Q120 186 136 166 L136 160 L104 160 Z" fill={SKIN_DEEP} opacity=".75" />

          {/* Голова: чуть наклонена, подбородок вниз */}
          <g className={headClass} style={{ transformOrigin: '120px 176px' }}>
            <g transform="rotate(-2.5 120 176)">
              <path d="M86 104 q-7 2 -6 13 q1 11 8 13 Z" fill={SKIN_SHADE} />
              <path d="M154 104 q7 2 6 13 q-1 11 -8 13 Z" fill={SKIN_DEEP} />
              <path d={FACE} fill={SKIN} />
              <g clipPath="url(#av-face)">
                {/* Свет слева, тень справа — драматичное освещение */}
                <path d="M84 60 L112 60 L104 120 L100 170 L84 170 Z" fill={SKIN_LIGHT} opacity=".55" />
                <path d="M128 60 L160 60 L160 180 L124 180 L138 150 L140 118 Z" fill={SKIN_SHADE} opacity=".6" />
                {/* Скулы и тень под ними */}
                <path d="M86 130 Q96 142 104 162 L96 166 L84 140 Z" fill={SKIN_SHADE} opacity=".5" />
                <path d="M154 130 Q146 142 138 162 L146 168 L158 140 Z" fill={SKIN_DEEP} opacity=".5" />
              </g>
              {/* Квадратный подбородок с ямочкой */}
              <path d="M108 172 Q120 179 132 172" fill="none" stroke={SKIN_DEEP} strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
              <path d="M120 168 v5" stroke={SKIN_DEEP} strokeWidth="1.4" strokeLinecap="round" opacity=".6" />

              {/* Причёска: объёмный зачёс набок, выбритые виски */}
              <path d="M84 110 C82 100 82 90 85 82 L92 82 L90 108 Z" fill={HAIR} />
              <path d="M156 110 C158 100 158 90 155 82 L148 82 L150 108 Z" fill="#22160e" />
              <path d="M82 94 C72 60 96 30 132 32 C160 34 170 58 158 94 C156 82 150 74 142 70 C126 80 104 76 94 68 C88 74 84 84 82 94 Z" fill="url(#av-hair)" />
              <path d="M94 68 C104 50 126 42 150 50" fill="none" stroke={HAIR_LIGHT} strokeWidth="2.2" strokeLinecap="round" opacity=".8" />
              <path d="M100 62 C112 50 130 46 146 56" fill="none" stroke="#22160e" strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
              <path d="M88 76 C94 58 108 44 126 40" fill="none" stroke={HAIR_LIGHT} strokeWidth="1.6" strokeLinecap="round" opacity=".6" />

              {/* Глаза */}
              <g className="av-blink" style={{ transformOrigin: '120px 113px' }}>
                <Eye cx={104} gaze={gaze} open={open} />
                <Eye cx={136} gaze={gaze} open={open} />
              </g>

              {/* Тяжёлые брови, сведённые к переносице */}
              <path d="M91 103 L103 99 L116 104 L115 108 L103 104.5 L92 107 Z" fill={HAIR} transform={leftBrow} style={{ transition: 'transform .25s' }} />
              <path d="M149 103 L137 99 L124 104 L125 108 L137 104.5 L148 107 Z" fill="#2b1b12" transform={rightBrow} style={{ transition: 'transform .25s' }} />
              <path d="M118 100 v6 M122 100 v6" stroke={SKIN_DEEP} strokeWidth="1.2" strokeLinecap="round" opacity=".6" />

              {/* Длинный нос с тенью */}
              <path d="M121 108 L125 138 L119 142 L116 139 Z" fill={SKIN_SHADE} opacity=".75" />
              <path d="M119 108 L113 137 Q115 143 121 143 Q127 143 128 138" fill="none" stroke={SKIN_DEEP} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <Mouth mood={mood} />
            </g>
          </g>

          {/* Рука: кулак у подбородка (thinking) */}
          {mood === 'thinking' && (
            <g>
              <path d="M222 262 L176 204 L150 214 L180 262 Z" fill={SUIT_LIGHT} />
              <path d="M176 204 L168 192 L144 202 L150 214 Z" fill={SHIRT} />
              <path d="M126 176 q2 -10 14 -9 l14 2 q8 2 7 12 l-2 12 q-3 8 -13 7 l-12 -2 q-10 -3 -8 -22 Z" fill={SKIN} stroke={SKIN_DEEP} strokeWidth="1.5" />
              <path d="M133 172 v12 M141 171 v13 M149 172 v13" stroke={SKIN_DEEP} strokeWidth="1.3" strokeLinecap="round" opacity=".7" />
            </g>
          )}

          {/* Рука: рубящий жест во время речи (talking) */}
          {mood === 'talking' && (
            <g className="av-gesture" style={{ transformOrigin: '204px 256px' }}>
              <path d="M232 262 L210 216 L186 224 L194 262 Z" fill={SUIT_LIGHT} />
              <path d="M210 216 L206 205 L183 213 L186 224 Z" fill={SHIRT} />
              <path d="M182 213 L176 186 q0 -6 6 -6 l14 -2 q7 0 8 7 l2 20 Z" fill={SKIN} stroke={SKIN_DEEP} strokeWidth="1.5" />
              <path d="M204 190 q8 -4 9 4 l-5 10" fill={SKIN} stroke={SKIN_DEEP} strokeWidth="1.5" />
              <path d="M184 186 v14 M191 184 v15 M198 184 v15" stroke={SKIN_DEEP} strokeWidth="1.2" strokeLinecap="round" opacity=".6" />
            </g>
          )}
        </g>
        {/* Акцентная рамка */}
        <rect x="1.5" y="1.5" width="237" height="257" rx="23" fill="none" stroke="#81b64c" strokeOpacity=".45" strokeWidth="3" />
      </g>
    </svg>
  )
}
