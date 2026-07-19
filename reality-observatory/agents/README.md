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

Виж `agents/_example-agent/` за минимален скелет на манифест (без логика) и
`agents/ri-001-reference-watch/` за пълна, работеща референтна имплементация
(RI-001) — деминистричен сценарий, който преминава през целия pipeline от
Sensor Registry до Domain Trust Update и служи като постоянен regression
test за архитектурата (ADR-0001…0011). RI-001 не е производствен агент;
кодовата база в него (in-memory fixtures за Event Bus/Sensor Registry/Trust
Engine) съществува единствено за да направи контрактите изпълними в тестове.
