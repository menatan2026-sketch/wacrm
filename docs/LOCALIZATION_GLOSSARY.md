# Localization Architecture & Glossary

> Status: **Draft v0.1 — awaiting owner approval** · Phase 0E
> Languages: **Hebrew (he, RTL)** · **English (en, LTR)** · **Russian (ru, LTR)**. All three ship from day one.
> ⚠️ Every Hebrew and Russian term below is a **proposal**. It must be signed off by a native-speaking reviewer with manufacturing/e-commerce vocabulary before the first customer release (KI-004).

## 1. Architecture

| Concern | Decision |
|---|---|
| Library | `next-intl` (ICU MessageFormat, Server + Client Components; already proven in wacrm) — ADR-0007 |
| Routing | Locale-prefixed paths: `/he/…`, `/en/…`, `/ru/…`. `<html lang dir>` set per locale |
| Default locale | `he` for Israel. Detection order: **(1) explicit user choice (account `preferred_locale` or the `NEXT_LOCALE` cookie) → (2) URL prefix → (3) `Accept-Language` → (4) `he`**. Detection redirects happen only on the first visit to `/`, **never** on a page the user is already viewing (no unexpected switching) |
| Persistence | The switcher writes the cookie immediately and the account preference (if signed in). Emails/notifications use the account preference, falling back to the locale at order time |
| Catalog format | JSON per namespace per locale: `packages/i18n/messages/{locale}/{namespace}.json` |
| Namespaces | `common`, `navigation`, `customer`, `orders`, `quotes`, `supplier`, `admin`, `payments`, `shipping`, `errors`, `validation`, `notifications`, `ai`, `manufacturing`, `materials`, `qc`, `analytics` |
| Keys | Semantic, dot-separated, stable: `orders.status.QC_PENDING.label`, `orders.status.QC_PENDING.description`. Never the English text as the key |
| Hardcoded strings | Forbidden. ESLint rule (`i18next/no-literal-string`-style custom rule) fails CI for JSX text and user-visible attributes (`aria-label`, `title`, `placeholder`, `alt`) |
| Completeness | CI check: every key exists in all three locales with matching ICU arguments; no unused keys; English is the source of truth for structure, not for meaning |
| Pseudo-locale | `en-XA` (accented and +40 % length) and `he-XB` (RTL pseudo) are available in dev/staging to catch truncation and direction bugs |
| Backend messages | The domain returns error **codes**. Only the UI and notification layers translate. Emails/SMS templates live in the `notifications` namespace, with React Email templates rendered per locale |
| Admin-managed content | Material names, descriptions and policy pages are stored per locale in DB translation tables, with a fallback chain `requested → en` that is **flagged** in the admin when used |
| Translation workflow | Developer adds an `en` key + context comment (`// desc:` in a sidecar `*.meta.json`) → the PR is blocked until `he`/`ru` are filled (by a translator or the translation platform) → native review label. A translation-management platform (TMS) is optional from Phase 1 |

## 2. Locale formatting (always via `Intl` / next-intl formatters — never manual concatenation)

| Type | he | en | ru | Rule |
|---|---|---|---|---|
| Currency (ILS) | ‏1,234.50 ₪ | ₪1,234.50 | 1 234,50 ₪ | `Intl.NumberFormat(locale, {style:'currency', currency})`. Currency comes from the data, never the locale |
| Number | 1,234.5 | 1,234.5 | 1 234,5 | `formatNumber` |
| Percent | 35% | 35% | 35 % | `style:'percent'` |
| Date | 29.10.2026 | Oct 29, 2026 | 29.10.2026 | `dateStyle:'medium'`; relative ("in 3 days") via `RelativeTimeFormat` |
| Time | 14:30 | 2:30 PM | 14:30 | `timeStyle:'short'`, timezone `Asia/Jerusalem` default, user override |
| Measurements | 120 × 80 מ״מ | 120 × 80 mm | 120 × 80 мм | `Intl.NumberFormat` + a unit label from i18n; values wrapped in `<bdi>` |
| Input decimals | accept `.` | accept `.` | accept `,` and `.` | The parser normalizes to a canonical decimal |
| Week start | Sunday | Sunday (IL market) | Monday | Locale data; the IL business week is Sun–Thu for SLA calculations (configurable business calendar incl. Israeli holidays) |

Pluralization uses ICU categories: **en** one/other · **ru** one/few/many/other · **he** one/two/other (per CLDR). Every count message must provide all of the locale's categories (CI check).

## 3. RTL / LTR strategy

- **Logical properties only:** `margin-inline`, `padding-inline`, `inset-inline-start`, `border-inline-end`, `text-align: start`. Tailwind logical utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`). Lint bans `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right` in app code.
- `dir` is set on `<html>`. Components never read the locale to decide layout; they use CSS logical properties and a `useDirection()` hook only where JS needs it (drag gestures, carousels, sliders, chart legends).
- **Bidi isolation:** order numbers, file names, emails, URLs, measurements, SKU/material codes (PLA, PETG) and code-like text are wrapped in `<bdi>` or `dir="ltr"` spans to prevent punctuation jumping. Mixed strings use ICU arguments, so word order is translator-controlled.
- **Mirroring:** layout, navigation, drawers (open from inline-end), breadcrumb separators, steppers and progress (fill from inline-start), carousels/swipe direction, and the step transitions in motion all mirror. Directional icons mirror per the [UI_DESIGN_SYSTEM §9](./UI_DESIGN_SYSTEM.md#9-iconography) list.
- **Not mirrored:** the 3D viewer coordinate system (X+ remains to the right), media controls, chart time axes (decision: left-to-right in all locales), phone numbers, numerals, and the brand logo.
- **Tables:** column order follows reading direction (the first column is at the inline-start). Numeric columns align to inline-end.
- **Forms:** labels and errors are inline-start aligned. Phone/email/URL inputs are `dir="ltr"` with `text-align: start` behaviour reviewed per field. Measurement inputs are LTR internally.
- **Test matrix:** see [QUALITY_PLAN §5](./QUALITY_PLAN.md#5-three-language-test-matrix). Every component is snapshotted in `he` RTL.

## 4. Voice and tone

| | Hebrew | English | Russian |
|---|---|---|---|
| Address | **Gender-neutral:** prefer the plural imperative ("העלו קובץ") or infinitive/nominal forms ("העלאת קובץ") over the masculine singular. Avoid slash forms (ה/ת) in UI | "You", friendly, plain | Formal **"вы"** (lowercase in UI), polite, concise. Avoid bureaucratic constructions |
| Tone | Warm, direct, confident | Calm, clear, confident | Respectful, precise, not overly formal |
| Buttons | Verb, infinitive or plural imperative: "קבלת הצעת מחיר", "המשך" | Verb phrase, sentence case: "Get price" | Verb infinitive / imperative: "Узнать цену", "Продолжить" |
| Technical terms | Hebrew term first, Latin code in parentheses where helpful: "פלסטיק PETG" | — | Russian term + Latin code: "пластик PETG" |
| Numbers & units | מ״מ (gershayim U+05F4, not a double quote) | mm | мм |

## 5. Approved terminology (glossary v0.1)

| Concept (EN) | Hebrew (he) | Russian (ru) | Notes / usage |
|---|---|---|---|
| Order | הזמנה | Заказ | — |
| Order number | מספר הזמנה | Номер заказа | Value shown LTR in `<bdi>` |
| Quote | הצעת מחיר | Расчёт стоимости | ru short form "Расчёт" in tight UI. B2B documents: "Коммерческое предложение" |
| Price | מחיר | Цена | — |
| Total (incl. VAT) | סה״כ (כולל מע״מ) | Итого (с НДС) | ru: use "НДС" for VAT; the Israeli context is understood |
| VAT | מע״מ | НДС | — |
| Supplier (internal/admin) | ספק | Поставщик | Internal term |
| Manufacturing partner (customer-facing) | שותף ייצור | Партнёр-производитель | Customers see "manufacturing partner", never the supplier's identity |
| Production Job | עבודת ייצור | Производственное задание | Supplier UI shortens it to "עבודה" / "Задание" |
| Job offer | הצעת עבודה | Предложение задания | Supplier UI |
| Accept / Decline (job) | קבלה / דחייה | Принять / Отклонить | — |
| Design (CAD design work) | תכנון | Проектирование | Service. "Design required" = נדרש תכנון / Требуется проектирование |
| Design (the resulting model) | מודל תלת־ממדי | 3D-модель | — |
| Design approval | אישור תכנון | Утверждение модели | — |
| Revision | גרסה | Версия | Digital part / design revision |
| Material | חומר | Материал | — |
| Color | צבע | Цвет | — |
| Finish | גימור | Отделка | — |
| Manufacturing method | שיטת ייצור | Способ производства | — |
| 3D printing (FDM) | הדפסת תלת־ממד (FDM) | 3D-печать (FDM) | — |
| Quality Control | בקרת איכות | Контроль качества | Short: "QC" stays Latin in admin only |
| Inspection | בדיקה | Проверка | — |
| Passed / Failed (QC) | עבר / נכשל | Пройдено / Не пройдено | — |
| Defect | פגם | Дефект | — |
| Reprint | הדפסה חוזרת | Повторная печать | — |
| Digital Part | חלק דיגיטלי | Цифровая деталь | Library item, Phase 7 |
| Part | חלק | Деталь | — |
| Lead time | זמן אספקה | Срок изготовления | Customer-facing: "delivery estimate" = מועד אספקה משוער / Ориентировочный срок доставки |
| Estimated / Guaranteed | משוער / מובטח | Ориентировочно / Гарантированно | Always label which one |
| Urgency: Standard / Fast / Urgent | רגיל / מהיר / דחוף | Стандартно / Быстро / Срочно | — |
| Dimensions | מידות | Размеры | — |
| Measurement | מדידה | Измерение | — |
| Tolerance | סבולת | Допуск | Advanced mode only |
| Bounding box | תיבה תוחמת | Габариты | ru "габариты" is natural |
| Volume | נפח | Объём | — |
| Upload | העלאה | Загрузка | — |
| File | קובץ | Файл | — |
| Usage / intended use | שימוש מיועד | Назначение | — |
| Indoors / Outdoors | בתוך הבית / בחוץ | В помещении / На улице | — |
| Heat resistance | עמידות בחום | Термостойкость | — |
| Load-bearing | נושא משקל | Несущая нагрузка | Plain question: "Будет ли деталь выдерживать нагрузку?" |
| Flexible | גמיש | Гибкий | — |
| Advanced mode | מצב מתקדם | Расширенный режим | — |
| Layer height | גובה שכבה | Высота слоя | Advanced mode only |
| Infill | מילוי פנימי | Заполнение | Advanced mode only |
| Walls / perimeters | דפנות | Стенки (периметры) | Advanced mode only |
| Supports | תמיכות | Поддержки | Advanced mode only |
| Build volume | נפח הדפסה | Область печати | Supplier/admin |
| Machine / printer | מכונה / מדפסת | Станок / Принтер | ru: "принтер" for FDM, "станок" for CNC |
| Capacity | קיבולת | Загрузка мощностей | Supplier UI: "Свободные мощности" |
| Payout | תשלום לספק | Выплата | Supplier UI: "התשלום שלך" / "Ваша выплата" |
| Payout statement | דוח תשלומים | Выписка по выплатам | — |
| Payment | תשלום | Оплата | — |
| Checkout | תשלום והזמנה | Оформление заказа | — |
| Refund | החזר כספי | Возврат средств | — |
| Cancellation | ביטול | Отмена | — |
| Dispute | מחלוקת | Спор | Admin; the customer sees "בעיה בהזמנה" / "Проблема с заказом" |
| Invoice / tax invoice-receipt | חשבונית / חשבונית מס קבלה | Счёт / Налоговый счёт-квитанция | ⚠️ ru term needs review by an accountant fluent in Russian |
| Shipping / Delivery | משלוח | Доставка | — |
| Tracking | מעקב משלוח | Отслеживание | — |
| Pickup point | נקודת איסוף | Пункт выдачи | — |
| Routing | ניתוב | Маршрутизация | Admin only |
| Gross margin | שיעור רווח גולמי | Валовая маржа | Admin only |
| Contribution margin | רווח תרומתי | Маржинальная прибыль | Admin only |
| Average order value | ערך הזמנה ממוצע | Средний чек | Admin only |
| Touchless order | הזמנה ללא מגע ידני | Заказ без ручной обработки | Admin KPI |
| Needs attention | דורש טיפול | Требует внимания | Admin |
| On hold | בהמתנה | Приостановлен | — |
| AI-suggested | הצעה של AI | Предложено ИИ | Always shown on AI-generated content |
| Draft | טיוטה | Черновик | — |
| Organization | ארגון | Организация | B2B |
| Purchase order | הזמנת רכש | Заказ на закупку | B2B |
| Approval limit | מגבלת אישור | Лимит согласования | B2B |
| Cost center | מרכז עלות | Центр затрат | B2B |

### Order status labels (customer-facing; the admin may show the technical code)

| Status | he | en | ru |
|---|---|---|---|
| DRAFT | טיוטה | Draft | Черновик |
| REQUIREMENTS_PENDING | ממתין לפרטים | Details needed | Нужны данные |
| REVIEW_REQUIRED | בבדיקה שלנו | We're reviewing | На проверке |
| DESIGN_REQUIRED | נדרש תכנון | Design needed | Требуется проектирование |
| DESIGN_IN_PROGRESS | בתכנון | Being designed | Проектируется |
| DESIGN_APPROVAL | ממתין לאישור | Awaiting your approval | Ожидает вашего утверждения |
| QUOTE_READY | הצעת המחיר מוכנה | Quote ready | Расчёт готов |
| PAYMENT_PENDING | ממתין לתשלום | Awaiting payment | Ожидает оплаты |
| PAID | שולם | Paid | Оплачен |
| ROUTING / SUPPLIER_ASSIGNED / SUPPLIER_ACCEPTED | בהכנה לייצור | Preparing production | Подготовка к производству |
| PRODUCTION | בייצור | In production | В производстве |
| QC_PENDING / QC_FAILED / REPRINT_REQUIRED | בבקרת איכות | Quality check | Контроль качества |
| READY_FOR_SHIPMENT | מוכן למשלוח | Ready to ship | Готов к отправке |
| SHIPPED | נשלח | Shipped | Отправлен |
| DELIVERED | נמסר | Delivered | Доставлен |
| COMPLETED | הושלם | Completed | Выполнен |
| CANCELLED | בוטל | Cancelled | Отменён |
| REFUNDED | הוחזר | Refunded | Средства возвращены |
| DISPUTED | בטיפול שירות הלקוחות | With our support team | Рассматривается поддержкой |

Note: several internal states intentionally collapse into one customer label (progressive disclosure). QC failure/reprint is never presented to the customer as "failed". The customer sees "quality check", plus an updated ETA if it changes.

## 6. Text expansion and layout rules
- Design every component with Russian copy first (it's the longest) and test Hebrew for height/line-height.
- Button labels ≤ 3 words in en. Translators get the max-length metadata from `*.meta.json`.
- No text in images. No concatenated sentences. No word-order assumptions (no `t('a') + name + t('b')`).
