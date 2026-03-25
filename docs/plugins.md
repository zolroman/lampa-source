# Встроенные плагины из `plugins/`

В репозитории есть два разных понятия плагинов:

- встроенные исходники в каталоге `plugins/`, которые собираются `gulp` и публикуются как отдельные JS-файлы;
- внешние URL-плагины, которые пользователь подключает через экран расширений, а runtime загружает через `core/plugins`.

Этот документ описывает именно встроенные repo-плагины, но по ходу отмечает, как они встраиваются в общий plugin runtime.

## Как встроенные плагины живут в проекте

- каждый плагин лежит в своей папке `plugins/<name>`;
- `gulpfile.js` ищет папки автоматически и ожидает entrypoint `plugins/<name>/<name>.js`;
- если у плагина есть `css/*.scss`, build-процесс компилирует их и затем инлайнит через `@@include(...)`;
- итоговые JS-файлы копируются в `build/web/plugins` и `build/github/lampa/plugins`.

В рантайме такой файл становится обычным script-плагином, который использует `window.Lampa`.

## Контент и источники

### `online`

- Путь: `plugins/online/online.js`
- Назначение: legacy-плагин онлайн-просмотра через внешние балансеры.
- Интеграция: добавляет кнопку в `full`, регистрирует компонент `online`, добавляет proxy и Filmix-настройки, встраивается после события `full:complite`.
- Использует: `Lampa.Component`, `Lampa.Template`, `Lampa.Listener`, `Lampa.Settings.main()`, `Lampa.Activity`, `Lampa.Params`, `Lampa.Storage`.
- Оговорки: настройки добавляются прямой мутацией DOM настроек, а не через `SettingsApi`. Это старый стиль интеграции.

### `online_prestige`

- Путь: `plugins/online_prestige/online_prestige.js`
- Назначение: более новый вариант online-плагина с собственным компонентом `online_prestige`.
- Интеграция: публикует `manifest` типа `video`, добавляет пункт в контекстное меню карточек через `onContextMenu` и `onContextLauch`, а также свои шаблоны и настройки.
- Использует: `Lampa.Manifest.plugins`, `Lampa.Component`, `Lampa.Template`, `Lampa.Listener`, `Lampa.Activity`.
- Оговорки: фактически интегрируется глубже, чем `online`, потому что работает через plugin manifest и карточечное меню.

### `collections`

- Путь: `plugins/collections/collections.js`
- Назначение: экран и карточки коллекций.
- Интеграция: добавляет кнопку в основное меню, регистрирует компоненты `cub_collections_main`, `cub_collections_collection`, `cub_collections_view`, публикует plugin manifest.
- Использует: `Lampa.Component`, `Lampa.Template`, `Lampa.Manifest.plugins`, `Lampa.Activity`.
- Оговорки: `manifest.component` задан как `cub_collections`, но реальные activity-компоненты имеют суффиксы `_main`, `_collection`, `_view`. Это важно для поддержки и навигации.

### `dlna`

- Путь: `plugins/dlna/dlna.js`
- Назначение: клиент DLNA для локальной сети.
- Интеграция: добавляет кнопку в меню, регистрирует отдельный screen component, строит собственный набор шаблонов.
- Использует: `webapis.allshare`, `Lampa.Component`, `Lampa.Template`, `Lampa.Manifest.plugins`, `Lampa.Activity`.
- Оговорки: в коде фигурирует имя `client_dnla` и флаг `plugin_client_dnla`. Это опечатка в naming, но она является фактической частью контракта.

### `iptv`

- Путь: `plugins/iptv/iptv.js`
- Назначение: отдельный IPTV-режим с плейлистами, guide, EPG и собственным компонентом.
- Интеграция: добавляет кнопку в меню, регистрирует `iptv`, публикует plugin manifest, добавляет main-row через `ContentRows`, инициализирует guide/settings/templates.
- Использует: `Lampa.Component`, `Lampa.Manifest.plugins`, `Lampa.ContentRows`, `Lampa.Storage`, `Lampa.Listener`, `Lampa.Template`.
- Оговорки: при `window.lampa_settings.iptv` меняет стартовый экран, скрывает часть действий в head/navigation и становится практически отдельным режимом приложения.

### `radio`

- Путь: `plugins/radio/radio.js`
- Назначение: простой старый радио-плагин с меню и глобальным `window.radio_player`.
- Интеграция: добавляет кнопку в меню, регистрирует `radio`, инлайнит CSS прямо из JS.
- Использует: `Lampa.Component`, `Lampa.Template`, `Lampa.Listener`, `Lampa.Activity`.
- Оговорки: это legacy-плагин с hardcoded CSS и минимальным manifest-less подходом.

### `record`

- Путь: `plugins/record/record.js`
- Назначение: более развитый радио/streaming screen с кастомными шаблонами и более богатым UI.
- Интеграция: публикует plugin manifest типа `audio`, добавляет кнопку в меню, регистрирует компонент `radio`, подключает набор шаблонов и стилей.
- Использует: `Lampa.Manifest.plugins`, `Lampa.Component`, `Lampa.Template`, `Lampa.Activity`.
- Оговорки: использует то же имя компонента `radio`, что и legacy-плагин `radio`. Одновременная загрузка обоих плагинов приводит к конфликту регистраций, поэтому при поддержке их лучше рассматривать как альтернативы, а не совместимую пару.

### `shots`

- Путь: `plugins/shots/shots.js`
- Назначение: социальный слой с короткими видео, лентой, закладками и записью фрагментов.
- Интеграция: добавляет кнопку в меню, регистрирует несколько компонентов, добавляет `ContentRows` на `main` и `bookmarks`, подписывается на player/full/state events.
- Использует: `Lampa.Component`, `Lampa.ContentRows`, `Lampa.Menu`, `Lampa.Listener`, `Lampa.Player`, `Lampa.SettingsApi`.
- Оговорки: включает языковое и версионное ограничение, активируется только на части локалей и требует достаточно свежий `Manifest.app_digital`.

## Утилиты и интеграции

### `backup`

- Путь: `plugins/backup/backup.js`
- Назначение: экспорт и импорт `localStorage` на внешний backup endpoint.
- Интеграция: создает секцию в настройках через `SettingsApi.addComponent` и две кнопки через `SettingsApi.addParam`.
- Использует: `Lampa.SettingsApi`, `Lampa.Select`, `Lampa.Loading`, `Lampa.Noty`, `Lampa.Storage`.
- Оговорки: переменная `backupUrl` в репозитории пустая. Без подстановки реального адреса плагин остается заготовкой интеграции.

### `tracks`

- Путь: `plugins/tracks/tracks.js`
- Назначение: enrich-треки и метаинформация для torrent playback.
- Интеграция: не добавляет меню и не публикует manifest; подписывается на `Player` и `torrent_file`, парсит ffprobe-данные и обновляет UI треков/субтитров.
- Использует: `Lampa.Player.listener`, `Lampa.PlayerVideo.listener`, `Lampa.PlayerPanel`, `Lampa.Template`.
- Оговорки: зависит от внешнего ffprobe-источника по socket/http и глубоко завязан на структуру torrent playback.

### `tmdb_proxy`

- Путь: `plugins/tmdb_proxy/tmdb_proxy.js`
- Назначение: проксирование `TMDB.image` и `TMDB.api`.
- Интеграция: monkey-patch глобального `Lampa.TMDB`, скрытие части TMDB proxy-настроек.
- Использует: `Lampa.TMDB`, `Lampa.Settings.listener`, `Lampa.Storage`, `Lampa.Manifest`, `Lampa.Utils`.
- Оговорки: это не UI-плагин, а runtime override. Он меняет поведение ядра после загрузки.

### `view_plugin`

- Путь: `plugins/view_plugin/view_plugin.js`
- Назначение: сервисный экран для просмотра установленных plugin URL.
- Интеграция: добавляет кнопку "Анализ" в меню, показывает список URL и iframe-preview.
- Использует: `Lampa.Account.plugins`, `Lampa.Storage`, `Lampa.Select`, `Lampa.Modal`, `Lampa.Base64`.
- Оговорки: полезен как отладочный инструмент, а не как пользовательская функция.

### `etor`

- Путь: `plugins/etor/etor.js`
- Назначение: tiny utility-скрипт, который включает торрент-функциональность и снимает несколько ограничений.
- Интеграция: не регистрирует UI, сразу мутирует `window.lampa_settings`.
- Использует: только глобальные настройки.
- Оговорки: самый минимальный пример "плагина без manifest и без UI".

## Визуальные и сезонные

### `twolines`

- Путь: `plugins/twolines/twolines.js`
- Назначение: чисто стилевой плагин.
- Интеграция: после `app ready` инлайнит CSS.
- Использует: только `Lampa.Listener`.
- Оговорки: это хороший минимальный шаблон repo-плагина.

### `snow`

- Путь: `plugins/snow/snow.js`
- Назначение: новогодний theme-оверлей с гирляндой и декором логотипа.
- Интеграция: модифицирует head, добавляет CSS и запускает анимацию `Garland`.
- Использует: `Lampa.Listener`, DOM и собственные helpers `template.js`, `garland.js`.

### `halloween`

- Путь: `plugins/halloween/halloween.js`
- Назначение: сезонная хеллоуинская замена логотипа и стилей.
- Интеграция: заменяет `.head__logo-icon`, добавляет CSS, использует клик по логотипу как shortcut в меню.
- Использует: `Lampa.Listener`, прямую работу с DOM.

### `womens-day`

- Путь: `plugins/womens-day/womens-day.js`
- Назначение: промо-баннер и modal для акции 8 марта.
- Интеграция: добавляет кнопку в head, показывает modal, подгружает картинку и стили.
- Использует: `Lampa.Head`, `Lampa.Modal`, `Lampa.Controller`, `Lampa.Template`, `Lampa.Utils.imgLoad`.
- Оговорки: использует флаг `window.womens_day`, а не стандартный `window.plugin_*_ready`, и содержит языковой фильтр.

## Служебные, спорные и незавершенные

### `torrent_download`

- Путь: `plugins/torrent_download/`
- Назначение: на текущий момент отсутствует.
- Интеграция: отсутствует.
- Оговорки: каталог пустой. Документировать его как готовую функциональность нельзя.

## Как встроенные плагины встраиваются в UI

На практике repo-плагины используют несколько повторяющихся точек интеграции:

- меню: `collections`, `dlna`, `iptv`, `radio`, `record`, `shots`, `view_plugin`;
- `full`-экран и карточки: `online`, `online_prestige`, частично `shots`;
- настройки: `backup`, `iptv`, `shots`, `online`, `online_prestige`, `tmdb_proxy`;
- `ContentRows`: `iptv`, `shots`;
- player hooks: `tracks`, `shots`;
- runtime script overrides: `tmdb_proxy`, `etor`, seasonal plugins.

## Что важно помнить при поддержке

- Наличие папки в `plugins/` не означает автозагрузку. Это только исходник отдельного plugin-файла.
- Не все плагины заполняют `Lampa.Manifest.plugins`. Для чисто стилевых и служебных скриптов это нормально.
- Naming в старых плагинах не всегда консистентен.
- `dlna` использует `client_dnla` и `plugin_client_dnla`.
- `collections` публикует manifest с одним `component`, но реально использует другие activity names.
- `record` и `radio` конфликтуют по компоненту `radio`.
- Часть плагинов написана как современное расширение через `SettingsApi` и `ContentRows`, а часть - как DOM-patch поверх уже отрендеренного интерфейса. Оба стиля реально присутствуют и должны учитываться при изменениях.
