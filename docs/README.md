# Документация по `lampa-source`

Этот каталог содержит поддерживаемую вручную документацию по устройству клиента `lampa-source`. Она дополняет автогенерируемую документацию из `build/doc`, но не заменяет ее.

## С чего начать

- Архитектору или ревьюеру: читайте [architecture.md](architecture.md), затем [modules.md](modules.md).
- Контрибьютору: читайте [modules.md](modules.md), [code-style-and-change-process.md](code-style-and-change-process.md) и [build.md](build.md).
- Автору плагина: читайте [plugins.md](plugins.md) и [plugin-development.md](plugin-development.md).

## Карта документов

- [architecture.md](architecture.md) - жизненный цикл приложения от `src/app.js`, слои системы и основной runtime-flow.
- [modules.md](modules.md) - карта основных подсистем, их ролей и связей между `core`, `interaction`, `components`, `templates`, `services` и `plugins`.
- [plugins.md](plugins.md) - каталог встроенных плагинов из `plugins/`, их точки интеграции и важные оговорки по поддержке.
- [plugin-development.md](plugin-development.md) - фактический контракт плагинов, структура локального плагина и механизм подключения внешних URL-плагинов.
- [code-style-and-change-process.md](code-style-and-change-process.md) - наблюдаемый стиль кода и практический процесс внесения изменений.
- [build.md](build.md) - команды разработки, устройство `gulp`-пайплайна, упаковка и CI.

## Смежные источники

- [../UPGRADE.md](../UPGRADE.md) - миграция на 3.x и переход на модульную систему `Lampa.Maker`.
- `npm run doc` - генерация отдельной техдокументации из `@doc`-комментариев в `build/doc`.
