// Озвучка реплик тренера через браузерный Web Speech API (русский голос).

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

function russianVoice() {
  const voices = window.speechSynthesis.getVoices()
  // Предпочитаем мужской голос, если браузер его различает по имени
  return (
    voices.find((v) => v.lang?.startsWith('ru') && /pavel|dmitr|yuri|male|максим|павел/i.test(v.name)) ||
    voices.find((v) => v.lang?.startsWith('ru')) ||
    null
  )
}

export function speak(text) {
  if (!speechSupported() || !text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ru-RU'
  const voice = russianVoice()
  if (voice) u.voice = voice
  u.rate = 1.05
  u.pitch = 0.85
  window.speechSynthesis.speak(u)
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel()
}
