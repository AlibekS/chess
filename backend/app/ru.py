"""Русификация: фамилии соперников, турниры, города, названия дебютов.

Здесь нет «фактов» о партиях — только перевод того, что лежит в базе.
Для того, чего нет в словарях, остаётся оригинальное написание из PGN.
"""
from __future__ import annotations

# Фамилия в PGN (до запятой) -> (именительный, родительный падеж: «против кого»)
OPPONENTS: dict[str, tuple[str, str]] = {
    "Spassky": ("Борис Спасский", "Бориса Спасского"),
    "Petrosian": ("Тигран Петросян", "Тиграна Петросяна"),
    "Reshevsky": ("Самуэль Решевский", "Самуэля Решевского"),
    "Benko": ("Пал Бенко", "Пала Бенко"),
    "Gligoric": ("Светозар Глигорич", "Светозара Глигорича"),
    "Bisguier": ("Артур Бисгайер", "Артура Бисгайера"),
    "Larsen": ("Бент Ларсен", "Бента Ларсена"),
    "Tal": ("Михаил Таль", "Михаила Таля"),
    "Olafsson": ("Фридрик Олафссон", "Фридрика Олафссона"),
    "Ivkov": ("Борислав Ивков", "Борислава Ивкова"),
    "Smyslov": ("Василий Смыслов", "Василия Смыслова"),
    "Uhlmann": ("Вольфганг Ульман", "Вольфганга Ульмана"),
    "Kortschnoj": ("Виктор Корчной", "Виктора Корчного"),
    "Keres": ("Пауль Керес", "Пауля Кереса"),
    "Geller": ("Ефим Геллер", "Ефима Геллера"),
    "Portisch": ("Лайош Портиш", "Лайоша Портиша"),
    "Najdorf": ("Мигель Найдорф", "Мигеля Найдорфа"),
    "Mednis": ("Эдмар Меднис", "Эдмара Медниса"),
    "Unzicker": ("Вольфганг Унцикер", "Вольфганга Унцикера"),
    "Taimanov": ("Марк Тайманов", "Марка Тайманова"),
    "Sherwin": ("Джеймс Шервин", "Джеймса Шервина"),
    "Pachman": ("Людек Пахман", "Людека Пахмана"),
    "Filip": ("Мирослав Филип", "Мирослава Филипа"),
    "Saidy": ("Энтони Сейди", "Энтони Сейди"),
    "Matulovic": ("Милан Матулович", "Милана Матуловича"),
    "Hort": ("Властимил Горт", "Властимила Горта"),
    "Evans": ("Ларри Эванс", "Ларри Эванса"),
    "Donner": ("Ян Хейн Доннер", "Яна Хейна Доннера"),
    "Szabo": ("Ласло Сабо", "Ласло Сабо"),
    "Lombardy": ("Уильям Ломбарди", "Уильяма Ломбарди"),
    "Letelier": ("Рене Летелье", "Рене Летелье"),
    "Gheorghiu": ("Флорин Георгиу", "Флорина Георгиу"),
    "Fine": ("Ройбен Файн", "Ройбена Файна"),
    "Bronstein": ("Давид Бронштейн", "Давида Бронштейна"),
    "Euwe": ("Макс Эйве", "Макса Эйве"),
    "Stein": ("Леонид Штейн", "Леонида Штейна"),
    "Botvinnik": ("Михаил Ботвинник", "Михаила Ботвинника"),
    "Panno": ("Оскар Панно", "Оскара Панно"),
    "Mecking": ("Энрике Мекинг", "Энрике Мекинга"),
    "Rubinetti": ("Хорхе Рубинетти", "Хорхе Рубинетти"),
    "Myagmarsuren": ("Лхамсурэн Мягмарсурэн", "Лхамсурэна Мягмарсурэна"),
    "Bolbochan": ("Хулио Болбочан", "Хулио Болбочана"),
    "Andersson": ("Ульф Андерссон", "Ульфа Андерссона"),
    "Averbakh": ("Юрий Авербах", "Юрия Авербаха"),
    "Polugaevsky": ("Лев Полугаевский", "Льва Полугаевского"),
    "Huebner": ("Роберт Хюбнер", "Роберта Хюбнера"),
    "Parma": ("Бруно Парма", "Бруно Пармы"),
    "Matanovic": ("Александр Матанович", "Александра Матановича"),
    "Rossolimo": ("Николас Россолимо", "Николаса Россолимо"),
    "Pilnik": ("Герман Пильник", "Германа Пильника"),
    "Wade": ("Роберт Уэйд", "Роберта Уэйда"),
}
# Братья Бирны различаются по имени
BYRNES = {
    "Byrne, Donald": ("Дональд Бирн", "Дональда Бирна"),
    "Byrne, Robert": ("Роберт Бирн", "Роберта Бирна"),
}

EVENTS: dict[str, str] = {
    "USA-ch": "чемпионат США",
    "USA-op": "открытый чемпионат США",
    "USA-chJ": "юниорский чемпионат США",
    "World Championship 28th": "матч на первенство мира",
    "St Stefan/Belgrade m": "матч со Спасским 1992 года",
    "Candidats Tournament": "турнир претендентов",
    "Candidats final": "финальный матч претендентов",
    "Candidats qf3": "четвертьфинальный матч претендентов",
    "Candidats sf1": "полуфинальный матч претендентов",
    "Capablanca mem": "мемориал Капабланки",
    "Belgrade URS-World": "«Матч века» СССР — сборная мира",
    "New York Rosenwald": "турнир памяти Розенвальда",
    "New York/Los Angeles m": "матч с Решевским",
    "CAN-op": "открытый чемпионат Канады",
}
# События-матчи: номер из тега Round — это номер партии, а не тура
MATCH_EVENTS = {"World Championship 28th", "St Stefan/Belgrade m", "Candidats final",
                "Candidats qf3", "Candidats sf1", "New York/Los Angeles m", "Belgrade URS-World",
                "Belgrade m", "New York m4", "New York m3"}

SITES: dict[str, str] = {
    "New York": "Нью-Йорк", "Buenos Aires": "Буэнос-Айрес", "Belgrade": "Белград",
    "Mar del Plata": "Мар-дель-Плата", "Bled/Zagreb/Belgrade": "Блед — Загреб — Белград",
    "Curacao": "Кюрасао", "Herceg Novi": "Херцег-Нови", "Palma de Mallorca": "Пальма-де-Мальорка",
    "Stockholm": "Стокгольм", "Havana": "Гавана", "La Habana": "Гавана", "Portoroz": "Порторож",
    "Reykjavik": "Рейкьявик", "Bled": "Блед", "Santa Monica": "Санта-Моника", "Zagreb": "Загреб",
    "Skopje": "Скопье", "Varna": "Варна", "Zuerich": "Цюрих", "Siegen": "Зиген",
    "Milwaukee": "Милуоки", "Netanya": "Нетания", "Vinkovci": "Винковцы", "Santiago": "Сантьяго",
    "Leipzig": "Лейпциг", "Los Angeles": "Лос-Анджелес", "Sousse": "Сус", "Monte Carlo": "Монте-Карло",
    "Vancouver": "Ванкувер", "Denver": "Денвер", "Montreal": "Монреаль", "Washington": "Вашингтон",
    "Cambridge": "Кембридж", "Copenhagen": "Копенгаген", "Chicago": "Чикаго", "Athens": "Афины",
    "Cleveland": "Кливленд",
}

# Семейства дебютов (часть названия Lichess до двоеточия)
OPENING_FAMILIES: dict[str, str] = {
    "Sicilian Defense": "Сицилианская защита",
    "Ruy Lopez": "Испанская партия",
    "King's Indian Defense": "Староиндийская защита",
    "French Defense": "Французская защита",
    "Caro-Kann Defense": "Защита Каро-Канн",
    "English Opening": "Английское начало",
    "Queen's Gambit Declined": "Отказанный ферзевый гамбит",
    "Queen's Gambit Accepted": "Принятый ферзевый гамбит",
    "Nimzo-Indian Defense": "Защита Нимцовича",
    "King's Indian Attack": "Староиндийское начало",
    "Grünfeld Defense": "Защита Грюнфельда",
    "Neo-Grünfeld Defense": "Защита Грюнфельда",
    "Alekhine Defense": "Защита Алехина",
    "Pirc Defense": "Защита Пирца — Уфимцева",
    "Benoni Defense": "Защита Бенони",
    "Italian Game": "Итальянская партия",
    "Indian Defense": "Индийская защита",
    "Zukertort Opening": "Дебют Рети",
    "Réti Opening": "Дебют Рети",
    "King's Gambit Accepted": "Принятый королевский гамбит",
    "King's Gambit Declined": "Отказанный королевский гамбит",
    "Vienna Game": "Венская партия",
    "Modern Defense": "Современная защита",
    "Bird Opening": "Дебют Берда",
    "Scandinavian Defense": "Скандинавская защита",
    "Petrov's Defense": "Русская партия",
    "Nimzo-Larsen Attack": "Дебют Ларсена",
    "Philidor Defense": "Защита Филидора",
    "Tarrasch Defense": "Защита Тарраша",
    "Queen's Pawn Game": "Дебют ферзевой пешки",
    "Four Knights Game": "Дебют четырёх коней",
    "Catalan Opening": "Каталонское начало",
    "Torre Attack": "Атака Торре",
    "London System": "Лондонская система",
    "Slav Defense": "Славянская защита",
    "Semi-Slav Defense": "Славянская защита",
    "Queen's Indian Defense": "Новоиндийская защита",
    "Dutch Defense": "Голландская защита",
    "Scotch Game": "Шотландская партия",
    "Two Knights Defense": "Защита двух коней",
    "King's Pawn Game": "Открытый дебют",
    "Hungarian Opening": "Дебют с 1.g3",
    "Polish Opening": "Дебют Сокольского",
    "Trompowsky Attack": "Атака Тромповского",
}

# Варианты: ключевое слово в названии Lichess -> русское название
OPENING_VARIATIONS: list[tuple[str, str]] = [
    ("Najdorf", "вариант Найдорфа"),
    ("Sozin", "атака Созина"),
    ("Fischer-Sozin", "атака Фишера — Созина"),
    ("Dragon", "вариант дракона"),
    ("Scheveningen", "схевенингенский вариант"),
    ("Richter-Rauzer", "атака Раузера"),
    ("Taimanov", "вариант Тайманова"),
    ("Kan ", "вариант Паульсена"),
    ("Closed", "закрытый вариант"),
    ("Exchange", "разменный вариант"),
    ("Marshall", "атака Маршалла"),
    ("Breyer", "система Брейера"),
    ("Chigorin", "система Чигорина"),
    ("Winawer", "вариант Винавера"),
    ("Tarrasch", "вариант Тарраша"),
    ("Sämisch", "система Земиша"),
    ("Fianchetto", "вариант с фианкетто"),
    ("Mar del Plata", "вариант Мар-дель-Плата"),
    ("Four Pawns", "атака четырёх пешек"),
    ("Two Knights", "вариант двух коней"),
    ("Panov", "атака Панова"),
    ("Classical", "классический вариант"),
    ("Advance", "вариант с продвижением"),
    ("Russian", "русская система"),
    ("Symmetrical", "симметричный вариант"),
]

RESULT_FOR_FISCHER = {
    ("1-0", "w"): "win", ("0-1", "b"): "win",
    ("1-0", "b"): "loss", ("0-1", "w"): "loss",
    ("1/2-1/2", "w"): "draw", ("1/2-1/2", "b"): "draw",
}


def plural(n: int, one: str, few: str, many: str) -> str:
    """Русское склонение: 1 партия, 2 партии, 5 партий."""
    n = abs(n)
    if n % 10 == 1 and n % 100 != 11:
        return one
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return few
    return many


def games_word(n: int) -> str:
    return plural(n, "партии", "партиях", "партиях")  # «в N партии/партиях»


def opponent_names(pgn_name: str) -> tuple[str, str]:
    """(именительный, родительный). Для неизвестных — как записано в PGN."""
    for key, val in BYRNES.items():
        if pgn_name.startswith(key):
            return val
    surname = pgn_name.split(",")[0].strip()
    if surname in OPPONENTS:
        return OPPONENTS[surname]
    # «Sherwin, James T» -> «James T Sherwin»
    parts = [p.strip() for p in pgn_name.split(",", 1)]
    plain = f"{parts[1]} {parts[0]}" if len(parts) == 2 else pgn_name
    return plain, plain


def is_known_opponent(pgn_name: str) -> bool:
    return pgn_name.split(",")[0].strip() in OPPONENTS or pgn_name.startswith("Byrne,")


def event_ru(event: str | None) -> str:
    if not event or event == "?":
        return ""
    if event in EVENTS:
        return EVENTS[event]
    low = event.lower()
    if "interzonal" in low:
        return "межзональный турнир"
    if " olm" in low:
        return "шахматная олимпиада"
    if low.endswith(" sim"):
        return "сеанс одновременной игры"
    if "blitz" in low:
        return "блицтурнир"
    if low.endswith(" m") or " m" in low and low.split(" m")[-1].isdigit():
        return "матч"
    return f"турнир «{event}»"


def site_ru(site: str | None) -> str:
    if not site or site == "?":
        return ""
    return SITES.get(site, site)


def round_ru(event: str | None, rnd: str | None) -> str:
    if not rnd or not rnd.isdigit():
        return ""
    return f"{rnd}-я партия" if event in MATCH_EVENTS else f"{rnd}-й тур"


def game_ref(event: str | None, site: str | None, year: int | None, rnd: str | None) -> str:
    """«матч на первенство мира, Рейкьявик, 1972, 6-я партия»."""
    ev = event_ru(event)
    # Турнир назван по городу («Zuerich» в Цюрихе) — не дублируем название
    if event and site and event not in EVENTS and (event == site or event.startswith(site)) \
            and ev.startswith("турнир «"):
        ev = "турнир"
    parts = [ev, site_ru(site), str(year) if year else "", round_ru(event, rnd)]
    return ", ".join(p for p in parts if p)


def opening_ru(name: str | None) -> str:
    """Перевод названия дебюта: семейство + узнаваемый вариант."""
    if not name:
        return ""
    family, _, rest = name.partition(":")
    family = family.split(",")[0].strip()
    out = OPENING_FAMILIES.get(family, family)
    for key, ru in OPENING_VARIATIONS:
        if key in rest:
            # «Fischer-Sozin» содержит «Sozin» — берём более точный вариант
            if key == "Sozin" and "Fischer-Sozin" in rest:
                continue
            out += f", {ru}"
            break
    return out


def color_instr(color: str) -> str:
    return "белыми" if color == "w" else "чёрными"
