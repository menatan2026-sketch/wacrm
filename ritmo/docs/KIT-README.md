<div dir="rtl" lang="he">

# ערכת הפתיחה של ריטמו ל־Claude Code

התיקייה הזו מכילה את כל מה ש־Claude Code צריך כדי לבנות את ריטמו: אפיון המוצר המלא, ספר המותג, מערכת התנועה, טוקני העיצוב, הלוגואים, הגופנים, הרכיבים וחמישה מסכי ייחוס.

## איך משתמשים

1. מחלצים את קובץ ה־ZIP לתיקייה ריקה. זו תהיה תיקיית הפרויקט.
2. פותחים טרמינל בתיקייה ומריצים `claude`.
3. כותבים את ההודעה הראשונה:

   > Read CLAUDE.md and all files it lists, then start Phase 0.

Claude Code קורא את `CLAUDE.md` אוטומטית בכל שיחה. הקובץ מפנה לאפיון, למותג ולמסכים, וקובע את הכללים: עבודה בשלבים, עצירה לאישור שלך אחרי כל שלב, שימוש בטוקנים בלבד, עברית ו־RTL מלאים ושקיפות מלאה במעקב אחרי המחשב.

**פקודות מוכנות:** `/phase 1` מריץ את שלב 1 לפי האפיון. `/design-review` בודק את הממשק מול ספר המותג.

**לפני שמתחילים**, כדאי לעבור על `docs/PRODUCT_SPEC.md` ולעדכן את קהל היעד ואת מערכות השכר אם צריך.

## מה בפנים

| תיקייה | תוכן |
| --- | --- |
| `CLAUDE.md` | ההוראות הקבועות ל־Claude Code |
| `docs/PRODUCT_SPEC.md` | אפיון המוצר המלא ושלבי הבנייה |
| `docs/brand/` | ספר המותג (אנגלית ועברית), מערכת התנועה, לוגואים, כללי שימוש ב־15 רכיבים וגלריית רכיבים |
| `docs/screens/` | חמישה מסכי ייחוס ב־HTML, כולל לוח אינטראקטיבי של מצבים ואנימציות, וצילומים במצב בהיר וכהה |
| `design/` | טוקנים (JSON ו־CSS), ערכת נושא ל־Tailwind v4, CSS של רכיבים ותנועה, הגדרות אנימציה ל־React ול־React Native, וגופנים |

</div>

---

# Ritmo starter kit for Claude Code

Everything Claude Code needs to build Ritmo: the product spec, brand book, motion system, design tokens, logos, fonts, components and five reference screens.

1. Unzip into an empty folder (this becomes the project root).
2. Run `claude` in that folder.
3. First message: **"Read CLAUDE.md and all files it lists, then start Phase 0."**

`CLAUDE.md` is loaded automatically in every session and points to everything else. Commands: `/phase <n>`, `/design-review`.

Fonts: IBM Plex Sans Hebrew and IBM Plex Mono, SIL Open Font License 1.1 (the wordmark is drawn from Rubik, OFL). Logos and brand assets: © Ritmo.
