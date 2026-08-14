---
description: After a task: scan Jira backlog for similar issues to fix or close
agent: build
---

Выполни анализ Jira backlog после завершения задачи. $ARGUMENTS

## Шаг 1. Прочитай конфиг фильтра
Найди файл `jira-filter.toml`: проверь текущую рабочую директорию, а если файла нет — поднимайся по дереву каталогов вверх (родительские директории), пока файл не будет найден. Если не найден ни на одном уровне — сообщи пользователю и остановись.

Это простой TOML с полями:
- `host` — хост Jira (обязательно);
- `jql` — JQL бэклога (обязательно). Это единственный источник фильтра — сохранённые фильтры Jira не используются.

## Шаг 2. Определи, что было сделано в задаче
- Используй контекст диалога выше (что делалось в сессии).
- Подкрепи фактами: `git log --oneline -10`, `git diff HEAD~1` (или diff незакоммиченных изменений), название ветки, номер задачи из ветки.
- Сформулируй суть фикса: симптом, причина, где исправлено (сервис/модуль), как проявлялась ошибка у пользователя.

## Шаг 3. Получи список задач через REST API (НЕ через UI)
Интерфейс Jira для обхода страниц НЕ использовать: в списке не видны компонент/приоритет/статус, а листание страниц медленное и ненадёжное.

Вместо этого:
1. Открой `{host}` в браузере (chrome-devtools) — нужно только, чтобы сессия была аутентифицирована (куки). Подойдёт любая страница этого хоста.
2. Дёрни REST API из браузерного контекста через `chrome-devtools_evaluate_script` + `fetch` (same-origin, куки подхватятся). Один вызов возвращает ВСЕ задачи фильтра со всеми полями — листать ничего не надо. JQL бери из конфига и кодируй через `encodeURIComponent`:

```js
async () => {
  const res = await fetch('/rest/api/2/search?jql=' + encodeURIComponent(<JQL>) + '&fields=summary,priority,status,components,issuetype&maxResults=200&startAt=0', {headers: {'Accept': 'application/json'}});
  const data = await res.json();
  return {
    total: data.total,
    issues: data.issues.map(i => ({
      key: i.key, type: i.fields.issuetype.name, summary: i.fields.summary,
      priority: i.fields.priority ? i.fields.priority.name : null,
      status: i.fields.status.name,
      components: (i.fields.components || []).map(c => c.name).join(', ')
    }))
  };
}
```

- Если `total` > `maxResults` — повторяй вызов с `startAt += maxResults`, пока не соберёшь все задачи.

## Шаг 4. Детали открывай только для похожих
Сравни суть фикса с каждой задачей по заголовку (симптом / сервис / компонент / причина). Детали (`description`, связи) получай ТОЛЬКО для кандидатов, похожих по заголовку, — одним скриптом через API, а не открытием страниц:

```js
async () => {
  const keys = ['DEV-12345', 'DEV-54321'];
  const out = {};
  for (const key of keys) {
    const res = await fetch('/rest/api/2/issue/' + key + '?fields=summary,description,status,priority,components,issuelinks', {headers: {'Accept': 'application/json'}});
    const data = await res.json();
    out[key] = {
      summary: data.fields.summary,
      status: data.fields.status.name,
      priority: data.fields.priority ? data.fields.priority.name : null,
      description: (data.fields.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2500),
      links: (data.fields.issuelinks || []).map(l => ({type: l.type ? l.type.name : null, key: l.outwardIssue ? l.outwardIssue.key : (l.inwardIssue ? l.inwardIssue.key : null)}))
    };
  }
  return out;
}
```

Заголовок явно не совпадает по смыслу — не запрашивай детали, пропускай задачу.

Критерии сходства (по описанию кандидатов):
- тот же симптом или проявление ошибки;
- тот же сервис/компонент/модуль;
- та же корневая причина (root cause).

## Шаг 5. Классифицируй похожие задачи
Для каждой похожей задачи:
- **Дубликат** — та же проблема, сделанный фикс её уже закрывает → предложи закрыть (Duplicate/Rejected со ссылкой на исходную задачу).
- **Похожая, можно поправить вместе** — проблема не точь-в-точь, но корень/участок кода смежный, и её можно закрыть вместе с текущим фиксом → предложи расширить фикс и закрыть обе задачи одной доработкой.
- **Нужна проверка** — предложи перетестировать после выкатки.
- Задачи, которые не покрываются фиксом (другая причина) — так и пометь в таблице («не связана»), чтобы не было ложных срабатываний.

## Шаг 6. Выполняй только с подтверждением
Выведи таблицу похожих задач с классификацией и предлагаемыми действиями. Не вноси изменения в Jira самостоятельно — сначала покажи план и дождись подтверждения пользователя.
