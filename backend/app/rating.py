"""Рейтинг (Elo) и калибровка стартового уровня + индивидуальный план."""
from __future__ import annotations

RATING_MIN, RATING_MAX = 400, 2400


def clamp(r: float) -> int:
    return int(max(RATING_MIN, min(RATING_MAX, round(r))))


def expected(me: float, opp: float) -> float:
    return 1.0 / (1.0 + 10 ** ((opp - me) / 400.0))


def elo_update(me: int, opp: int, score: float, k: float) -> int:
    """Классическая формула Эло. score: 1 / 0.5 / 0."""
    return clamp(me + k * (score - expected(me, opp)))


def k_factor(games_played: int) -> float:
    """Первые партии двигают рейтинг сильнее — уровень ещё уточняется."""
    return 40.0 if games_played < 10 else 24.0


# ------------------------------- Калибровка --------------------------------
EXPERIENCE_BASE = {"novice": 600, "amateur": 1000, "club": 1400, "rated": 1800}
CONCEPTS_ADJ = {"none": -100, "some": 0, "all": 100}

# Темы задач Lichess -> как тренер называет слабое место
THEMES_RU = {
    "fork": "вилки", "pin": "связки", "skewer": "линейные удары",
    "discoveredAttack": "вскрытые нападения", "hangingPiece": "незащищённые фигуры",
    "mateIn1": "мат в один ход", "mateIn2": "мат в два хода", "mateIn3": "мат в три хода",
    "backRankMate": "мат по последней горизонтали", "sacrifice": "жертвы",
    "deflection": "отвлечение", "attraction": "завлечение", "trappedPiece": "ловля фигур",
    "endgame": "эндшпиль", "rookEndgame": "ладейные окончания", "pawnEndgame": "пешечные окончания",
    "kingsideAttack": "атака на короля", "defensiveMove": "защита", "quietMove": "тихие ходы",
    "promotion": "проведение пешки", "doubleCheck": "двойной шах", "intermezzo": "промежуточные ходы",
}


def calibrate(payload: dict) -> dict:
    """Считает стартовый рейтинг по трём этапам калибровки.

    payload:
      experience: novice|amateur|club|rated
      concepts:   none|some|all
      self_rating: int | None
      puzzles: [{rating, solved, themes}]
      game: {acpl, moves} | None   — мини-партия (опционально)
    """
    base = EXPERIENCE_BASE.get(payload.get("experience"), 1000) + CONCEPTS_ADJ.get(payload.get("concepts"), 0)
    self_rating = payload.get("self_rating")
    prior = 0.5 * base + 0.5 * self_rating if self_rating else base

    puzzles = payload.get("puzzles") or []
    tactics = None
    if puzzles:
        n = len(puzzles)
        wins = sum(1 for p in puzzles if p.get("solved"))
        avg = sum(p["rating"] for p in puzzles) / n
        # Линейный перформанс; задачи Lichess оцениваются щедрее игрового рейтинга
        tactics = avg + 400 * (2 * wins - n) / n - 100

    game = payload.get("game")
    game_est = None
    if game and game.get("moves", 0) >= 8:
        # Средняя потеря в сантипешках -> грубая оценка силы игры
        game_est = 2600 - 16 * min(float(game.get("acpl", 100)), 140)

    parts = [(prior, 0.3)]
    if tactics is not None:
        parts.append((tactics, 0.5))
    if game_est is not None:
        parts.append((game_est, 0.2))
    total_w = sum(w for _, w in parts)
    rating = clamp(round(sum(v * w for v, w in parts) / total_w / 10) * 10)

    # Слабые темы: что встречалось в нерешённых задачах
    missed: dict[str, int] = {}
    for p in puzzles:
        if not p.get("solved"):
            for t in (p.get("themes") or "").split():
                if t in THEMES_RU:
                    missed[t] = missed.get(t, 0) + 1
    weak = [THEMES_RU[t] for t, _ in sorted(missed.items(), key=lambda kv: -kv[1])[:3]]

    return {
        "rating": rating,
        "components": {
            "questionnaire": clamp(prior),
            "tactics": clamp(tactics) if tactics is not None else None,
            "game": clamp(game_est) if game_est is not None else None,
        },
        "weak_themes": weak,
        "plan": build_plan(rating, weak, game),
    }


def build_plan(rating: int, weak: list[str], game: dict | None) -> list[dict]:
    """Индивидуальный план тренировок. mode — в какой раздел ведёт пункт."""
    plan: list[dict] = []

    if rating < 1000:
        tactics = "Каждый день по 10 простых задач. Пока ты зеваешь фигуры в один ход, говорить о стратегии рано."
    elif rating < 1500:
        tactics = "Каждый день по 15 задач. Тактика решает девять партий из десяти на твоём уровне."
    elif rating < 1900:
        tactics = "По 15–20 задач в день, упор на расчёт в три хода и глубже. Считай до конца, а не «примерно»."
    else:
        tactics = "20 сложных задач в день без передвижения фигур. Вариант считается в голове или не считается вовсе."
    if weak:
        tactics += " Слабые места по тесту: " + ", ".join(weak) + "."
    plan.append({"mode": "tactics", "title": "Тактика", "text": tactics})

    if rating < 1100:
        openings = "Начни с 1. e4 и линий испанской партии. Правило одно: центр, развитие, рокировка — без лишних ходов пешками."
    elif rating < 1700:
        openings = "Выучи атаку Созина против сицилианской и разменный вариант испанской. Чёрными — Найдорф. По одной линии в день."
    else:
        openings = "Пройди весь репертуар без подсказок: Созин, испанская, Найдорф с отравленной пешкой, староиндийская. Знать надо идеи, а не только ходы."
    plan.append({"mode": "openings", "title": "Дебюты Фишера", "text": openings})

    plan.append({
        "mode": "guess", "title": "Угадай ход Фишера",
        "text": "Две партии в неделю. Закрой ход и думай сам — так учились все сильные шахматисты.",
    })

    bot = clamp(rating + 50)
    play = f"Три партии в неделю с ботом около {bot}. После каждой — разбор: я покажу, где ты отдал инициативу."
    if game and game.get("acpl", 0) > 70:
        play += " В калибровочной партии было слишком много грубых ошибок — перед каждым ходом проверяй, что под боем."
    plan.append({"mode": "play", "title": "Игра с тренером и анализ", "text": play})
    return plan
