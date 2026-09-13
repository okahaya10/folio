import assert from "node:assert/strict";
import { apply, empty, totals, items } from "../lib/domain";
import { makePDF } from "../lib/pdf";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const s = empty("テスト株式会社");
s.company.verified = true;
const one = (price: number) => ({
  description: "家具移動｜坪生 → 緑町",
  price,
  quantity: 1,
  rate: 10,
  unit: "式",
  date: "2026-09-10",
});
assert.equal(
  totals([one(25000), one(25000), one(35000), one(35000)]).total,
  132000,
);
assert.equal(totals([{ ...one(25000), quantity: 2 }]).total, 55000);
assert.equal(totals([one(15), one(15), one(15)]).tax, 4);
assert.throws(() => items([{ ...one(5), quantity: -1 }]));
assert.throws(() => items([{ ...one(5), rate: 12 }]));
assert.equal(totals([one(10000), one(-1000)]).total, 9900);
assert.equal(items([one(-1000)])[0].price, -1000);
const c = apply(
  s,
  { type: "customer", name: "顧客 A", notes: "メモ：要注意先" },
  "owner",
  "owner",
);
assert.equal(s.customers[0].notes, "メモ：要注意先");
apply(
  s,
  {
    type: "presets",
    itemPresets: ["家具移動", "家具移動", "搬入"],
    unitPresets: ["式", "台"],
  },
  "owner",
  "owner",
);
assert.deepEqual(s.company.itemPresets, ["家具移動", "搬入"]);
assert.deepEqual(s.company.unitPresets, ["式", "台"]);
apply(
  s,
  {
    type: "emailTemplates",
    templates: {
      estimate: "{取引先名}へ見積送付",
      invoice: "{書類番号}を送付",
      receipt: "領収書です",
    },
  },
  "owner",
  "owner",
);
assert.equal(s.company.emailTemplates?.estimate, "{取引先名}へ見積送付");
assert.throws(() =>
  apply(
    s,
    {
      type: "document",
      kind: "invoice",
      customerId: c.id,
      date: "2026-09-10",
      items: [one(50000)],
      issue: true,
    },
    "staff",
    "staff",
  ),
);
assert.throws(() =>
  apply(
    s,
    { type: "work", customerId: c.id, date: "2026-09-10", items: [one(50000)] },
    "owner",
    "owner",
  ),
);
const a = {
  type: "document",
  kind: "invoice",
  customerId: c.id,
  date: "2026-09-10",
  items: [one(50000)],
  issue: true,
};
const inv = apply(s, a, "owner", "owner");
assert.equal(s.docs[0].total, 55000);
assert.equal(s.docs[0].due, "");
const invNumber = s.docs.find((d) => d.id === inv.id)!.number;
apply(
  s,
  {
    type: "document",
    id: inv.id,
    kind: "invoice",
    customerId: c.id,
    date: "2026-09-10",
    items: [one(50000), one(-1000)],
    issue: true,
  },
  "owner",
  "owner",
);
assert.equal(s.docs.find((d) => d.id === inv.id)!.number, invNumber);
assert.equal(s.docs.find((d) => d.id === inv.id)!.total, 53900);
apply(s, { type: "sent", id: inv.id }, "owner", "owner");
assert.throws(() =>
  apply(
    s,
    {
      type: "document",
      id: inv.id,
      kind: "invoice",
      customerId: c.id,
      date: "2026-09-10",
      items: [one(1000)],
      issue: true,
    },
    "owner",
    "owner",
  ),
);
assert.throws(() =>
  apply(
    s,
    {
      type: "document",
      kind: "receipt",
      customerId: c.id,
      date: "2026-09-10",
      items: [one(20000)],
      issue: true,
      received: false,
    },
    "owner",
    "owner",
  ),
);
const rec = apply(
  s,
  {
    type: "document",
    kind: "receipt",
    customerId: c.id,
    date: "2026-09-10",
    items: [one(20000)],
    issue: true,
    received: true,
  },
  "owner",
  "owner",
);
assert.equal(s.docs.find((d) => d.id === rec.id)!.total, 22000);
apply(s, { type: "cancel", id: inv.id, reason: "訂正" }, "owner", "owner");
assert.equal(s.docs.find((d) => d.id === inv.id)!.status, "cancelled");
assert.throws(() =>
  apply(s, { type: "cancel", id: inv.id, reason: "再取消" }, "owner", "owner"),
);
assert.throws(() =>
  apply(s, { type: "delete", id: rec.id }, "owner", "owner"),
);
const trash = apply(
  s,
  {
    type: "document",
    kind: "estimate",
    customerId: c.id,
    date: "2026-09-10",
    items: [one(1000)],
    issue: true,
  },
  "owner",
  "owner",
);
apply(s, { type: "cancel", id: trash.id, reason: "削除確認" }, "owner", "owner");
apply(s, { type: "delete", id: trash.id }, "owner", "owner");
assert.equal(
  s.docs.some((d) => d.id === trash.id),
  false,
);
assert.throws(() =>
  apply(s, { type: "delete", id: trash.id }, "owner", "owner"),
);
s.company.name = "改名株式会社";
assert.equal(
  s.docs.find((d) => d.id === inv.id)!.company.name,
  "テスト株式会社",
);
const font = readFileSync("public/fonts/NotoSansJP-Regular.ttf");
const long = {
  ...s.docs.find((d) => d.id === inv.id)!,
  company: {
    ...s.docs.find((d) => d.id === inv.id)!.company,
    address: "広島県福山市テスト町1-2-3",
    phone: "084-000-0000",
    registration: "T8２４０００１０５５７３９",
  },
  items: Array.from({ length: 30 }, (_, i) => ({
    ...one(25000),
    description: `家具家電移動 ${i + 1}｜長い品目の折り返しと日本語の文字を確認するためのテスト明細です。`,
  })),
};
Object.assign(long, totals(long.items));
mkdirSync(".test-output", { recursive: true });
const pdf = await makePDF(long, font);
writeFileSync(".test-output/test.pdf", pdf);
console.log(
  "Domain checks passed; Japanese multipage PDF generated",
  pdf.length,
);
