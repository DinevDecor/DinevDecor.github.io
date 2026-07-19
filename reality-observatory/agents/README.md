# Агенти

Всяка способност на Reality Observatory се добавя тук като независим агент —
никога чрез промяна на `packages/` (виж
[docs/repository-structure.md](../docs/repository-structure.md) и
[ADR-0003](../docs/adr/0003-agent-sdk-and-isolation-model.md)).

## Конвенция

```
agents/<agent-id>/
├── package.json           — зависи само от @reality-observatory/* пакети
├── agent.manifest.json     — статичен манифест (AgentManifest)
└── src/
    └── index.ts             — имплементация на Agent интерфейса
```

- `<agent-id>` е стабилен, уникален идентификатор на целия флот от агенти.
- Комуникацията с останалата система е изцяло през `AgentContext` (bus,
  trust reader, storage, logger, clock) — няма директни импорти между
  папки в `agents/`.
- Trust не се самоприсвоява — Trust Engine е единственият писател на
  `Trust` факти (ADR-0004).

Виж `agents/_example-agent/` за минимален скелет на манифест (без логика).
