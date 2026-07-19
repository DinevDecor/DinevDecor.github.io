# Структура на репозиторията

```
reality-observatory/
├── README.md                    — входна точка, обзор на архитектурата
├── package.json                 — npm workspaces root (packages/*, agents/*)
├── tsconfig.base.json           — споделена TS конфигурация
├── docs/
│   ├── adr/                     — архитектурни решения (ADR-0001 … 0004)
│   ├── ontology.md              — визуална референция на онтологията
│   └── repository-structure.md  — този документ
├── packages/                    — ядрото (kernel); стабилно, рядко се променя
│   ├── ontology/                — @reality-observatory/ontology
│   ├── event-bus/                — @reality-observatory/event-bus
│   ├── trust-engine/              — @reality-observatory/trust-engine
│   └── agent-sdk/                — @reality-observatory/agent-sdk
└── agents/                      — всеки независимо разработван агент
    └── _example-agent/           — скелет, показващ конвенцията
```

## Принципи

1. **`packages/` е ядрото.** Съдържа само контрактите, дефинирани в
   ADR-0001…0004: онтология, event bus, trust engine, agent SDK. Не съдържа
   логика, специфична за конкретен домейн или агент. Промяна тук засяга
   всички агенти едновременно и минава през ADR/preview процес.

2. **`agents/` е мястото за всичко останало.** Всеки агент:
   - живее в собствена подпапка `agents/<agent-id>/`,
   - има собствен `package.json`, зависещ единствено от `packages/*` пакетите
     (`@reality-observatory/ontology`, `@reality-observatory/event-bus`,
     `@reality-observatory/trust-engine` за read достъп,
     `@reality-observatory/agent-sdk`),
   - декларира `agent.manifest.json`, валидиран срещу `AgentManifest` типа,
   - никога не импортира директно от друга папка в `agents/` — единствената
     разрешена комуникация между агенти е през Event Bus (ADR-0001).
   - има собствен release цикъл, CI и версия — независим от останалите
     агенти и от ядрото.

3. **Всяка нова способност на системата = нов агент в `agents/`, не нов код
   в `packages/`.** Ако усещаш нужда да добавиш логика в `packages/`, това е
   сигнал, че всъщност трябва нов агент или разширение на онтологията
   (изисква ADR).

4. **Governance на ядрото.** Промяна в `packages/ontology` (нов тип поле,
   нов ontology тип), в `EventBus`/`Topics` контракта, или в
   `TrustEngine`/`AgentManifest` контракта изисква нова или обновена ADR —
   виж `docs/adr/`.

## Добавяне на нов агент — checklist

1. Създай `agents/<agent-id>/` с `package.json` и `agent.manifest.json`
   (виж `agents/_example-agent/` за скелет).
2. Декларирай в манифеста: `io.consumesTopics`, `io.producesTopics`,
   `capabilities`, `sandbox`.
3. Имплементирай `Agent` интерфейса от `@reality-observatory/agent-sdk`.
4. Не пипай `packages/` — ако ти трябва нов ontology тип или капабилити,
   отвори предложение за ADR.
