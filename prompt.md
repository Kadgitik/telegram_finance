# ПРОМТ: Telegram Finance Bot — Повна реалізація

## 🎯 Задача

Побудуй повний Telegram-бот для ведення особистих фінансів на Python. Бот повинен мати **красивий UI з емодзі та inline-кнопками**, **графіки витрат**, і бути **повністю протестованим**. Готовий до деплою на Render (free tier) з keep-alive через UptimeRobot.

---

## 📦 Стек технологій

- **Python 3.11+**
- **aiogram 3.x** — async Telegram Bot API
- **motor** — async MongoDB driver
- **aiohttp** — webhook-сервер
- **matplotlib** — графіки (pie chart, bar chart) → відправка як фото
- **MongoDB Atlas** — зберігання даних
- **pytest + pytest-asyncio** — тестування

---

## 🗂 Структура проєкту

```
finance-bot/
├── bot/
│   ├── __init__.py
│   ├── main.py                # entrypoint: webhook + aiohttp server
│   ├── config.py              # env змінні через os.environ
│   ├── db/
│   │   ├── __init__.py
│   │   ├── mongo.py           # motor client singleton, get_db()
│   │   └── queries.py         # всі CRUD операції з MongoDB
│   ├── handlers/
│   │   ├── __init__.py
│   │   ├── start.py           # /start, /help
│   │   ├── transactions.py    # парсинг тексту → запис витрат/доходів
│   │   ├── stats.py           # /balance, /stats, /history
│   │   ├── categories.py      # /categories, /addcategory, /deletecategory
│   │   ├── budgets.py         # /setbudget, /budgets
│   │   ├── export.py          # /export → CSV файл
│   │   └── charts.py          # /chart → графіки як фото
│   ├── services/
│   │   ├── __init__.py
│   │   ├── parser.py          # "кава 85" → {type, amount, category, comment}
│   │   └── charts.py          # matplotlib генерація графіків
│   ├── keyboards/
│   │   ├── __init__.py
│   │   └── inline.py          # всі inline та reply клавіатури
│   └── utils/
│       ├── __init__.py
│       └── formatters.py      # форматування чисел, дат, повідомлень
├── tests/
│   ├── __init__.py
│   ├── conftest.py            # фікстури: mock db, mock bot
│   ├── test_parser.py         # тести парсера
│   ├── test_queries.py        # тести CRUD MongoDB
│   ├── test_handlers.py       # тести хендлерів
│   ├── test_charts.py         # тести генерації графіків
│   └── test_formatters.py     # тести форматування
├── requirements.txt
├── Dockerfile
├── .env.example
└── README.md
```

---

## 🔌 MongoDB

**URI:** `mongodb+srv://USER:PASSWORD@cluster.mongodb.net/?retryWrites=true&w=majority` (реальний рядок тільки в `.env`, не в репозиторії)
**БД:** `finance_bot` (нова база на існуючому кластері)

### Колекція `users`
```json
{
  "_id": ObjectId,
  "telegram_id": 123456789,
  "username": "vlad",
  "first_name": "Vladyslav",
  "default_currency": "UAH",
  "custom_categories": [],
  "budgets": {},
  "created_at": ISODate,
  "updated_at": ISODate
}
```

### Колекція `transactions`
```json
{
  "_id": ObjectId,
  "telegram_id": 123456789,
  "type": "expense",        // "expense" або "income"
  "amount": 85.0,
  "category": "🍔 Їжа",
  "comment": "кава",
  "created_at": ISODate
}
```

### Індекси
- `transactions`: `{ telegram_id: 1, created_at: -1 }` — compound index
- `transactions`: `{ telegram_id: 1, type: 1, created_at: -1 }` — для aggregation
- `users`: `{ telegram_id: 1 }` — unique index

Створи індекси програмно в `mongo.py` при старті через `create_index()`.

---

## 🎨 Дизайн UI — ДУЖЕ ВАЖЛИВО

Бот повинен виглядати **професійно і красиво**. Кожне повідомлення — продумане з емодзі, відступами, форматуванням.

### Дефолтні категорії (з емодзі!)
```python
DEFAULT_CATEGORIES = {
    "🍔 Їжа": ["їжа", "продукти", "кава", "обід", "вечеря", "сніданок", "ресторан", "доставка", "макдак", "піца", "суші"],
    "🚕 Транспорт": ["транспорт", "таксі", "убер", "болт", "метро", "бензин", "паркінг", "автобус"],
    "🏠 Житло": ["житло", "оренда", "комуналка", "інтернет", "електрика", "вода", "газ"],
    "🎮 Розваги": ["розваги", "кіно", "ігри", "netflix", "spotify", "підписка", "концерт", "бар"],
    "👕 Одяг": ["одяг", "взуття", "шмотки", "zara", "hm"],
    "💊 Здоров'я": ["здоров'я", "аптека", "лікар", "спортзал", "зал", "gym"],
    "📚 Освіта": ["освіта", "курси", "книги", "udemy"],
    "🎁 Подарунки": ["подарунок", "подарунки", "донат"],
    "📱 Техніка": ["техніка", "телефон", "навушники", "ноутбук"],
    "💼 Інше": ["інше"]
}

INCOME_CATEGORIES = {
    "💰 Зарплата": ["зарплата", "зп", "salary"],
    "💵 Фріланс": ["фріланс", "freelance", "підробіток"],
    "🎁 Подарунок": ["подарунок", "gift"],
    "📈 Інвестиції": ["інвестиції", "дивіденди", "крипта"],
    "💼 Інше": ["інше"]
}
```

### /start — Привітальне повідомлення
```
🏦 Привіт, Vladyslav!

Я — твій особистий фінансовий помічник. Допоможу вести облік витрат та доходів.

📝 Як записати витрату:
   Просто напиши: кава 85
   
💰 Як записати дохід:
   Напиши: +45000 зарплата
   
📊 Корисні команди:
├ /balance — баланс за місяць
├ /stats — статистика по категоріях
├ /chart — графік витрат 📊
├ /history — останні 10 записів
├ /categories — список категорій
├ /export — експорт у CSV
└ /help — допомога

💡 Почни просто: напиши назву витрати та суму!
```

### Відповідь на запис витрати
```
✅ Записано!

🍔 Їжа — 85 грн
📝 кава
📅 30.03.2026, 14:23

💰 Залишок бюджету "Їжа": 4 915 / 5 000 грн
███████████░░░░ 82%

[✏️ Змінити] [🗑 Видалити]
```

### Відповідь на запис доходу
```
✅ Дохід записано!

💰 Зарплата — 45 000 грн
📅 30.03.2026

📊 Баланс березня: +32 550 грн
```

### /balance
```
📊 Баланс за березень 2026

💰 Доходи:    45 000 грн
💸 Витрати:   12 450 грн
━━━━━━━━━━━━━━━━━━━
💵 Залишок:   32 550 грн

📈 Порівняння з лютим:
   Витрати: 12 450 грн vs 15 200 грн (▼ 18%)
```

### /stats
```
📊 Статистика за березень 2026

🍔 Їжа          4 200 грн  ██████████░░  34%
🚕 Транспорт    1 800 грн  ████████░░░░  15%
🏠 Житло        3 500 грн  █████████░░░  28%
🎮 Розваги        950 грн  ███░░░░░░░░░   8%
💊 Здоров'я     1 200 грн  █████░░░░░░░  10%
💼 Інше           800 грн  ███░░░░░░░░░   5%
━━━━━━━━━━━━━━━━━━━━━━━━━
💸 Всього:     12 450 грн

📝 Записів: 47 | Середня витрата: 265 грн
```

### /history
```
📋 Останні записи:

1. 🍔 Їжа — 85 грн (кава) — 14:23
2. 🚕 Транспорт — 120 грн (таксі) — 12:05
3. 🍔 Їжа — 340 грн (продукти) — вчора
4. 💊 Здоров'я — 1200 грн (зал) — вчора
5. 🏠 Житло — 3500 грн (оренда) — 28.03

[◀️ Назад] [Далі ▶️]
```

### /budgets
```
📋 Бюджети на березень 2026

🍔 Їжа
   4 200 / 5 000 грн
   ██████████████░░ 84% ⚠️

🚕 Транспорт
   1 800 / 3 000 грн
   ████████████░░░░ 60% ✅

🏠 Житло
   3 500 / 3 500 грн
   ████████████████ 100% 🔴

🎮 Розваги
   950 / 2 000 грн
   ███████░░░░░░░░░ 48% ✅

[➕ Додати бюджет]
```

### Inline-клавіатури

Після кожного запису:
```
[✏️ Змінити категорію] [🗑 Видалити]
```

Вибір категорії (коли бот не розпізнав):
```
Оберіть категорію:
[🍔 Їжа]        [🚕 Транспорт]
[🏠 Житло]      [🎮 Розваги]
[👕 Одяг]       [💊 Здоров'я]
[📚 Освіта]     [🎁 Подарунки]
[📱 Техніка]    [💼 Інше]
```

Вибір періоду для статистики:
```
📊 Оберіть період:
[📅 Тиждень] [📅 Місяць] [📅 3 місяці] [📅 Рік]
```

---

## 📊 Графіки (matplotlib) — /chart

Генеруй **3 типи графіків**, відправляй як фото у чат:

### 1. Pie Chart — витрати по категоріях за місяць
- Красиві кольори для кожної категорії (задай palette)
- Підписи з емодзі і процентами
- Заголовок: "Витрати за березень 2026"
- Фон прозорий або темно-сірий (#1a1a2e) для стильного вигляду
- Білий текст

### 2. Bar Chart — порівняння витрат по днях тижня
- Горизонтальні бари
- Градієнт кольорів від зеленого до червоного (мало → багато)
- Підписи сум

### 3. Line Chart — тренд витрат за останні 30 днів
- Лінія з градієнтною заливкою під нею
- Точки на кожному дні
- Середня лінія (пунктир)
- Стильний темний фон

### Стиль графіків (ВАЖЛИВО!)
```python
# Темна тема для всіх графіків
plt.style.use('dark_background')
COLORS = {
    "bg": "#1a1a2e",
    "card": "#16213e",
    "accent": "#0f3460",
    "highlight": "#e94560",
    "text": "#ffffff",
    "text_secondary": "#a0a0b0",
    "green": "#00d2ff",
    "categories": ["#e94560", "#0f3460", "#00d2ff", "#f5a623", "#7b68ee", "#50c878", "#ff6b6b", "#ffd93d", "#6bcb77", "#a0a0b0"]
}
```

Вибір типу графіка inline-кнопками:
```
📊 Оберіть графік:
[🥧 По категоріях] [📊 По днях] [📈 Тренд]
```

---

## 🧠 Парсер повідомлень (parser.py)

Алгоритм:
1. Прибрати зайві пробіли, привести до lowercase
2. Перевірити чи починається з `+` → дохід
3. Знайти суму: regex `(\d+[.,]?\d*)` — підтримка "85", "85.50", "1200,00"
4. Решту тексту матчити по маппінгу аліасів (case-insensitive, часткове співпадіння)
5. Якщо знайдено кілька можливих категорій — обрати найточніший match
6. Якщо не знайдено — повернути `None`, хендлер покаже inline-кнопки з категоріями

Приклади парсингу:
- "кава 85" → `{type: "expense", amount: 85, category: "🍔 Їжа", comment: "кава"}`
- "+45000 зарплата" → `{type: "income", amount: 45000, category: "💰 Зарплата", comment: "зарплата"}`
- "таксі 120" → `{type: "expense", amount: 120, category: "🚕 Транспорт", comment: "таксі"}`
- "1200 зал" → `{type: "expense", amount: 1200, category: "💊 Здоров'я", comment: "зал"}`
- "350" → `{type: "expense", amount: 350, category: None, comment: ""}` → запитати категорію

---

## 🔌 Webhook + Keep-Alive

### main.py
```python
# aiohttp сервер:
# POST /webhook — отримує updates від Telegram
# GET /health — повертає {"status": "ok", "uptime": "..."}
# GET / — інфо сторінка (назва бота, версія)

# При старті:
# 1. Підключення до MongoDB
# 2. Створення індексів
# 3. Реєстрація webhook в Telegram API
# 4. Запуск aiohttp на порті $PORT (Render задає автоматично)
```

### UptimeRobot
Пінг `GET https://<app>.onrender.com/health` кожні 15 хв.

---

## 🧪 Тести — ОБОВ'ЯЗКОВО

Напиши повний набір тестів і **переконайся що всі проходять**.

### test_parser.py
```python
# Тестуй кожен кейс парсингу:
# - "кава 85" → expense, 85, "🍔 Їжа"
# - "+45000 зарплата" → income, 45000, "💰 Зарплата"
# - "таксі 120" → expense, 120, "🚕 Транспорт"
# - "1200" → expense, 1200, category=None
# - "метро 14.50" → expense, 14.5, "🚕 Транспорт"
# - "" → None (пустий рядок)
# - "привіт" → None (немає суми)
# - "100 200" → перша знайдена сума
# - "продукти 2500 грн" → expense, 2500, "🍔 Їжа" (ігнорує "грн")
```

### test_queries.py
```python
# Mock MongoDB (mongomock або motor з тестовою БД):
# - add_user() → створює юзера з дефолтними категоріями
# - add_transaction() → зберігає запис
# - get_balance() → правильно рахує доходи мінус витрати
# - get_stats() → правильна aggregation по категоріях
# - get_history() → повертає останні N записів відсортовані по даті
# - delete_transaction() → видаляє за _id
# - add_custom_category() → додає в масив юзера
```

### test_formatters.py
```python
# - format_money(1200) → "1 200"
# - format_money(85.5) → "85.50"
# - format_money(1000000) → "1 000 000"
# - format_progress_bar(84, width=15) → "██████████████░░"
# - format_date(datetime) → "30.03.2026, 14:23"
# - format_date_short(datetime) → "30.03"
```

### test_charts.py
```python
# - generate_pie_chart() → повертає BytesIO з PNG
# - generate_bar_chart() → повертає BytesIO з PNG
# - generate_line_chart() → повертає BytesIO з PNG
# - Перевіряти що файл не пустий, є валідним PNG
```

### test_handlers.py
```python
# Інтеграційні тести з mock Bot:
# - /start → створює юзера в БД, повертає привітання
# - текст "кава 85" → створює транзакцію, повертає підтвердження
# - /balance → повертає форматований баланс
# - /stats → повертає статистику
# - callback "delete:{id}" → видаляє транзакцію
```

**Після написання всіх тестів — запусти `pytest -v` і переконайся що ВСІ тести проходять. Якщо щось падає — пофікси і перезапусти. Покажи фінальний результат запуску тестів.**

---

## 🚀 Деплой

### Dockerfile
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "-m", "bot.main"]
```

### requirements.txt
```
aiogram==3.x
motor==3.x
aiohttp==3.x
matplotlib==3.x
pymongo[srv]==4.x
python-dotenv==1.x
pytest==8.x
pytest-asyncio==0.x
mongomock==4.x
```
(Використай актуальні версії)

### .env.example
```
BOT_TOKEN=your_telegram_bot_token
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=finance_bot
WEBHOOK_URL=https://your-app.onrender.com
WEBHOOK_SECRET=your_random_secret_string
PORT=10000
```

### render.yaml (опціонально)
```yaml
services:
  - type: web
    name: finance-bot
    runtime: docker
    plan: free
    envVars:
      - key: BOT_TOKEN
        sync: false
      - key: MONGODB_URI
        sync: false
      - key: MONGODB_DB
        value: finance_bot
      - key: WEBHOOK_SECRET
        generateValue: true
```

---

## ✅ Чеклист

- [ ] Всі файли створені за структурою
- [ ] MongoDB підключення працює
- [ ] Парсер коректно розбирає 10+ варіантів вводу
- [ ] Всі команди працюють: /start, /help, /balance, /stats, /history, /chart, /categories, /addcategory, /setbudget, /budgets, /export
- [ ] Inline-кнопки працюють (зміна категорії, видалення, пагінація)
- [ ] Графіки генеруються красиво з темною темою
- [ ] Progress bar бюджетів відображається
- [ ] CSV експорт працює
- [ ] /health ендпоінт повертає 200
- [ ] Всі тести проходять (pytest -v)
- [ ] Dockerfile збирається без помилок
- [ ] README.md з інструкцією деплою

**Почни з парсера і тестів до нього, потім БД, потім хендлери, потім графіки. Тестуй кожен модуль окремо. В кінці запусти всі тести і покажи результат.**
