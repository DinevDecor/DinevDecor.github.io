# ADR-0010: Correlation Engine като независим пакет

## Статус

Приета

Разширява: [ADR-0001](0001-architectural-style-and-system-boundaries.md),
[ADR-0006](0006-hypothesis-and-domain-scoping.md)

Разширена от: [ADR-0011](0011-type-enforced-constitutional-boundaries.md) (CorrelationEventBus — type-enforced publish surface)

## Контекст

Кой всъщност превръща Evidence в Event? ADR-0002 описва Event като
„произведен чрез корелация на Evidence", но никога не е дефинирало кой
компонент носи тази отговорност или как се предотвратява конфликт, когато
няколко агента се опитват да произведат различни, взаимно противоречащи
Event факти за един и същ subject в един и същ домейн.

Ако корелацията се третираше просто като поредната способност на произволен
Agent (ADR-0003), нищо не би попречило на два независими агента да публикуват
конфликтни Event-и за едно и също явление — Event логът би загубил
авторитетност (за разлика от Trust, при която единствеността на писателя
вече е решена в ADR-0004).

## Решение

Въвеждаме **Correlation Engine** — самостоятелен пакет
(`@reality-observatory/correlation-engine`) с публични интерфейси, но
**без** имплементация, аналогично на останалите kernel пакети.

Ключово архитектурно решение: Correlation Engine **не е обикновен Agent**.
Той е отделна абстракция, защото носи по-силна гаранция от произволен
агент — **domain exclusivity**: за даден `domain`, runtime-ът позволява
регистрацията на точно един авторитетен Correlation Engine instance,
аналогично на начина, по който Sensor Registry гарантира уникалност на
`SensorId` (ADR-0005) и Trust Engine е единственият писател на `Trust`
(ADR-0004). Затова контрактът му е отделен, а не просто `Agent`
имплементация:

- **`CorrelationManifest`** — статична декларация: `id`, `domain` (единствен
  домейн, за който instance-ът е авторитетен), `version`, `owner`,
  `consumesTopics` (Evidence/Hypothesis топици за неговия домейн),
  `producesTopics` (ограничени до `event.<domain>` и `hypothesis.<domain>`
  за собствения му домейн — не може да произвежда Event/Hypothesis в чужд
  домейн), `capabilities`, `sandbox`, `resourceProfile`. Runtime-ът отхвърля
  регистрация на втори instance със същия `domain`.
- **`CorrelationContext`** — инжектиран достъп: `bus`, `trust` (read),
  `sensorRegistry` (read — за да претегли Evidence спрямо статуса/качеството
  на източника), `storage`, `logger`, `clock`, плюс `domain`, обвързан към
  манифеста. Структурно прилича на `AgentContext`, но е дефиниран
  самостоятелно в този пакет, а не преизползван от `agent-sdk` — Correlation
  Engine нарочно не зависи от Agent SDK, за да не намеква, че е частен
  случай на Agent.
- **`CorrelationEngine`** — lifecycle интерфейс, типизиран директно към
  ontology факти вместо към суров `EventEnvelope`: `onInit(context)`,
  `onStart()`, `onEvidence(evidence: Evidence)`,
  `onHypothesis?(hypothesis: Hypothesis)` (опционално консумиране на
  съществуващи хипотези), `onHealthCheck()`, `onShutdown()`. По-тесен и
  по-строг от generic `Agent.onEvent(envelope)`, защото единствената му
  работа е ontology-level корелация, не generic event handling.

## Последствия

**Положителни:**

- Един авторитетен производител на Event/Hypothesis на домейн — Event логът
  остава недвусмислен и непротиворечив.
- Ясно разделена отговорност: Correlation Engine превръща Evidence в
  Event/Hypothesis; всичко останало (Sensor управление, Predictions, Trust)
  си остава в другите вече дефинирани компоненти.
- Watch агенти могат да се съсредоточат върху производство на Evidence,
  без да носят отговорност за окончателната корелация в Event.

**Отрицателни / компромиси:**

- Нов вид non-agent компонент за регистриране и enforce-ване на domain
  exclusivity от runtime-а (аналогично на Sensor Registry unique-id
  enforcement).
- Смяна на домейн-собственик (напр. подмяна на Correlation Engine
  instance за даден домейн) изисква явен runtime процес по deregistration/
  re-registration, извън обхвата на тази ADR.

## Разгледани алтернативи

- **Correlation като поредна способност на обикновен Agent** — отхвърлено:
  не гарантира domain exclusivity; няколко агента биха могли да произвеждат
  конфликтни Event-и за едно и също явление.
- **Correlation Engine imports `Agent` interface от `agent-sdk` и просто го
  разширява** — отхвърлено: създава навеждаща зависимост, че Correlation е
  „частен случай на агент", което противоречи на решението, че той носи
  по-силна, различна гаранция (domain exclusivity), enforce-вана от
  runtime-а по начин, различен от обикновена agent регистрация.
- **Единствен глобален Correlation Engine за всички домейни** — отхвърлено:
  различните домейни изискват различни, несравними стратегии за корелация
  (метеорологични аномалии срещу пазарни аномалии); един instance за всичко
  би нарушил принципа за независима разработка и деплой на способности по
  домейн.
