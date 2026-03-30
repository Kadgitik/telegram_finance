# Telegram Finance — Mini App + Bot

Особистий облік у **Telegram Mini App** (React + Vite + Tailwind + Chart.js + `@twa-dev/sdk`) та **FastAPI** REST API з валідацією `initData`. Той самий сервіс роздає статику фронтенду, `/api/*`, `/health` і `POST /webhook` (aiogram). MongoDB Atlas, Motor. Текстові команди бота лишаються як додаток до `/start` з кнопкою WebApp.

Детальна специфікація: `prompt-mini-app.md`.

## Локальний запуск (повний стек)

1. Python 3.11+, Node 20+
2. `python -m pip install -r requirements.txt`
3. У каталозі `frontend`: `npm install` → `npm run build`
4. Скопіюй корінь `frontend/dist` у `static/` (або збереться автоматично в Docker multi-stage).
5. Змінні в `.env` (див. `.env.example`): `BOT_TOKEN`, `MONGODB_URI`, `MONGODB_DB`, `WEBHOOK_URL` (базовий HTTPS **без** `/webhook`), опційно `WEBAPP_URL` (якщо відрізняється; інакше = `WEBHOOK_URL`), `WEBHOOK_SECRET`, локально `PORT`.
6. З кореня репозиторію, з `PYTHONPATH` = корінь проєкту:

```bash
# Windows PowerShell
$env:PYTHONPATH = (Get-Location).Path
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 10000
```

Міні-застосунок у Telegram вимагає публічний HTTPS (ngrok/Render). URL у BotFather / кнопці WebApp має збігатися з базовим URL сервісу.

### Лише старий aiohttp-бот (без фронту)

```bash
python -m bot.main
```

Ендпоінти (FastAPI):

- `GET /` — SPA (після `npm run build` → `static/`)
- `GET /health` — health check
- `POST /webhook` — Telegram
- `GET/POST /api/...` — див. `backend/app/routers/`

Фронтенд:

```bash
cd frontend && npm run dev   # окремо для розробки UI (проксі API налаштуйте за потреби)
npm test                     # Vitest
```

## Тести

```bash
pytest -v
```

Для тестів у `tests/conftest.py` задаються фіктивні змінні середовища (реальний Mongo не потрібен).

## Docker

Один образ: збірка `frontend` → `static/`, потім **uvicorn** `backend.app.main:app`.

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

У Telegram API для `secret_token` дозволені лише символи `A–Z`, `a–z`, `0–9`, `_` та `-`. Згенерований Render іноді містить інші символи — у коді (`bot/config.py`) секрет **нормалізується** (хеш у hex), тож `generateValue: true` у `render.yaml` працює. Власний секрет теж можна задати вручну з цих символів; після зміни в панелі зробіть перезапуск сервісу.

### PORT

На **Render не задавайте** `PORT` уручну в Environment (якщо не знаєте, що робите). Платформа підставляє свій `PORT`; додаток уже читає `os.environ["PORT"]` у `bot/config.py`. Локально залишайте `PORT=10000` у `.env`.

### Кроки деплою

1. Репозиторій на GitHub/GitLab + підключити до Render **Blueprint** (файл `render.yaml`) або створити **Web Service** з Docker (`Dockerfile`).
2. У Environment задати:
   - `BOT_TOKEN`
   - `MONGODB_URI`
   - `MONGODB_DB` (наприклад `finance_bot` — як у прикладі)
   - `WEBHOOK_URL` = URL сервісу з панелі Render (https://… **без** `/webhook`) — той самий базовий URL відкриває **Mini App** у браузері та дає API `/api/...`
   - опційно `WEBAPP_URL` — якщо кнопка «Відкрити застосунок» має вести на інший домен (рідко; зазвичай дорівнює `WEBHOOK_URL`)
   - `WEBHOOK_SECRET` — згенерований або свій
3. Після деплою перевірити `https://<ваш-сервіс>.onrender.com/health` і відкрити той самий URL у браузері — має завантажитися React UI.
4. (Опційно) UptimeRobot на `/health` кожні 10–15 хв — щоб безкоштовний інстанс не «засинав» надовго; перший запит після простою може бути повільним.

## Команди бота

`/start`, `/help`, `/balance`, `/stats`, `/history`, `/chart`, `/categories`, `/addcategory`, `/deletecategory`, `/setbudget`, `/budgets`, `/export`

Витрата: `кава 85`. Дохід: `+5000 зарплата`.

## Безпека

Не коміть файл `.env`. Якщо рядок підключення до Mongo потрапив у публічний репозиторій — змініть пароль у Atlas.

Запити до `/api/*` вимагають заголовок `Authorization: tma <initData>` (перевірка HMAC за документацією Telegram Web Apps); усередині Telegram Mini App `initData` підставляє клієнт через `@twa-dev/sdk`.
