# AI Photo Sessions — High‑Fidelity Prototype

Фронтенд — единое SPA, роли разнесены по URL:
- `/client` — Клиент (TMA UI)
- `/partner` — Партнёр (TMA UI, MLM)
- `/admin` — Owner/Admin (Web dashboard)

## Запуск

```bash
npm install
npm run dev
```

## Backend (PostgreSQL + MLM)

В репозитории есть минимальный backend (Fastify + Postgres) с упором на MLM (2 уровня), атрибуцию заказов и начисления комиссий.

1) Подними Postgres (например через Docker):

```bash
docker compose up -d
```

2) Задай `DATABASE_URL`:

```bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/ai_photo"
```

Можно просто скопировать `.env.example` в `.env` и поправить значения.

3) Прогони миграции:

```bash
npm run db:migrate
```

4) Запусти сервер:

```bash
npm run server:dev
```

По умолчанию backend слушает `http://127.0.0.1:8787`.

В Docker/деплое миграции можно прогонять на старте контейнера (`AUTO_MIGRATE=1`), либо вручную через `npm run db:migrate`.

Админ‑эндпоинты используют простой токен:

```bash
export ADMIN_TOKEN="dev_admin_token"
```

### Полезные эндпоинты (прототип)

- `GET /api/config` — конфиг (цены/комиссии/порог вывода)
- `GET /api/packs` — активные стили (packs)
- `GET /api/promos` — активные промо‑материалы
- `POST /api/partner/register` — регистрация партнёра (можно с `teamCode`)
- `GET /api/partner/:publicId/dashboard` — баланс/статы/ссылки
- `GET /api/partner/:publicId/team` — команда L1/L2
- `GET /api/partner/:publicId/clients` — клиенты L1 + клиенты команды (L2)
- `POST /api/client/order` — создать заказ (можно с `clientCode`)
- `POST /api/orders/:id/mark-paid` — симуляция оплаты → начисления
- `POST /api/client/avatar/start` — загрузка датасета (JSON) + старт обучения (job)
- `GET /api/client/avatar?tgId=...` — статус аватара
- `POST /api/client/sessions` — создать фотосессию (pack/custom) → генерация (job)
- `GET /api/client/sessions?tgId=...` — история + фото

Для фоновой обработки job’ов запусти воркер:

```bash
npm run worker:dev
```

### Telegram auth (важно для продакшена)

В проде запросы должны приходить с `initData` из Telegram Mini App. Backend поддерживает:
- Header: `x-telegram-init-data: <initData>`
- Или `initData` в query/body

Для локальной разработки можно передавать `tgId` (если `ALLOW_DEBUG_AUTH=1`).

## Стек

React + TypeScript + Tailwind CSS + Lucide Icons + Framer Motion.
