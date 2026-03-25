# Модули и их взаимосвязи

Этот документ описывает подсистемы `lampa-source` по ролям, а не по каждому файлу отдельно. В проекте много файлов, но они укладываются в несколько устойчивых контуров.

## 1. Каркас экранов и навигации

### `core/component`

`src/core/component.js` - реестр экранных компонентов. Он знает, какой класс или фабрика обслуживает имя `main`, `full`, `favorite`, `episodes`, `company`, `bookmarks` и другие activity-компоненты.

Связи:

- вызывается из `interaction/activity/activity.js`;
- может быть расширен плагином через `Lampa.Component.add(...)`;
- возвращает либо core-компонент, либо fallback `nocomponent`.

### `core/router`

`src/core/router.js` - маршрутизатор высокого уровня. Он преобразует короткий route name в объект activity:

- `full`
- `category`
- `category_full`
- `favorite`
- `episodes`
- `company`
- `actor`

Связи:

- используется внутри `components/*`, `interaction/*` и плагинов;
- отправляет готовый объект в `Activity.push(...)`.

### `interaction/activity`

`src/interaction/activity/activity.js` - стек экранов. Это один из самых важных модулей проекта.

Он отвечает за:

- создание activity;
- переключение между слоями;
- browser history и deep links;
- восстановление последнего экрана;
- lifecycle методов `create`, `start`, `pause`, `stop`, `destroy`;
- ограничение числа живых экранов в памяти.

Связи:

- создает компоненты через `core/component`;
- синхронизируется с `Controller`, `Head`, `Layer`, `Storage`, `Navigator`;
- фактически является центром пользовательской навигации.

### `interaction/render`

`src/interaction/render.js` рендерит базовую оболочку приложения. Это точка, где вместе встречаются `Head`, `Menu`, `Activity`, `Settings`, `Search` и `Background`.

## 2. Шаблоны, DOM и настройки

### `interaction/template`

`src/interaction/template.js` - реестр шаблонов. Он:

- хранит HTML-шаблоны;
- прогоняет их через `Lang.translate(...)`;
- поддерживает вставку переменных;
- умеет возвращать jQuery-объекты и чистые DOM-узлы;
- позволяет плагинам переопределять шаблоны через `Template.add(...)`.

Это основной мост между логикой и HTML.

### `interaction/settings`

Подсистема настроек разделена на несколько уровней:

- `interaction/settings/settings.js` - UI настроек и экраны секций;
- `interaction/settings/api.js` - публичный API для добавления новых компонентов и параметров;
- `interaction/settings/params.js` - реестр значений и defaults;
- `interaction/settings/input.js` - редактирование полей.

Связи:

- ядро читает значения через `Storage.field(...)`, который обращается к `Params`;
- плагины чаще всего расширяют настройки через `SettingsApi`;
- часть legacy-плагинов до сих пор мутирует DOM настроек напрямую.

## 3. Данные, состояние и источники

### `core/api` и `core/api/sources`

`src/core/api/api.js` - фасад для всех источников данных. Он решает, к какому source делегировать вызов: `tmdb`, `cub` или plugin-driven logic.

Базовые сценарии:

- `main`
- `category`
- `full`
- `list`
- `person`
- `company`
- `search`
- `collections`
- `seasons`

Главные источники:

- `src/core/api/sources/tmdb.js` - основной discovery-каталог, карточки, персоны, жанры, компании и значительная часть метаданных.
- `src/core/api/sources/cub.js` - CUB-специфичные данные, рекомендации, коллекции, обсуждения, спецсервисы.
- `src/core/api/sources/parser.js` - отдельный источник для torrent-поиска и интеграций с Jackett, Prowlarr и TorrServer.
- `src/core/api/sources/ai.js` - источник для AI/discovery-поиска.

Связи:

- компоненты почти никогда не ходят в network напрямую, а идут через `Api`;
- результат источника дополняется `source` и передается дальше в UI;
- `ContentRows` может встраивать свои ряды поверх выдачи `tmdb`.

### `core/storage`

`src/core/storage/storage.js` - единая точка работы с persistent state:

- localStorage;
- reserve-слой из IndexedDB;
- событие `listener.follow('change', ...)`;
- кеш с ограничением размера;
- workers для синхронизации части сущностей с сервером.

Связи:

- читается практически всем приложением;
- стартует ранним этапом в `loadTask()`;
- является транспортом для плагинов и runtime-настроек.

### `core/account`

Аккаунт разбит на несколько файлов:

- `core/account/account.js` - фасад;
- `core/account/api.js` - HTTP API к CUB;
- `core/account/permit.js` - права, child profile, токены;
- `core/account/profile.js`, `timeline.js`, `bookmarks.js`, `panel.js`, `device.js`, `modal.js` - UI и синхронизация отдельных частей аккаунта.

Связи:

- `core/plugins` и `interaction/extensions` получают список remote-плагинов через `Account.Api.plugins()`;
- child-mode и возрастные ограничения завязаны на `Permit`;
- плагины могут использовать `Lampa.Account`, но часть старых методов уже объявлена deprecated.

### `core/plugins`

`src/core/plugins.js` - runtime-загрузчик внешних plugin URL.

Он делает несколько вещей:

- читает локальный список plugins из `Storage`;
- объединяет его с remote plugin list аккаунта;
- применяет blacklist;
- подставляет в URL параметры и placeholders;
- грузит скрипты асинхронно;
- кеширует код плагина в IndexedDB и умеет восстановить его из кеша при сетевой ошибке.

Связи:

- запускается во время `loadTask()` до полного старта приложения;
- работает совместно с `interaction/extensions/*`, где пользователь видит и подключает plugins;
- фактически описывает контракт внешней plugin-системы.

### `core/content_rows`

`src/core/content_rows.js` - реестр дополнительных рядов контента. Это важный extension point для плагинов и встроенных подсистем.

Он позволяет:

- добавить ряд на `main`, `category`, `bookmarks` и другие экраны;
- включать и выключать ряды через настройки;
- подмешивать callbacks в общий список загрузки рядов источника.

Связи:

- вызывается прямо из `tmdb` source;
- используется новыми плагинами вместо старого `manifest.onMain`.

## 4. Модульная UI-система

### `interaction/constructor`, `interaction/maker`, `utils/mask`

Это базовая инфраструктура модульного UI.

- `interaction/constructor.js` - базовый конструктор, который применяет модульные mixin-обработчики и lifecycle events.
- `interaction/maker.js` - фабрика классов `Card`, `Main`, `Line`, `Category`, `Episode`, `Season`, `Person`, `Company`, `Discuss`, `Register`, `Empty`.
- `utils/mask.js` - bitmask helper, который включает и выключает модули.

Зачем это нужно:

- создавать уменьшенные или специализированные варианты экранов;
- менять карту модулей без полного форка базового класса;
- давать плагинам точку встраивания через `params.module`, `params.emit`, `params.createInstance`.

### `interaction/items/*`

Это модульные классы для основных строительных блоков интерфейса:

- `items/main`
- `items/category`
- `items/line`
- `card`
- `episode`
- `season`
- `person`
- `company`
- `discuss`
- `register`
- `empty`

Обычно они состоят из:

- `base.js`
- `module/module.js`
- `module/map.js`
- набора отдельных модулей поведения

Именно этот слой сейчас считается предпочтительным для новых расширений.

### Сосуществование с `components/*`

В проекте одновременно живут два подхода:

- `components/*` - legacy screen-level logic, часто через большие функции и явные callbacks;
- `interaction/*` + `Maker` - более новый composable-подход.

Практическое правило:

- если экран уже построен на `Maker` и модульных `items/*`, лучше продолжать там;
- если поведение живет в старом `components/*`, сначала нужно понять, не сломает ли насильственный перенос существующие плагины и экраны.

## 5. Плеер, поиск и прочие крупные interaction-подсистемы

### Player

`interaction/player*` - крупный cluster, который включает:

- основной lifecycle player;
- video backend;
- panel, footer, info;
- IPTV-режим;
- playlist;
- subs, segments, normalization, platform-specific backends.

Плагины часто цепляются именно сюда через `Lampa.Player.listener`, `Lampa.PlayerVideo.listener` и `Lampa.PlayerPanel`.

### Search

`interaction/search/*` - глобальный поиск с несколькими sources. В него может встраиваться parser, AI и плагины.

### Extensions

`interaction/extensions/*` - UI вокруг plugin store и установленных external plugins. Это не loader сам по себе, а интерфейс управления тем, что грузит `core/plugins`.

## 6. Сервисы post-init

`src/services/*` стартуют после рендера приложения и добавляют побочные интеграции.

- `watched.js` - отправляет статистику о добавлении в историю просмотров на сервер `tmdb.<cub_domain>`.
- `torrserver.js` - валидирует доступность TorrServer URL в настройках и показывает статус подключения.
- `settings.js` - добавляет дополнительное поведение в настройки: выбор языка, скрытие `protocol` на HTTPS, интеграция с Apple TV.
- `remote_favorites.js` - открывает избранное по цветным кнопкам пульта, если плеер не активен.
- `metric.js` - шлет базовые метрики клиента, платформы, региона и запусков плеера.
- `libs.js` - догружает внешние JS-библиотеки и сервисные плагины вроде `sport`, `tsarea`, `shots`.
- `lgbt.js` - загружает и кеширует карту LGBT-блокировок, а также добавляет параметр блокировки контента.
- `fps.js` - developer overlay для FPS-графика в шапке.
- `events.js` - по календарю догружает сезонные плагины с CUB.
- `developer.js` - скрыто активирует developer-настройки, переключатели и выбор зеркала CUB.
- `dmca.js` - загружает список заблокированных карточек.
- `children.js` - применяет ограничения детского профиля и скрывает лишние пункты меню.

## 7. Как подсистемы связаны в реальном сценарии

Пример: пользователь открывает карточку фильма.

1. `Router.call('full', data)` формирует объект activity.
2. `Activity.push(...)` создает новый экран.
3. `core/component` находит компонент `full`.
4. `components/full.js` вызывает `Api.full(...)`.
5. `tmdb` или `cub` source возвращает фильм, сезоны, персоны, коллекции, обсуждения.
6. Компонент собирает строки и вложенные UI-блоки через `Main`, `Line`, `Card`, `Template`.
7. `Controller`, `Layer`, `Background` и `Scroll` обеспечивают фокус, фон и навигацию.
8. Плагины получают шанс встроиться через `Lampa.Listener.follow('full', ...)`, `Manifest.plugins`, `ContentRows` и подмену шаблонов.

Это типичная схема и для большинства других экранов: данные идут через `core`, отображение идет через `interaction` и `components`, а плагины встраиваются в уже опубликованные extension points.
