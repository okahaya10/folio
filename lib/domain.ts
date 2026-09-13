export type Kind = "estimate" | "invoice" | "receipt";
export type Item = {
  description: string;
  quantity: number;
  unit: string;
  price: number;
  rate: number;
  date: string;
};
export type Customer = {
  id: string;
  name: string;
  email: string;
  address: string;
  contact: string;
  notes: string;
};
export type Doc = {
  id: string;
  kind: Kind;
  number: string;
  customerId: string;
  customer: Customer;
  title: string;
  date: string;
  due: string;
  items: Item[];
  notes: string;
  status: "draft" | "issued" | "cancelled";
  total: number;
  subtotal: number;
  tax: number;
  taxes: Record<string, number>;
  company: Company;
  sentAt?: string;
  reason?: string;
  createdAt: string;
};
export type Company = {
  name: string;
  postalCode: string;
  address: string;
  phone: string;
  email: string;
  registration: string;
  bank: string;
  contact: string;
  stampKey?: string;
  verified: boolean;
  itemPresets?: string[];
  unitPresets?: string[];
  contactPresets?: string[];
  emailTemplates?: Record<Kind, string>;
};
export type State = {
  company: Company;
  customers: Customer[];
  docs: Doc[];
  audit: { id: string; actor: string; action: string; at: string }[];
  processed: string[];
  seq: Record<string, number>;
  demo: boolean;
};
export const labels: Record<Kind, string> = {
  estimate: "見積書",
  invoice: "請求書",
  receipt: "領収書",
};
export const defaultEmailTemplates: Record<Kind, string> = {
  estimate:
    "{取引先名} 御中\n\nお世話になっております。{自社名}です。\n{件名}の{書類名}をお送りいたします。\nご確認のほど、よろしくお願いいたします。",
  invoice:
    "{取引先名} 御中\n\nお世話になっております。{自社名}です。\n{件名}の{書類名}をお送りいたします。\nご確認のうえ、お支払いをお願いいたします。",
  receipt:
    "{取引先名} 御中\n\nお世話になっております。{自社名}です。\n{件名}の{書類名}をお送りいたします。\nご査収のほど、よろしくお願いいたします。",
};
export const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
export const yen = (v: number) => "¥" + v.toLocaleString("ja-JP");
export function text(v: unknown, max = 300) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
export function must(ok: unknown, msg: string): asserts ok {
  if (!ok) throw new Error(msg);
}
export function validDate(v: unknown) {
  const s = text(v);
  must(
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "日付を確認してください",
  );
  return s;
}
export function items(raw: unknown): Item[] {
  must(
    Array.isArray(raw) && raw.length > 0 && raw.length <= 100,
    "明細は1〜100行で入力してください",
  );
  return raw.map((i) => {
    const q = Number(i.quantity),
      p = Number(i.price),
      r = Number(i.rate);
    must(
      text(i.description) &&
        q > 0 &&
        q <= 10000 &&
        Math.abs(q * 100 - Math.round(q * 100)) < 0.00001 &&
        Number.isSafeInteger(p) &&
        p >= -100000000 &&
        p <= 100000000 &&
        [0, 8, 10].includes(r),
      "明細の品目・数量・単価・税率を確認してください",
    );
    return {
      description: text(i.description, 500),
      quantity: q,
      price: p,
      rate: r,
      unit: text(i.unit, 10) || "式",
      date: i.date ? validDate(i.date) : "",
    };
  });
}
export function totals(rows: Item[]) {
  const groups: Record<string, number> = {};
  for (const i of rows) {
    const n = Math.floor((Math.round(i.quantity * 100) * i.price) / 100);
    groups[i.rate] = (groups[i.rate] || 0) + n;
  }
  let subtotal = 0,
    tax = 0;
  const taxes: Record<string, number> = {};
  for (const [r, n] of Object.entries(groups)) {
    subtotal += n;
    taxes[r] = Math.floor((n * Number(r)) / 100);
    tax += taxes[r];
  }
  must(
    subtotal + tax <= 1000000000 && subtotal + tax >= -1000000000,
    "合計金額は10億円以内で入力してください",
  );
  return { subtotal, tax, total: subtotal + tax, taxes };
}
export function empty(name: string, demo = false): State {
  return {
    company: {
      name,
      postalCode: "",
      address: "",
      phone: "",
      email: "",
      registration: "",
      bank: "",
      contact: "",
      verified: false,
      itemPresets: ["家具移動", "家具家電移動", "搬入・設置"],
      unitPresets: ["式", "台", "個", "人", "時間"],
      contactPresets: [],
      emailTemplates: { ...defaultEmailTemplates },
    },
    customers: [],
    docs: [],
    audit: [],
    processed: [],
    seq: {},
    demo,
  };
}
export function sample(): State {
  const s = empty("BrightFuture（サンプル）", true);
  s.company.contact = "担当者";
  s.company.verified = true;
  const m = today().slice(0, 7);
  s.customers = [
    {
      id: "c1",
      name: "青葉ハウス株式会社 福山支店",
      email: "",
      address: "",
      contact: "田中様",
      notes: "",
    },
    {
      id: "c2",
      name: "株式会社 みなと住建",
      email: "",
      address: "",
      contact: "鈴木様",
      notes: "",
    },
    {
      id: "c3",
      name: "合同会社 アトリエ",
      email: "",
      address: "",
      contact: "佐藤様",
      notes: "",
    },
  ];
  const row = (description: string, price: number, date: string): Item => ({
    description,
    price,
    date,
    quantity: 1,
    unit: "式",
    rate: 10,
  });
  for (const [idx, kind, cid, title, price, date] of [
    [1, "estimate", "c1", "家具家電移動のお見積り", 120000, m + "-10"],
    [2, "invoice", "c2", "オフィス移転作業", 85000, m + "-05"],
    [3, "receipt", "c3", "什器の搬入・設置", 40000, m + "-04"],
    [4, "estimate", "c2", "家具移動のお見積り", 35000, m + "-03"],
    [5, "invoice", "c1", "家具移動 ご請求", 50000, m + "-01"],
  ] as const) {
    const r = [row(title, price, date)];
    const d: Doc = {
      id: "sample" + idx,
      kind,
      number: `${kind === "estimate" ? "EST" : kind === "invoice" ? "INV" : "REC"}-${m.slice(0, 4)}-${String(idx).padStart(6, "0")}`,
      customerId: cid,
      customer: s.customers.find((c) => c.id === cid)!,
      title,
      date,
      due: m + "-30",
      items: r,
      notes: "サンプル書類です。実際の取引には使用できません。",
      status: idx === 4 ? "draft" : "issued",
      ...totals(r),
      company: { ...s.company },
      createdAt: date + "T10:00:00Z",
    };
    s.docs.push(d);
  }
  s.seq = {
    ["estimate-" + m.slice(0, 4)]: 5,
    ["invoice-" + m.slice(0, 4)]: 5,
    ["receipt-" + m.slice(0, 4)]: 5,
  };
  return s;
}
export function apply(s: State, a: any, actor: string, role: string): any {
  const admin = ["owner", "admin"].includes(role);
  const id = () => crypto.randomUUID();
  const get = (docid: string) => {
    const d = s.docs.find((d) => d.id === docid);
    must(d, "書類が見つかりません");
    return d;
  };
  let result: any = {};
  if (a.type === "customer") {
    const name = text(a.name);
    must(name, "取引先名を入力してください");
    const c = {
      id: a.id || id(),
      name,
      email: text(a.email),
      address: text(a.address),
      contact: text(a.contact),
      notes: text(a.notes, 2000),
    };
    if (a.id) {
      must(
        s.customers.some((c) => c.id === a.id),
        "取引先が見つかりません",
      );
      s.customers = s.customers.map((x) => (x.id === a.id ? c : x));
    } else s.customers.unshift(c);
    result = { id: c.id };
  } else if (a.type === "settings") {
    must(admin, "管理者のみ変更できます");
    const c = a.company || {};
    must(text(c.name), "会社名を入力してください");
    must(
      !c.registration || /^T\d{13}$/.test(c.registration),
      "登録番号はTと半角数字13桁で入力してください",
    );
    s.company = {
      ...s.company,
      name: text(c.name),
      postalCode: text(c.postalCode, 10),
      address: text(c.address),
      phone: text(c.phone),
      email: text(c.email),
      bank: text(c.bank, 1000),
      contact: text(c.contact),
      registration: text(c.registration),
      verified: c.verified === true,
    };
  } else if (a.type === "presets") {
    must(admin, "管理者のみ変更できます");
    const clean = (v: unknown, max: number) => {
      must(Array.isArray(v), "入力候補を確認してください");
      return [...new Set(v.map((x) => text(x, max)).filter(Boolean))].slice(
        0,
        50,
      );
    };
    s.company.itemPresets = clean(a.itemPresets, 100);
    s.company.unitPresets = clean(a.unitPresets, 10);
    s.company.contactPresets = clean(a.contactPresets ?? [], 100);
  } else if (a.type === "emailTemplates") {
    must(admin, "管理者のみ変更できます");
    const templates = a.templates || {};
    s.company.emailTemplates = {
      estimate:
        text(templates.estimate, 3000) || defaultEmailTemplates.estimate,
      invoice: text(templates.invoice, 3000) || defaultEmailTemplates.invoice,
      receipt: text(templates.receipt, 3000) || defaultEmailTemplates.receipt,
    };
  } else if (a.type === "document") {
    const kind = a.kind as Kind;
    must(
      ["estimate", "invoice", "receipt"].includes(kind),
      "書類の種類を確認してください",
    );
    must(
      kind === "estimate" || admin,
      "請求書・領収書は管理者が作成してください",
    );
    const customer = s.customers.find((c) => c.id === a.customerId);
    must(customer, "取引先を選択してください");
    const rs = items(a.items);
    const prior = a.id ? get(a.id) : null;
    must(!prior || prior.status === "draft", "発行済みの書類は編集できません");
    const d: Doc = {
      id: prior?.id || id(),
      kind,
      number: "下書き",
      customerId: customer.id,
      customer: { ...customer },
      title: text(a.title) || labels[kind],
      date: validDate(a.date),
      due: a.due ? validDate(a.due) : "",
      items: rs,
      notes: text(a.notes, 3000),
      status: "draft",
      ...totals(rs),
      company: { ...s.company },
      createdAt: new Date().toISOString(),
    };
    if (a.issue) {
      must(s.company.verified, "設定で会社情報を確認済みにしてください");
      must(d.total > 0, "合計金額を入力してください");
      if (kind === "receipt") {
        must(a.received === true, "実際の受領を確認してください");
      }
      d.status = "issued";
      const key = kind + "-" + d.date.slice(0, 4);
      s.seq[key] = (s.seq[key] || 0) + 1;
      d.number = `${kind === "estimate" ? "EST" : kind === "invoice" ? "INV" : "REC"}-${d.date.slice(0, 4)}-${String(s.seq[key]).padStart(6, "0")}`;
    }
    s.docs = prior
      ? s.docs.map((x) => (x.id === prior.id ? d : x))
      : [d, ...s.docs];
    result = { id: d.id };
  } else if (a.type === "sent") {
    const d = get(a.id);
    must(d.status === "issued", "発行済み書類のみ送付記録できます");
    d.sentAt = new Date().toISOString();
  } else if (a.type === "cancel") {
    must(admin, "管理者のみ取消できます");
    const d = get(a.id);
    must(d.status !== "cancelled", "この書類はすでに取消済みです");
    must(text(a.reason), "取消理由を入力してください");
    d.status = "cancelled";
    d.reason = text(a.reason);
  } else if (a.type === "delete") {
    must(admin, "管理者のみ削除できます");
    const d = get(a.id);
    must(d.status === "cancelled", "取消済みの書類のみ削除できます");
    s.docs = s.docs.filter((x) => x.id !== d.id);
  } else throw new Error("操作を確認してください");
  s.audit.unshift({
    id: id(),
    actor,
    action: a.type,
    at: new Date().toISOString(),
  });
  s.audit = s.audit.slice(0, 2000);
  return result;
}
