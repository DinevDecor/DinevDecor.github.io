# Структура на репозиторията

```
reality-observatory/
├── README.md                    — входна точка, обзор на архитектурата
├── package.json                 — npm workspaces root (packages/*, agents/*)
├── tsconfig.base.json           — споделена TS конфигурация
├── docs/
│   ├── adr/                     — архитектурни решения (ADR-0001 … 0010)
│   ├── ontology.md              — визуална референция на онтологията
│   └── repository-structure.md  — този документ
├── packages/                    — ядрото (kernel); стабилно, рядко се променя
│   ├── ontology/                — @reality-observatory/ontology
│   ├── event-bus/                — @reality-observatory/event-bus
│   ├── trust-engine/              — @reality-observatory/trust-engine
│   ├── sensor-registry/           — @reality-observatory/sensor-registry
│   ├── agent-sdk/                — @reality-observatory/agent-sdk
│   └── correlation-engine/        — @reality-observatory/correlation-engine
└── agents/                      — всеки независимо разработван агент
    └── _example-agent/           — скелет, показващ конвенцията
```

## Принципи

1. **`packages/` е ядрото.** Съдържа само контрактите, дефинирани в
   ADR-0001…0010: онтология, event bus, trust engine, sensor registry,
   agent SDK, correlation engine. Не съдържа логика, специфична за конкретен
   домейн или агент. Промяна тук засяга всички агенти едновременно и минава
   през ADR/preview процес.

2. **`agents/` е мястото за всичко останало.** Всеки агент:
   - живее в собствена подпапка `agents/<agent-id>/`,
   - има собствен `package.json`, зависещ единствено от `packages/*` пакетите
     (`@reality-observatory/ontology`,
     `@reality-observatory/event-bus`,
     `@reality-observatory/trust-engine` и
     `@reality-observatory/sensor-registry` за read достъп,
     `@reality-observatory/agent-sdk`),
   - декларира `agent.manifest.json`, валидиран срещу `AgentManifest` типа,
   - никога не импортира директно от друга папка в `agents/` — единствената
     разрешена комуникация между агенти е през Event Bus (ADR-0001).
   - има собствен release цикъл, CI и версия — независим от останалите
     агенти и от ядрото.

3. **Correlation Engine инстанции не живеят в `agents/`.** Те имплементират
   `CorrelationEngine` от `@reality-observatory/correlation-engine`, не
   `Agent` от `agent-sdk` — конвенцията за тях (папка, манифест, регистрация
   по `domain`) е отделна и е предмет на ADR-0010; runtime-ът гарантира
   точно едно авторитетно instance на домейн.

4. **Всяка нова способност на системата = нов агент в `agents/`, не нов код
   в `packages/`.** Ако усещаш нужда да добавиш логика в `packages/`, това е
   сигнал, че всъщност трябва нов агент/correlation engine или разширение на
   онтологията (изисква ADR).

5. **Governance на ядрото.** Промяна в `packages/ontology` (нов тип поле,
   нов ontology тип), в `EventBus`/`Topics`, `TrustEngine`,
   `SensorRegistry`, `AgentManifest` или `CorrelationEngine` контракта
   изисква нова или обновена ADR — виж `docs/adr/`.

## Добавяне на нов агент — checklist

1. Създай `agents/<agent-id>/` с `package.json` и `agent.manifest.json`
   (виж `agents/_example-agent/` за скелет).
2. Декларирай в манифеста: `io.consumesTopics`, `io.producesTopics`,
   `capabilities`, `sandbox`.
3. Имплементирай `Agent` интерфейса от `@reality-observatory/agent-sdk`.
4. Не пипай `packages/` — ако ти трябва нов ontology тип или капабилити,
   отвори предложение за ADR.

## Watch агенти

Първата категория агенти, планирана върху тази основа, е „Watch" —
агенти, които притежават Sensor-и (регистрирани през Sensor Registry),
публикуват Signal/Evidence и по избор предлагат Hypothesis за даден домейн.
Архитектурата (ADR-0001…0011) е доказано достатъчна за разработката на
Watch агент: `agents/ri-001-reference-watch/` (RI-001) е работеща,
детерминистична референтна имплементация, която преминава през целия
pipeline — Sensor Registry → Signal → Evidence → Event → Hypothesis →
Prediction → Outcome → Domain Trust Update — и служи като постоянен
regression test за архитектурата. Нов Watch агент може да следва нейната
структура (манифест, Agent имплементация, companion Correlation Engine за
своя домейн), без да е нужна промяна в `packages/`.
