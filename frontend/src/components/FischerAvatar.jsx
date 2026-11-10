// Векторный 2D-аватар тренера: молодой Фишер начала 1970-х
// (строгий костюм, короткая стрижка с пробором, внимательный взгляд).
//
// Состояния (проп mood):
//   idle      — дыхание, моргание, взгляд на доску
//   talking   — двигается рот, рука жестикулирует
//   pleased   — улыбка и кивок
//   skeptical — приподнятая бровь, покачивание головой
//   thinking  — рука подпирает подбородок, взгляд вверх
// Анимации — CSS keyframes в index.css (классы av-*).

const SKIN = '#efc3a2'
const SKIN_SHADE = '#d9a585'
const HAIR = '#4b3525'
const SUIT = '#2a323d'
const SUIT_LIGHT = '#3a4654'
const SHIRT = '#f2f0ea'
const TIE = '#7b2d2d'

function Mouth({ mood }) {
  if (mood === 'talking') {
    return <ellipse className="av-talk-mouth" cx="120" cy="149" rx="8" ry="4" fill="#6d2626" stroke="#5a2020" strokeWidth="1" />
  }
  const d = {
    pleased: 'M106 145 Q120 159 134 145',
    skeptical: 'M108 151 L132 146',
    thinking: 'M112 149 Q120 146 128 149',
    idle: 'M108 148 Q120 151 132 148',
  }[mood] || 'M108 148 Q120 151 132 148'
  return <path d={d} fill="none" stroke="#8a4a3c" strokeWidth="3" strokeLinecap="round" />
}

export default function FischerAvatar({ mood = 'idle', size = 150 }) {
  const headClass = mood === 'pleased' ? 'av-nod' : mood === 'skeptical' ? 'av-shake' : ''
  // Куда смотрят зрачки: на доску (влево-вниз), при раздумье — вверх
  const gaze = mood === 'thinking' ? { x: 1.5, y: -2 } : mood === 'talking' ? { x: 0, y: 0 } : { x: -1.8, y: 1 }
  const leftBrow = mood === 'skeptical' ? 'translate(0,-6) rotate(-8 104 98)' : mood === 'pleased' ? 'translate(0,-2)' : ''
  const rightBrow = mood === 'skeptical' ? 'translate(0,2) rotate(6 136 98)' : mood === 'pleased' ? 'translate(0,-2)' : ''

  return (
    <svg viewBox="0 0 240 260" width={size} height={(size * 260) / 240} role="img" aria-label={`Тренер Бобби Фишер: ${mood}`}>
      <defs>
        <linearGradient id="av-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d4a35" />
          <stop offset="1" stopColor="#262b22" />
        </linearGradient>
        <clipPath id="av-clip"><rect x="0" y="0" width="240" height="260" rx="24" /></clipPath>
      </defs>
      <g clipPath="url(#av-clip)">
        <rect width="240" height="260" fill="url(#av-bg)" />

        <g className="av-breathe">
          {/* Костюм */}
          <path d="M34 262 C34 212 68 194 104 186 L120 200 L136 186 C172 194 206 212 206 262 Z" fill={SUIT} />
          {/* Рубашка и галстук */}
          <path d="M104 186 L120 226 L136 186 L128 178 L112 178 Z" fill={SHIRT} />
          <path d="M115 190 L125 190 L123 199 L117 199 Z" fill={TIE} />
          <path d="M117 199 L123 199 L126 244 L120 254 L114 244 Z" fill={TIE} />
          {/* Воротник */}
          <path d="M103 187 L112 177 L120 191 L110 201 Z" fill="#ffffff" />
          <path d="M137 187 L128 177 L120 191 L130 201 Z" fill="#ffffff" />
          {/* Лацканы */}
          <path d="M103 187 L120 228 L98 262 L74 262 L86 196 Z" fill={SUIT_LIGHT} />
          <path d="M137 187 L120 228 L142 262 L166 262 L154 196 Z" fill={SUIT_LIGHT} />
          {/* Шея */}
          <path d="M105 158 L135 158 L136 186 L120 200 L104 186 Z" fill={SKIN_SHADE} />

          {/* Голова */}
          <g className={headClass} style={{ transformOrigin: '120px 172px' }}>
            <ellipse cx="83" cy="113" rx="6.5" ry="11" fill={SKIN_SHADE} />
            <ellipse cx="157" cy="113" rx="6.5" ry="11" fill={SKIN_SHADE} />
            <path d="M84 98 C84 60 156 60 156 98 L154 128 C152 153 137 172 120 172 C103 172 88 153 86 128 Z" fill={SKIN} />
            {/* Причёска: короткая, с пробором и чубом */}
            <path d="M80 106 C74 66 98 38 128 40 C154 41 168 62 160 106 C158 92 153 80 146 74 C130 82 106 80 96 70 C88 80 84 92 80 106 Z" fill={HAIR} />
            <path d="M96 70 C104 58 122 52 140 56" fill="none" stroke="#3a281b" strokeWidth="2" strokeLinecap="round" />

            {/* Брови */}
            <path d="M93 101 Q104 94 115 100" fill="none" stroke={HAIR} strokeWidth="4.5" strokeLinecap="round" transform={leftBrow} style={{ transition: 'transform .25s' }} />
            <path d="M125 100 Q136 94 147 101" fill="none" stroke={HAIR} strokeWidth="4.5" strokeLinecap="round" transform={rightBrow} style={{ transition: 'transform .25s' }} />

            {/* Глаза */}
            <g className="av-blink" style={{ transformOrigin: '120px 111px' }}>
              <ellipse cx="104" cy="111" rx="8" ry={mood === 'pleased' ? 4 : 5} fill="#fff" />
              <ellipse cx="136" cy="111" rx="8" ry={mood === 'pleased' ? 4 : 5} fill="#fff" />
              <g style={{ transform: `translate(${gaze.x}px, ${gaze.y}px)`, transition: 'transform .3s' }}>
                <circle cx="104" cy="111" r="3.8" fill="#3b2a1e" />
                <circle cx="136" cy="111" r="3.8" fill="#3b2a1e" />
                <circle cx="105.2" cy="109.8" r="1.1" fill="#fff" />
                <circle cx="137.2" cy="109.8" r="1.1" fill="#fff" />
              </g>
              <path d="M95 108 Q104 102 113 108" fill="none" stroke="#5c4030" strokeWidth="1.6" />
              <path d="M127 108 Q136 102 145 108" fill="none" stroke="#5c4030" strokeWidth="1.6" />
            </g>

            {/* Нос */}
            <path d="M121 108 L115 133 Q120 138 126 133" fill="none" stroke={SKIN_SHADE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <Mouth mood={mood} />
          </g>

          {/* Рука: подпирает подбородок (thinking) */}
          {mood === 'thinking' && (
            <g>
              <path d="M214 262 L168 196 L146 208 L176 262 Z" fill={SUIT_LIGHT} />
              <path d="M168 196 L160 186 L140 198 L146 208 Z" fill={SHIRT} />
              <rect x="124" y="164" width="34" height="26" rx="11" fill={SKIN} stroke={SKIN_SHADE} strokeWidth="1.5" />
              <path d="M132 166 L130 150 Q134 146 138 150 L140 166" fill={SKIN} stroke={SKIN_SHADE} strokeWidth="1.5" />
            </g>
          )}

          {/* Рука: жест во время речи (talking) */}
          {mood === 'talking' && (
            <g className="av-gesture" style={{ transformOrigin: '200px 250px' }}>
              <path d="M226 262 L204 214 L182 222 L190 262 Z" fill={SUIT_LIGHT} />
              <path d="M204 214 L200 204 L180 212 L182 222 Z" fill={SHIRT} />
              <path d="M178 212 C170 196 176 180 188 180 C200 180 206 194 202 206 Z" fill={SKIN} stroke={SKIN_SHADE} strokeWidth="1.5" />
              <path d="M182 184 L180 170 M188 181 L188 166 M194 183 L197 169" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
            </g>
          )}
        </g>
      </g>
    </svg>
  )
}
