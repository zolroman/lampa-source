# Архитектура `lampa-source`

`lampa-source` - браузерный клиент с собственным runtime-слоем поверх jQuery, DOM API и набора глобальных менеджеров. Точка входа одна: `src/app.js`. Внутри нее приложение:

1. Настраивает `window.lampa_settings`.
2. Экспортирует публичный API в `window.Lampa`.
3. Подготавливает оболочку интерфейса.
4. Загружает язык, плагины, аккаунт, кеш и вспомогательные сервисы.
5. Рендерит shell и запускает экранную навигацию.

## Основные слои

- `src/utils` - низкоуровневые помощники: события, очереди, HTTP-обертки, кеш, IndexedDB, worker, форматирование, маски модулей, парсеры.
- `src/core` - глобальные менеджеры и stateful-сервисы: manifest, platform, storage, api, account, plugins, router, sound, mirrors, timers, content rows.
- `src/interaction` - orchestration UI и экранной логики: activity stack, items, player, settings, menu, head, search, modal, extensions, maker и другие интерактивные подсистемы.
- `src/components` - экранные сценарии верхнего уровня, которые Activity запускает по имени компонента.
- `src/templates` - HTML-шаблоны и SVG-кусочки, используемые через `interaction/template`.
- `src/services` - фоновые или интеграционные сервисы, которые стартуют после рендера приложения.
- `plugins` - внешние расширения, которые используют публичный API `window.Lampa`.

## Что делает `src/app.js`

### 1. `initClass()`

`initClass()` собирает публичный контракт плагинов и внешних модулей в `window.Lampa`. В него попадают:

- runtime-менеджеры вроде `Storage`, `Platform`, `Controller`, `Activity`, `Settings`, `Account`, `Router`, `Timer`;
- UI-утилиты вроде `Template`, `Modal`, `Player`, `Head`, `Menu`, `Select`, `Noty`;
- data/runtime API вроде `Api`, `TMDB`, `Network`, `ContentRows`, `Maker`;
- служебные helpers вроде `Utils`, `Arrays`, `MaskHelper`, `Emit`, `Event`.

Это ключевая точка расширения: все плагины работают не через import, а через `window.Lampa`.

### 2. `prepareApp()`

`prepareApp()` поднимает базовый runtime до загрузки контента:

- инициализирует progress-индикатор;
- определяет платформу и устройство ввода;
- инициализирует параметры, `Controller`, `Keypad`, `Layer`, `Console`;
- подписывает навигацию и обработку раннего выхода;
- подгружает стили и создает минимальную рабочую оболочку.

На этом этапе приложение еще не готово, но уже умеет принимать фокус и управлять слоями.

### 3. `loadLang()`

Если язык интерфейса уже выбран, загружается нужный словарь. Русский и английский встроены в бандл; остальные языки подтягиваются отдельным JS-файлом из `public/lang` или из GitHub-hosted версии, если приложение работает в `file:` или desktop-режиме.

### 4. `loadTask()`

До полного старта приложение запускает очередь приоритетных задач через `core/loading`:

- открывает кеш базы;
- поднимает reserve-слой `Storage`;
- инициализирует зеркала;
- собирает список плагинов;
- подготавливает VPN/proxy;
- подготавливает аккаунт.

После этого `Task.secondary()` параллелит два важных действия:

- таймаутный fallback `showApp()`;
- реальную загрузку плагинов через `Plugins.load(showApp)`.

### 5. `showApp()` и `startApp()`

`showApp()` скрывает welcome-screen и разрешает управление, а `startApp()` запускает весь runtime:

- инициализирует storage, timeline, HTTPS, mirrors, personal settings;
- поднимает shell-подсистемы: head, settings, select, favorite, background, notice, bell, menu, activity, screensaver;
- включает синхронизацию, аккаунт, extensions, plugins, recommendations, timetable;
- стартует player, parser, search, logs, torserver, database, content rows;
- рендерит DOM-оболочку через `Render.app()`;
- после рендера поднимает `services/*`.

### 6. `Render.app()`

`interaction/render.js` собирает каркас интерфейса:

- `Background`
- `Head`
- `wrap`
- `Menu`
- `Activity`
- `Settings`
- `Search`

Это shell, внутри которого уже живут конкретные экраны и модальные слои.

## Главный runtime-flow

Базовая цепочка работы экрана выглядит так:

1. Пользовательский переход вызывает `Router.call(...)` или прямой `Activity.push(...)`.
2. `interaction/activity/activity.js` создает activity, связывает ее с компонентом и пушит в стек экранов.
3. `core/component.js` по имени `component` возвращает экранный класс или фабрику.
4. Компонент запрашивает данные через `core/api/api.js`, который делегирует запрос в активный source, чаще всего `tmdb` или `cub`.
5. Полученные данные собираются в `interaction/items/*`, `components/*` и `interaction/template`.
6. `Controller`, `Layer`, `Scroll`, `Navigator` и `Keypad` управляют фокусом, видимостью и навигацией.

В сокращенном виде:

`Router -> Activity -> Component -> Api/source -> Template/DOM -> Controller/Layer`

## Activity как центральный экранный стек

`interaction/activity/activity.js` - главный экранный контейнер приложения. Он:

- хранит стек activity;
- управляет переходами вперед и назад;
- восстанавливает последнюю активность из `Storage`;
- обновляет browser history и deep links;
- останавливает и уничтожает старые экраны по лимиту `pages_save_total`;
- дергает `Component.create(...)` для реального создания экранов.

Из-за этого почти любой пользовательский сценарий в итоге приходит в Activity.

## Два подхода к UI

В проекте одновременно существуют два подхода.

### Legacy-компоненты

Старые сценарии из `src/components/*` строят экран через крупные классы и явные callbacks. Они до сих пор активны для части маршрутов и экранов.

### Модульная система

Новая версия 3.x активно использует `interaction/maker.js`, `interaction/constructor.js` и `utils/mask.js`. Вместо одной большой реализации экран собирается из модулей:

- `Main`
- `Line`
- `Card`
- `Category`
- `Episode`
- `Season`
- `Person`
- `Company`
- `Discuss`
- `Register`
- `Empty`

Маски определяют, какие модули подключать. Это позволяет плагинам и новым фичам точечно менять поведение без переписывания экрана целиком.

## Точки расширения

- `window.Lampa` - единый публичный runtime API.
- `Lampa.Component.add(name, component)` - регистрация нового screen component.
- `Lampa.Template.add(name, html)` - регистрация или подмена шаблонов.
- `Lampa.SettingsApi.addComponent(...)` и `addParam(...)` - подключение настроек.
- `Lampa.ContentRows.add(...)` - добавление собственных рядов на `main`, `category`, `bookmarks` и другие экраны.
- `Lampa.Manifest.plugins = manifest` - публикация plugin manifest для карточек и контекстного меню.
- `core/plugins` - загрузка удаленных plugin URL и кеширование их кода.

## Где заканчивается ядро и начинаются сервисы

После того как приложение уже отрендерено, `src/app.js` дополнительно запускает `services/*`. Эти файлы не строят основной UI, а встраивают побочные интеграции:

- метрики;
- загрузку внешних библиотек;
- внешние сезонные события;
- проверку TorrServer;
- блокировки DMCA/LGBT;
- режимы разработчика и детского профиля;
- быстрые действия и системные хоткеи.

Именно поэтому архитектурно их удобнее воспринимать как post-init слой поверх уже работающего приложения.
