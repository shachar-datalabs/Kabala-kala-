# קבלה קלה

מערכת פרטית בעברית לניהול לקוחות, טיוטות קבלה וחשבונית עסקה והיסטוריה תפעולית לעוסק פטור. המערכת פועלת כרגע ב־SAFE MODE: היא אינה מפיקה מסמך מס אמיתי ואינה פונה ל־EasyCount.

## Stack

- Vinext / Next App Router, React 19 ו־TypeScript
- Tailwind CSS ורכיבי shadcn
- Cloudflare Worker דרך ChatGPT Sites
- Cloudflare D1 עם Drizzle ORM
- Zod לוולידציה בצד השרת ובדפדפן
- אימות וזהות משתמש באמצעות שכבת הגישה הפרטית של Sites וה־header המאומת `oai-authenticated-user-id`

## דרישות, התקנה ופיתוח

- Node.js 22.13 ומעלה
- npm
- ב־Windows משתמשים בפקודות `*:local`. סקריפטי Sites הרגילים מיועדים ל־builder של Linux.

```bash
npm install
npm run dev
```

הפרויקט אינו תלוי בנתיב זמני כגון `/workspace/sites/...`. כל הקוד, הסכימה והמיגרציות נמצאים ב־repository.

## בדיקות ו־build

ב־Windows:

```bash
npm run build:local
npm run lint:local
npm run typecheck
npm run test:local
```

ב־Sites/Linux:

```bash
npm run build
npm run lint
npm test
```

## Database ומיגרציות

ה־binding של D1 נקרא `DB` ומוגדר ב־`.openai/hosting.json`. הסכימה נמצאת ב־`db/schema.ts` והמיגרציות תחת `drizzle/`.

- `businesses` — הגדרות העסק, רשומה אחת לכל משתמש
- `clients` — לקוחות עם מחיקה רכה לשמירת ההיסטוריה
- `business_documents` — מסמכים וטיוטות; נשמרה הטבלה הקיימת לצורך תאימות
- `payments` — metadata תפעולי מינימלי; ללא מספר כרטיס מלא, CVV או תוקף
- `audit_logs` — פעולות משמעותיות ללא secrets

כל הרשומות משויכות ל־`owner_user_id`. כל query מסונן בצד השרת לפי המשתמש המאומת; ה־frontend אינו קובע `userId`.

```bash
npm run db:generate
```

אין לערוך או להחיל migration הרסנית ללא גיבוי ואישור מפורש.

## Environment variables

העתיקו את `.env.example` לסביבת פיתוח מקומית מתאימה, אך לעולם אין לבצע commit ל־`.env` או `.dev.vars` אמיתי.

| משתנה | תפקיד | ברירת מחדל בטוחה |
| --- | --- | --- |
| `EASYCOUNT_ENABLED` | מאפשר בכלל ניסיון הפקה | `false` |
| `EASYCOUNT_ALLOW_PRODUCTION` | אישור מפורש נוסף להפעלה מול Production | `false` |
| `EZCOUNT_BASE_URL` | כתובת השירות | `https://demo.ezcount.co.il` |
| `EZCOUNT_API_KEY` | secret בצד השרת | ריק |
| `EZCOUNT_DEVELOPER_EMAIL` | מזהה המפתח באינטגרציה הקיימת | ריק |
| `SITE_ORIGIN` | origin מקומי/מורשה | `http://localhost:3000` בדוגמה |

Secrets מוגדרים רק במערכת ה־Secrets של סביבת האירוח. אין לחשוף אותם ב־client bundle, בלוגים, בתשובת API או ב־Git.

## SAFE MODE

`EASYCOUNT_ENABLED=false` הוא ברירת המחדל והמצב הנדרש כרגע:

- לא נשלחת שום בקשה ל־EasyCount
- לא נוצר מספר מסמך רשמי או PDF רשמי
- הפעולה במסך יוצרת Draft בלבד ב־D1
- ה־UI מציג במפורש שמדובר בטיוטה

גם אם קיים API key בסביבה, החיבור חסום כל עוד הדגל אינו בדיוק `true`. סביבת Production דורשת בנוסף `EASYCOUNT_ALLOW_PRODUCTION=true` וכתובת מדויקת של EasyCount Production.

## EasyCount

כל הגישה מרוכזת תחת `services/easycount`. קיימת הכנה ל־`createReceipt`, `getDocument` ו־`getDocumentPdf`; פעולות הקריאה נשארו TODO עד לאימות endpoints ומבני response בתיעוד הרשמי. אין להמציא endpoints או שדות.

מנגנון idempotency שומר מזהה עסקי בטבלת המסמכים ומונע יצירה כפולה בלחיצה חוזרת. מסמך מסומן כ־`issued` רק לאחר תשובת הצלחה מלאה.

## Authentication ואבטחה

- האתר נשאר פרטי באמצעות מדיניות הגישה של Sites.
- API routes מחזירים `401` ב־production ללא זהות מאומתת.
- נתוני לקוחות, עסק, מסמכים ותשלומים מסוננים לפי המשתמש בצד השרת.
- validation מתבצע שוב בשרת עם Zod.
- שגיאות למשתמש בעברית; פרטים טכניים נשארים בשרת וללא secrets.
- מחיקת לקוח היא ארכוב ולכן מסמכים היסטוריים אינם נשברים.

## Deployment

הפרויקט מיועד להיבנות מ־GitHub באמצעות ChatGPT Sites/Cloudflare. לפני פריסה:

1. להריץ build, lint, typecheck ו־tests.
2. לבדוק diff, migrations ו־secrets.
3. לוודא שמדיניות הפרטיות לא השתנתה ושדגלי EasyCount תואמים לסביבה המאושרת.
4. להגדיר secrets בממשק האירוח בלבד.

אין לבצע deployment אוטומטי כחלק משינוי קוד. הפריסה נעשית רק לאחר בדיקה ואישור, ללא שינוי כתובת האתר הקיימת.
