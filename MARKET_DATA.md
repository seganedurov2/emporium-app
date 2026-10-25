# Глобальный рынок Pawn Pleasure — Полные данные

> **Валюта отображения:** все суммы в интерфейсе показываются в биткоинах (₿) по реальному рыночному курсу BTC/USD (`src/currency.ts` — CoinGecko/Coinbase/Binance/Kraken, кэш 5 мин). Внутренняя экономика игры хранится в долларах; значения ниже — внутренние долларовые цены, которые движок конвертирует в ₿ при отображении.

Экспортировано из исходного кода (`slaveContractsEngine.ts`, `gameEngine.ts`)

---

## 1. Все регионы и цены

| № | Регион | ID | Спрос | Тир | Low ($) | Medium ($) | High/Элита ($) |
|---|--------|-----|-------|-----|---------|------------|----------------|
| 1 | Ближний Восток и Кавказ | `05_middle_east` | 0.95 | **high** | 13,800 | 27,600 | 50,600 |
| 2 | Северная Африка и Сахель | `06_north_africa` | 0.95 | **high** | 13,800 | 27,600 | **50,600** ← Премиум |
| 3 | Западная Европа и Скандинавия | `03_western_europe` | 0.90 | **high** | 13,320 | 26,640 | 48,840 |
| 4 | Восточная Азия | `11_east_asia` | 0.85 | **high** | 12,840 | 25,680 | 47,080 |
| 5 | Диаспора рома | `15_roma` | 0.65 | medium | 11,160 | 22,320 | 40,920 |
| 6 | Еврейская диаспора | `16_jewish_diaspora` | 0.70 | medium | 11,520 | 23,040 | 42,240 |
| 7 | Австралия и Океания | `14_australia_oceania` | 0.60 | medium | 10,800 | 21,600 | 39,600 |
| 8 | Северная Америка и Карибы | `01_north_america` | 0.60 | medium | 10,800 | 21,600 | 39,600 |
| 9 | Юго-Восточная Азия | `13_southeast_asia` | 0.55 | medium | 10,440 | 20,880 | 38,280 |
| 10 | Восточная и Южная Африка | `09_east_south_africa` | 0.50 | medium | 10,080 | 20,160 | 36,960 |
| 11 | Южная Азия | `12_south_asia` | 0.50 | medium | 10,080 | 20,160 | 36,960 |
| 12 | Центральная Азия и Сибирь | `10_central_asia` | 0.45 | medium | 9,720 | 19,440 | 35,640 |
| 13 | Восточная Европа и Балканы | `04_eastern_europe` | 0.40 | low | 9,360 | 18,720 | 34,320 |
| 14 | Южная Америка | `02_south_america` | 0.35 | low | 9,000 | 18,000 | 33,000 |
| 15 | Западная Африка | `07_west_africa` | 0.20 | low | 7,920 | 15,840 | 29,040 |
| 16 | Центральная Африка | `08_central_africa` | 0.15 | low | **7,560** | **15,120** | **27,720** ← Дешевле всего |

**Базовые цены по качеству** (до множителя спроса):
- Low: $6,000
- Medium: $12,000
- High: $22,000

**Формула**: `price = basePrice * (0.4 + demand * 1.2)`

---

## 2. Премиальный рынок сбыта

**Регион**: `06_north_africa` (Северная Африка и Сахель) — спрос 0.95

Цены при продаже элитных рабов на премиальном рынке:
- Low: $13,800
- Medium: $27,600
- **High (Элита): $50,600**

---

## 3. Арбитраж: Покупка в источнике → Продажа в премиуме

| Маршрут | Low ROI | Medium ROI | High/Элита ROI |
|---------|---------|------------|----------------|
| 08_central_africa → 06_north_africa | **82%** | **82%** | **82%** |
| 08_central_africa → 05_middle_east | 82% | 82% | 82% |
| 08_central_africa → 03_western_europe | 76% | 76% | 76% |
| 08_central_africa → 11_east_asia | 69% | 69% | 69% |
| 07_west_africa → 06_north_africa | 74% | 74% | 74% |
| 07_west_africa → 05_middle_east | 74% | 74% | 74% |
| 07_west_africa → 03_western_europe | 68% | 68% | 68% |
| 07_west_africa → 11_east_asia | 62% | 62% | 62% |

*При покупке лота применяется скидка 15% (cost = pricePerHead * 0.85)*

---

## 4. Элитные рабы (quality = 'high')

### Генерация (`generateSlaveCharacter` в `gameEngine.ts:418-473`)

```typescript
const qualityMult = quality === 'high' ? 0.7 : quality === 'medium' ? 0.45 : 0.2;
const skill = Math.max(5, Math.floor((Math.random() * 40 + 20) * qualityMult));
// high: skill = 14-42 (база 20-60 * 0.7)

const submission = quality === 'high' ? Math.floor(Math.random() * 25 + 60);
// high: submission = 60-85

const loyalty = Math.floor(Math.random() * 20 + 10); // 10-30 для всех рабов
```

### Характеристики элитного раба:
| Параметр | Значение |
|----------|----------|
| **submission** | 60-85 (высокая повиновенность) |
| **skill** | 14-42 (после множителя 0.7) |
| **loyalty** | 10-30 (низкая, требует "лома") |
| **healthLevel** | Fair (exactHealth: 70) |
| **exhaustionLevel** | Tired (exactExhaustion: 40) |
| **role** | "Пойманная элита (раб)" |
| **price** | skill * 120 + random(0-3000) ≈ $4,680-$8,040 закупка |
| **assignedVenue** | pleasure_house |

### Оценка стоимости (`marketValueOf` в `slaveContractsEngine.ts:147-154`)

```typescript
// 1. Определяем тир по score = submission * 0.6 + skill * 0.4
// high tier: score >= 70

// 2. Базовая цена тира на премиальном рынке (06_north_africa)
// high tier = $50,600

// 3. Интерполяция внутри тира: 0.85x — 1.15x
// withinTier = (score - 70) / (100 - 70)  // 0..1
// finalPrice = tierPrice * (0.85 + withinTier * 0.3)
```

**Примеры оценки элитного раба на премиальном рынке:**
| submission | skill | score | withinTier | Оценка |
|------------|-------|-------|------------|--------|
| 60 | 20 | 44 | — | medium tier ($22,320-30,120) |
| 70 | 30 | 54 | — | medium tier |
| 80 | 35 | 62 | — | medium tier |
| 85 | 40 | **67** | — | medium tier (граница) |
| 85 | 42 | **69.8** | — | medium tier |
| 85 | 45 | **72** | 0.07 | **$50,600 * 0.87 = $44,022** |
| 90 | 50 | **76** | 0.20 | **$50,600 * 0.91 = $46,046** |
| 95 | 60 | **81** | 0.37 | **$50,600 * 0.96 = $48,576** |
| 100 | 70 | **88** | 0.60 | **$50,600 * 1.03 = $52,118** |
| 100 | 100 | **100** | 1.00 | **$50,600 * 1.15 = $58,190** |

---

## 5. Пороги качества (`QUALITY_TIER_FLOOR`)

| Тир | Минимальный score | submission (при skill=0) | skill (при submission=0) |
|-----|-------------------|--------------------------|--------------------------|
| Low | 0 | 0 | 0 |
| Medium | 45 | 75 | 113 |
| **High** | **70** | **117** | **175** |

*Score = submission × 0.6 + skill × 0.4*

---

## 6. Страны по регионам (для генерации профилей)

Ключевые пулы:
- **05_middle_east**: 19 стран (Саудовская Аравия, ОАЭ, Иран, Израиль, Турция и др.)
- **06_north_africa**: 12 стран (Египет, Марокко, Алжир, Тунис, Ливия, Судан и др.)
- **03_western_europe**: 24 страны (Германия, Франция, Великобритания, Италия, Испания и др.)
- **11_east_asia**: 6 стран (Китай, Япония, Кореи, Тайвань, Монголия)
- **07_west_africa**: 12 стран (Нигерия, Гана, Сенегал, Кот-д'Ивуар и др.)
- **08_central_africa**: 8 стран (ДР Конго, Ангола, Камерун, Габон и др.)

---

## 7. JSON для импорта

```json
{
  "regions": [
    {"id":"05_middle_east","name":"Ближний Восток и Кавказ","demand":0.95,"tier":"high","prices":{"low":13800,"medium":27600,"high":50600}},
    {"id":"06_north_africa","name":"Северная Африка и Сахель","demand":0.95,"tier":"high","prices":{"low":13800,"medium":27600,"high":50600}},
    {"id":"03_western_europe","name":"Западная Европа и Скандинавия","demand":0.90,"tier":"high","prices":{"low":13320,"medium":26640,"high":48840}},
    {"id":"11_east_asia","name":"Восточная Азия","demand":0.85,"tier":"high","prices":{"low":12840,"medium":25680,"high":47080}},
    {"id":"15_roma","name":"Диаспора рома","demand":0.65,"tier":"medium","prices":{"low":11160,"medium":22320,"high":40920}},
    {"id":"16_jewish_diaspora","name":"Еврейская диаспора","demand":0.70,"tier":"medium","prices":{"low":11520,"medium":23040,"high":42240}},
    {"id":"14_australia_oceania","name":"Австралия и Океания","demand":0.60,"tier":"medium","prices":{"low":10800,"medium":21600,"high":39600}},
    {"id":"01_north_america","name":"Северная Америка и Карибы","demand":0.60,"tier":"medium","prices":{"low":10800,"medium":21600,"high":39600}},
    {"id":"13_southeast_asia","name":"Юго-Восточная Азия","demand":0.55,"tier":"medium","prices":{"low":10440,"medium":20880,"high":38280}},
    {"id":"09_east_south_africa","name":"Восточная и Южная Африка","demand":0.50,"tier":"medium","prices":{"low":10080,"medium":20160,"high":36960}},
    {"id":"12_south_asia","name":"Южная Азия","demand":0.50,"tier":"medium","prices":{"low":10080,"medium":20160,"high":36960}},
    {"id":"10_central_asia","name":"Центральная Азия и Сибирь","demand":0.45,"tier":"medium","prices":{"low":9720,"medium":19440,"high":35640}},
    {"id":"04_eastern_europe","name":"Восточная Европа и Балканы","demand":0.40,"tier":"low","prices":{"low":9360,"medium":18720,"high":34320}},
    {"id":"02_south_america","name":"Южная Америка","demand":0.35,"tier":"low","prices":{"low":9000,"medium":18000,"high":33000}},
    {"id":"07_west_africa","name":"Западная Африка","demand":0.20,"tier":"low","prices":{"low":7920,"medium":15840,"high":29040}},
    {"id":"08_central_africa","name":"Центральная Африка","demand":0.15,"tier":"low","prices":{"low":7560,"medium":15120,"high":27720}}
  ],
  "premiumMarketRegion": "06_north_africa",
  "basePrices": {"low":6000,"medium":12000,"high":22000},
  "qualityMultipliers": {"low":0.2,"medium":0.45,"high":0.7},
  "qualityThresholds": {"low":0,"medium":45,"high":70}
}
```