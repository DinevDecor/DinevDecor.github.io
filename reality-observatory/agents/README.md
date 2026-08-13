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

Виж `agents/_example-agent/` за минимален скелет на манифест (без логика),
`agents/ri-001-reference-watch/` за пълна, работеща референтна имплементация
(RI-001) — деминистричен сценарий, който преминава през целия pipeline от
Sensor Registry до Domain Trust Update — и `agents/ri-002-multi-sensor/`
(RI-002) — доказва, че Correlation Engine коректно слива Evidence от
няколко независими Sensor-а/агенти в точно едно Event, без нужда от промяна
в `packages/`. И двете са постоянни regression тестове за архитектурата
(ADR-0001…0011), не производствени агенти; кодовата база в тях (in-memory
fixtures за Event Bus/Sensor Registry/Trust Engine) съществува единствено
за да направи контрактите изпълними в тестове.

`agents/oil-regime-watch/` (**PA-001**) е първият производствен Watch
агент — наблюдава EIA седмичния petroleum status report, OPEC+
production announcements, и WTI/Brent спот цени; произвежда реални,
измерими Predictions с explicit invalidation условия и Outcome резолюция.
За разлика от RI-001/RI-002, сценарият тук не е фиксиран, но тестовият му
suite остава напълно детерминиран (fixture adapters вместо реални HTTP
извиквания, тъй като мрежовата политика на текущата среда блокира изходящ
достъп до api.eia.gov). Виж `agents/oil-regime-watch/README.md` и
`docs/OPERATIONS.md` за архитектура, конфигурация и operational runbook.
