# Как добавлять плагины

В `lampa-source` есть два рабочих сценария:

- локальный repo-плагин в каталоге `plugins/<name>`;
- внешний URL-плагин, который загружается runtime через `core/plugins`.

Оба сценария используют один и тот же публичный runtime API: `window.Lampa`.

## Публичный контракт плагинов

`src/app.js` публикует в `window.Lampa` основные классы и менеджеры. Для плагинов особенно важны:

- `Lampa.Manifest`
- `Lampa.Component`
- `Lampa.Template`
- `Lampa.SettingsApi`
- `Lampa.ContentRows`
- `Lampa.Activity`
- `Lampa.Listener`
- `Lampa.Player`, `Lampa.PlayerVideo`, `Lampa.PlayerPanel`
- `Lampa.Storage`
- `Lampa.Utils`
- `Lampa.Router`
- `Lampa.Maker`
- `Lampa.Network`

Если плагин требует что-то еще, сначала проверьте, действительно ли это уже экспортируется в `window.Lampa`, а не импортируется только внутренними модулями ядра.

## Вариант 1. Локальный repo-плагин

### Структура

Минимальный шаблон:

```text
plugins/
  my_plugin/
    my_plugin.js
    css/
      style.scss
```

Что ожидает сборщик:

- имя папки и entrypoint-файла должны совпадать;
- `gulpfile.js` ищет `plugins/<folder>/<folder>.js`;
- если есть `css/*.scss`, они компилируются в CSS при `plugins()` и затем могут быть встроены через `@@include('../plugins/<name>/css/style.css')`.

### Типовой lifecycle

Рекомендуемый каркас:

```js
function startPlugin() {
    window.plugin_my_plugin_ready = true

    function add() {
        // регистрация шаблонов, компонентов, кнопок, подписок
    }

    if (window.appready) add()
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') add()
        })
    }
}

if (!window.plugin_my_plugin_ready) startPlugin()
```

Это не единственный возможный стиль, но это самый частый и безопасный pattern в репозитории.

### Что плагин обычно регистрирует

Локальный плагин может использовать любую комбинацию следующих extension points:

- `Lampa.Lang.add(...)` - добавить переводы.
- `Lampa.Template.add(name, html)` - добавить шаблоны.
- `Lampa.Component.add(name, component)` - зарегистрировать экранный компонент.
- `Lampa.SettingsApi.addComponent(...)` и `addParam(...)` - создать секцию в настройках.
- `Lampa.ContentRows.add(...)` - подмешать ряд в `main`, `category`, `bookmarks` и другие экраны.
- `Lampa.Manifest.plugins = manifest` - опубликовать plugin manifest для карточек, контекстного меню и plugin metadata.
- `Lampa.Listener.follow(...)` - встроиться в lifecycle `app`, `full`, `player`, `state:changed` и другие события.

`manifest` нужен не всегда. Он полезен, если плагин должен:

- появляться как media-plugin;
- добавлять действия в контекстное меню карточек;
- сообщать о себе ядру как о plugin entity.

### Примеры из репозитория

- Простой CSS-only вариант: `plugins/twolines/twolines.js`.
- Плагин с menu button и отдельным экраном: `plugins/collections/collections.js`.
- Плагин с системной интеграцией и собственным runtime: `plugins/dlna/dlna.js`.
- Плагин с `ContentRows`, настройками и отдельным режимом приложения: `plugins/iptv/iptv.js`.

### Рекомендации для новых локальных плагинов

- Для новых main/category inserts используйте `Lampa.ContentRows.add(...)`, а не старый `manifest.onMain`.
- Для новых настроек предпочитайте `Lampa.SettingsApi`, а не прямую правку DOM настроек.
- Для новых экранов используйте уже существующие `Lampa.Component`, `Lampa.Maker` и `Lampa.Template`, а не копируйте логику ядра целиком.
- Если нужен version gate, проверяйте `Lampa.Manifest.app_digital`.
- Если плагин зависит от платформы или локали, делайте guard явно в entrypoint.

## Вариант 2. Внешний URL-плагин

Эти плагины не лежат в репозитории. Пользователь подключает URL через экран расширений, а дальше работает `src/core/plugins.js`.

### Как runtime грузит URL-плагин

`core/plugins` делает следующее:

1. Читает локальный список plugins из `Storage.get('plugins', '[]')`.
2. Объединяет его с server-side plugin list из `Account.Api.plugins()`.
3. Применяет blacklist из CUB и `plugins_black_list.json`.
4. Подготавливает URL через `addPluginParams(...)`.
5. Загружает скрипты через `Utils.putScriptAsync(...)`.
6. При успехе кеширует код плагина в IndexedDB.
7. При неудаче пытается поднять код из кеша.

### Что runtime добавляет в URL

Для не-IP адресов `addPluginParams(...)` делает несколько преобразований:

- заменяет старые зеркала на текущее `Manifest.cub_domain`;
- поддерживает placeholders вида `{storage_key}` с base64-encoded значением из `localStorage`;
- добавляет query-параметры `email`, `logged`, `reset`, `origin`;
- переписывает URL под HTTPS, если приложение работает по HTTPS.

Это важно учитывать при проектировании внешнего plugin endpoint.

### Как пользователь подключает URL-плагин

Пользовательский путь проходит через `interaction/extensions/*`:

- экран расширений показывает установленные и доступные plugins;
- `interaction/extensions/add.js` позволяет ввести URL;
- после сохранения объект вида `{ url, status: 1 }` записывается в `Storage`;
- runtime подхватывает его на следующей загрузке приложения.

Отсюда и системное предупреждение: для применения плагина обычно требуется перезапуск приложения.

### Что должен делать внешний плагин

По сути то же, что локальный:

- проверять свой guard-флаг;
- работать через `window.Lampa`;
- регистрировать templates, components, settings, listeners;
- не рассчитывать на bundler-time imports из `src/*`.

Разница только в том, что внешний плагин доставляется по URL, а не собирается `gulp`.

## Практический чек-лист для нового плагина

1. Определите точку встраивания: меню, `full`, player, settings, `ContentRows` или системный runtime.
2. Решите, нужен ли `Lampa.Manifest.plugins`.
3. Если нужен экран, зарегистрируйте компонент через `Lampa.Component.add`.
4. Если нужны настройки, создайте component/params через `Lampa.SettingsApi`.
5. Если нужен row на `main` или `bookmarks`, используйте `Lampa.ContentRows.add`.
6. Добавьте translations и templates до первого использования UI.
7. Подпишитесь на `app ready`, если плагин зависит от уже отрендеренного shell.
8. Если это repo-плагин, соблюдайте naming `plugins/<name>/<name>.js`.
9. Если это URL-плагин, рассчитывайте на то, что runtime добавит свои query-параметры и может загрузить вас из кеша.

## Чего лучше избегать

- Не импортировать внутренние модули ядра из URL-плагина.
- Не ломать уже опубликованный контракт `window.Lampa`.
- Не полагаться на прямую мутацию внутренних DOM-структур, если есть `SettingsApi`, `ContentRows`, `Template` или `Component.add`.
- Не использовать устаревший `manifest.onMain` как основной механизм для новых рядов.
