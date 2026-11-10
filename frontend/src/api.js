// Тонкая обёртка над REST API бэкенда (FastAPI).
async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    let detail = res.statusText
    try { detail = (await res.json()).detail || detail } catch { /* не JSON */ }
    throw new Error(detail)
  }
  return res.json()
}

export const api = {
  health: () => request('/health'),
  profile: () => request('/profile'),
  updateProfile: (username) => request('/profile', { method: 'PUT', body: { username } }),
  resetProfile: () => request('/profile/reset', { method: 'POST' }),
  calibrate: (body) => request('/calibration', { method: 'POST', body }),

  // Исторический инсайт: была ли позиция в партиях Фишера
  positionCheck: (fen) => request('/position-check', { method: 'POST', body: { fen } }),

  nextPuzzle: (rating, exclude = [], theme = '') =>
    request(`/puzzles/next?rating=${Math.round(rating)}&exclude=${exclude.join(',')}&theme=${theme}`),
  puzzleResult: (puzzle_id, solved, rated = true) =>
    request('/puzzles/result', { method: 'POST', body: { puzzle_id, solved, rated } }),

  repertoire: () => request('/repertoire'),
  repertoireAttempt: (id, errors, with_hints) =>
    request(`/repertoire/${id}/attempt`, { method: 'POST', body: { errors, with_hints } }),

  guessGames: () => request('/guess/games'),
  guessGame: (id) => request(`/guess/games/${id}`),
  guessScore: (points) => request('/guess/score', { method: 'POST', body: { points } }),

  games: () => request('/games'),
  game: (id) => request(`/games/${id}`),
  saveGame: (body) => request('/games', { method: 'POST', body }),
  patchGame: (id, body) => request(`/games/${id}`, { method: 'PATCH', body }),
}
