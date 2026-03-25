# Сборка и упаковка

`lampa-source` собирается через `gulp`, а не через единый webpack/vite pipeline. Основная логика сборки описана в `gulpfile.js`.

## Базовые команды

- `npm install` - устанавливает зависимости для build/test/publish pipeline.
- `npm run start` - запускает `gulp`, то есть watcher и `browser-sync` для локальной разработки.
- `npm run debug` - включает debug-режим сборки с sourcemaps и дополнительными debug-файлами.
- `npm run build` - собирает web-версию в `build/web`.
- `npm run test` - запускает `vitest`.
- `npm run doc` - генерирует отдельную документацию из `@doc`-комментариев в `build/doc`.
- `npm run pack` - упаковывает GitHub-distribution в `build/github/lampa`.

Локально разумно ориентироваться на Node 22.x, потому что именно его использует CI.

## Основные директории пайплайна

- `src/` - исходный код приложения.
- `public/` - статические ресурсы, которые копируются в build.
- `plugins/` - исходники repo-плагинов.
- `dest/` - промежуточные результаты bundling.
- `build/web/` - локальная web-сборка для запуска и отладки.
- `build/github/lampa/` - упакованная GitHub-distribution.
- `build/doc/` - результат `npm run doc`.

## Что делает `npm run build`

`npm run build` вызывает `gulp build`, а тот выполняет цепочку:

1. `merge`
2. `plugins`
3. `sass_task`
4. `lang_task`
5. `sync_web`
6. `build_web`

### `merge`

- Rollup берет entrypoint `src/app.js`.
- Подключаются Babel, CommonJS, Node Resolve и loader для web workers.
- Выходной файл `app.js` кладется в `dest/`.
- На этом этапе остаются placeholders `{__APP_HASH__}` и `{__APP_BUILD__}`, которые подставляются позже.

### `plugins`

- `gulpfile.js` проходит по всем подпапкам `plugins/`.
- Для каждой папки ожидается `plugins/<name>/<name>.js`.
- Если есть `css/*.scss`, вызывается `plugin_sass(...)`, который компилирует SCSS в CSS.
- Затем `bubbleFile(...)` прогоняет plugin JS через Rollup и `gulp-file-include`, чтобы работали `@@include(...)`.
- Результат каждого плагина кладется в `dest/<plugin>/<plugin>.js`.

### `sass_task`

- Компилирует `src/sass/*.scss` в `public/css`.
- Прогоняет CSS через autoprefixer.
- В dev-режиме еще и триггерит live reload в browser-sync.

### `lang_task`

- Копирует `src/lang/*.js` в `public/lang`.
- Эти файлы потом используются для lazy-loading интерфейсных языков.

### `sync_web`

- Копирует статические ресурсы из `public/` в `build/web/`.

### `build_web`

- Берет `dest/app.js`, подставляет hash и build date, затем пишет итоговый `app.js` в `build/web/`.
- Копирует собранные plugin JS из `dest/<plugin>/` в `build/web/plugins/`.

Итог `npm run build` - готовая web-сборка в `build/web`, которую можно отдавать локально через watcher/browser-sync.

## Что делает `npm run start`

`npm run start` вызывает default-task `gulp`, то есть:

- `watch`
- `browser_sync`

Watcher следит за `src/`, `public/`, `plugins/` и при изменениях заново вызывает серию:

- `merge`
- `plugins`
- `sass_task`
- `lang_task`
- `sync_web`
- `build_web`

`browser-sync` поднимает локальный сервер на основе `build/web/`.

## Что делает `npm run debug`

`npm run debug` включает `isDebugEnabled = true`, добавляет sourcemaps и копирует debug-файлы:

- `index/github/lampainit.js`
- `initialSettings.json`, если он есть в рабочем каталоге

Это режим для локального анализа, а не для production-публикации.

## Что делает `npm run pack`

`npm run pack` вызывает `gulp pack_github`, то есть:

1. `sync_github`
2. `uglify_task`
3. `public_github`
4. `write_manifest`
5. `index_github`
6. `plugins_github`

### `sync_github`

Копирует `public/` в `build/github/lampa/`.

### `uglify_task`

На практике эта задача не минифицирует JS, а создает `dest/app.min.js` из `dest/app.js`, предварительно подставляя:

- `{__APP_HASH__}`
- `{__APP_BUILD__}`

### `public_github`

Копирует `dest/app.min.js` в `build/github/lampa/`.

### `write_manifest`

Читает `src/core/manifest.js`, вычисляет:

- `app_version`
- `css_version`
- numeric variants версий
- timestamp
- hash приложения

И записывает это в `index/github/assembly.json`.

### `index_github`

Копирует содержимое `index/github/**/*` в `build/github/lampa/`.

### `plugins_github`

Копирует собранные plugin JS из `build/web/plugins/` в `build/github/lampa/plugins/`.

Итог - GitHub-distribution, которую дальше может использовать внешний publish pipeline.

## Дополнительные packaging tasks

В `gulpfile.js` есть еще:

- `pack_webos`
- `pack_tizen`

Они собирают аналогичные платформенные пакеты, но не привязаны к `npm scripts` по умолчанию.

## Генерация техдокументации

`npm run doc` вызывает:

1. `sync_doc`
2. `buildDoc`

`buildDoc` сканирует `src/`, извлекает `@doc`-комментарии через `doctrine`, собирает `data.json` и `index.html` в `build/doc/`.

Это отдельная документация по API/helpers, а не замена ручным Markdown-документам из `docs/`.

## CI

GitHub Actions workflow лежит в `.github/workflows/npm-gulp.yml`.

Он делает следующее:

1. checkout репозитория;
2. setup Node.js `22.x`;
3. `npm install`;
4. `npm run build`;
5. `npm run pack`;
6. upload артефакта `build/github/lampa`;
7. dispatch события в `lampa-server`.

Важно:

- `lampa-server` здесь упоминается только как downstream publish target;
- сам build и упаковка клиента полностью происходят внутри `lampa-source`.

## Практический минимум проверки после изменений

Если вы меняли документацию, код плагинов или build-пайплайн, минимальный набор команд такой:

```bash
npm test
npm run build
npm run pack
```

Если менялись `@doc`-комментарии, дополнительно имеет смысл проверить:

```bash
npm run doc
```
