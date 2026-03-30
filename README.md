# Telegram Finance Bot

Особистий облік доходів і витрат у Telegram (aiogram 3, Motor, MongoDB Atlas, matplotlib, webhook + aiohttp).

## Локальний запуск

1. Python 3.11+
2. `python -m pip install -r requirements.txt`
3. Скопіюй `.env.example` → `.env` і заповни:
   - `BOT_TOKEN` — від [@BotFather](https://t.me/BotFather)
   - `MONGODB_URI` — рядок підключення MongoDB Atlas
   - `MONGODB_DB` — ім’я БД (наприклад `finance_bot`)
   - `WEBHOOK_URL` — **базовий** URL без шляху, напр. `https://your-app.onrender.com` (шлях `/webhook` додається автоматично)
   - `WEBHOOK_SECRET` — довільний секрет (опційно; має збігатися з тим, що підтримує Telegram при встановленні webhook)
   - `PORT` — порт HTTP (на Render задається автоматично)

4. Публічний HTTPS endpoint для webhook (ngrok, Render тощо).
5. `python -m bot.main`

Ендпоінти:

- `GET /health` — перевірка для UptimeRobot
- `GET /` — короткий JSON про сервіс
- `POST /webhook` — оновлення Telegram

## Тести

```bash
pytest -v
```

Для тестів у `tests/conftest.py` задаються фіктивні змінні середовища (реальний Mongo не потрібен).

## Docker

```bash
docker build -t finance-bot .
docker run --env-file .env -p 10000:10000 finance-bot
```

## Render (free tier)

Я не можу за вас увійти в Render — деплой робите ви. Коротко, що означають змінні:

### MONGODB_DB

Це **лише ім’я бази** у MongoDB (рядок, наприклад `finance_bot`). Окремо «створювати» її в Atlas не обов’язково: база з’явиться, коли бот перший раз запише документ. Головне — коректний `MONGODB_URI` і доступ з інтернету (Atlas: Network Access → `0.0.0.0/0` або IP Render, якщо обмежуєте).

### WEBHOOK_URL

Після першого успішного деплою Render показує публічну адресу сервісу, наприклад:

`https://finance-bot.onrender.com` або `https://finance-bot-xxxx.onrender.com`

Це і є **базовий URL без `/webhook`**. Його копіюєте в змінну `WEBHOOK_URL`. Шлях `/webhook` бот додає сам у коді (`set_webhook`).

**Важливо:** якщо спочатку задеплоїли без `WEBHOOK_URL`, потім додали його — зробіть **Manual Deploy → Clear build cache & deploy** або перезапуск сервісу, щоб `set_webhook` відпрацював з новою адресою.

### WEBHOOK_SECRET

Довільна секретна строка. У `render.yaml` для Blueprint можна `generateValue: true` — Render сам згенерує і покладе в Environment. Бот при старті викликає `set_webhook(..., secret_token=WEBHOOK_SECRET)`, тож значення має бути **тим самим**, що в змінних середовища (ручне редагування в панелі можливе, але тоді після зміни перезапустіть сервіс).

### PORT

На **Render не задавайте** `PORT` уручну в Environment (якщо не знаєте, що робите). Платформа підставляє свій `PORT`; додаток уже читає `os.environ["PORT"]` у `bot/config.py`. Локально залишайте `PORT=10000` у `.env`.

### Кроки деплою

1. Репозиторій на GitHub/GitLab + підключити до Render **Blueprint** (файл `render.yaml`) або створити **Web Service** з Docker (`Dockerfile`).
2. У Environment задати:
   - `BOT_TOKEN`
   - `MONGODB_URI`
   - `MONGODB_DB` (наприклад `finance_bot` — як у прикладі)
   - `WEBHOOK_URL` = URL сервісу з панелі Render (https://… **без** `/webhook`)
   - `WEBHOOK_SECRET` — згенерований або свій
3. Після деплою перевірити `https://<ваш-сервіс>.onrender.com/health`.
4. (Опційно) UptimeRobot на `/health` кожні 10–15 хв — щоб безкоштовний інстанс не «засинав» надовго; перший запит після простою може бути повільним.

## Команди бота

`/start`, `/help`, `/balance`, `/stats`, `/history`, `/chart`, `/categories`, `/addcategory`, `/deletecategory`, `/setbudget`, `/budgets`, `/export`

Витрата: `кава 85`. Дохід: `+5000 зарплата`.

## Безпека

Не коміть файл `.env`. Якщо рядок підключення до Mongo потрапив у публічний репозиторій — змініть пароль у Atlas.
