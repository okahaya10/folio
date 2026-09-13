import { PDFDocument, PDFPage, PDFFont, PDFImage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { Doc, labels, yen } from "./domain";

const A4: [number, number] = [595.28, 841.89];
const ink = rgb(0.12, 0.15, 0.2),
  muted = rgb(0.38, 0.43, 0.5);
const line = rgb(0.55, 0.58, 0.62),
  dark = rgb(0.18, 0.2, 0.23),
  white = rgb(1, 1, 1),
  black = rgb(0, 0, 0);
const normalizeInvoiceNumber = (value: string) =>
  value
    .replace(/[！-～]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0xfee0),
    )
    .replaceAll("　", " ")
    .replace(/[0-9]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) + 0xfee0),
    );

export async function makePDF(
  d: Doc,
  fontBytes: ArrayBuffer | Uint8Array,
  stamp?: Uint8Array,
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: false });
  let stampImage: PDFImage | undefined;
  if (stamp) {
    try {
      stampImage = await pdf.embedPng(stamp);
    } catch {
      throw new Error(
        "角印画像を読み込めません。PNG画像を登録し直してください",
      );
    }
  }
  const chunks = Array.from(
    { length: Math.max(1, Math.ceil(d.items.length / 12)) },
    (_, i) => d.items.slice(i * 12, i * 12 + 12),
  );
  chunks.forEach((items, index) =>
    drawPage(pdf.addPage(A4), font, d, items, index, chunks.length, stampImage),
  );
  pdf.setTitle(labels[d.kind] + " " + d.number);
  pdf.setProducer("Folio");
  return pdf.save();
}

function drawPage(
  page: PDFPage,
  font: PDFFont,
  d: Doc,
  items: Doc["items"],
  pageIndex: number,
  pageCount: number,
  stampImage?: PDFImage,
) {
  const write = (text: string, x: number, y: number, size = 9, color = ink) =>
    page.drawText(text, { x, y, size, font, color });
  const flat = (text: string) => text.replaceAll("\n", " ");
  const fit = (text: string, width: number, size = 9) => {
    const original = flat(text);
    let value = original;
    while (value && font.widthOfTextAtSize(value, size) > width)
      value = value.slice(0, -1);
    return value === original ? value : value.slice(0, -1) + "…";
  };
  const center = (text: string, y: number, size: number, color = ink) =>
    write(
      text,
      (A4[0] - font.widthOfTextAtSize(text, size)) / 2,
      y,
      size,
      color,
    );
  const formatJapaneseDate = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    return match
      ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日`
      : value;
  };

  center(labels[d.kind], 790, 23);
  write(fit(d.number, 100, 8), 400, 795, 8, muted);
  write(`${pageIndex + 1} / ${pageCount}`, 530, 795, 8, muted);
  write(d.kind === "receipt" ? "受領日" : "発行日", 400, 776, 9.5, black);
  write(formatJapaneseDate(d.date), 447, 776, 9.5, black);
  const customerLabel = fit(d.customer.name + " 御中", 290, 13);
  write(customerLabel, 42, 738, 13);
  page.drawLine({
    start: { x: 42, y: 731 },
    end: { x: 42 + font.widthOfTextAtSize(customerLabel, 13), y: 731 },
    thickness: 0.7,
    color: line,
  });
  const intro =
    d.kind === "estimate"
      ? "下記のとおり、お見積り申し上げます。"
      : d.kind === "invoice"
        ? "下記のとおり、ご請求申し上げます。"
        : "下記の金額を正に領収いたしました。";
  write(intro, 42, 707, 9, muted);
  write("件名：" + fit(d.title, 250, 10), 42, 684, 10);

  const companyX = 355;
  const companyRows = [
    ["会社名：", d.company.name],
    [
      "住　所：",
      d.company.postalCode
        ? `〒${d.company.postalCode} ${d.company.address}`
        : d.company.address,
    ],
    ["ＴＥＬ：", d.company.phone],
    ["登録番号：", normalizeInvoiceNumber(d.company.registration)],
  ].filter(([, value]) => Boolean(value));
  companyRows.forEach(([label, value], i) => {
    const y = 738 - i * 15;
    write(label, companyX, y, 8, black);
    write(
      fit(value, 145, i === 0 ? 9 : 8),
      companyX + 43,
      y,
      i === 0 ? 9 : 8,
      black,
    );
  });
  if (stampImage)
    page.drawImage(stampImage, {
      x: 493,
      y: 704,
      width: 54,
      height: (54 * stampImage.height) / stampImage.width,
      opacity: 0.5,
    });

  page.drawRectangle({ x: 42, y: 617, width: 112, height: 38, color: dark });
  write(d.kind === "receipt" ? "受領金額" : "合計金額", 76, 630, 10, white);
  page.drawRectangle({
    x: 154,
    y: 617,
    width: 250,
    height: 38,
    borderColor: line,
    borderWidth: 0.8,
  });
  write(yen(d.total) + "（税込）", 179, 626, 19);

  const top = 589,
    rowH = 27.5,
    headerH = 24;
  const columns = [42, 326, 374, 421, 486, 553];
  page.drawRectangle({
    x: 42,
    y: top - headerH,
    width: 511,
    height: headerH,
    color: dark,
  });
  ["摘要", "数量", "単位", "単価", "金額"].forEach((label, i) =>
    write(
      label,
      columns[i] +
        (columns[i + 1] - columns[i] - font.widthOfTextAtSize(label, 9)) / 2,
      top - 16,
      9,
      white,
    ),
  );
  for (let row = 0; row <= 12; row++) {
    const y = top - headerH - row * rowH;
    page.drawLine({
      start: { x: 42, y },
      end: { x: 553, y },
      thickness: 0.55,
      color: line,
    });
  }
  columns.forEach((x) =>
    page.drawLine({
      start: { x, y: top },
      end: { x, y: top - headerH - 12 * rowH },
      thickness: 0.55,
      color: line,
    }),
  );
  items.forEach((item, index) => {
    const y = top - headerH - index * rowH - 15;
    write(fit(item.description, 272, 8.5), columns[0] + 5, y, 8.5);
    write(String(item.quantity), columns[1] + 6, y, 8.5);
    write(fit(item.unit, 35, 8.5), columns[2] + 6, y, 8.5);
    const unitPrice = yen(item.price),
      amount = yen(
        Math.floor((Math.round(item.quantity * 100) * item.price) / 100),
      );
    write(
      unitPrice,
      columns[4] - font.widthOfTextAtSize(unitPrice, 8.5) - 5,
      y,
      8.5,
    );
    write(amount, columns[5] - font.widthOfTextAtSize(amount, 8.5) - 5, y, 8.5);
  });

  if (pageIndex === pageCount - 1) {
    const tableBottom = top - headerH - 12 * rowH;
    [
      ["小計", d.subtotal],
      ["消費税", d.tax],
      ["合計", d.total],
    ].forEach(([label, value], i) => {
      const y = tableBottom - (i + 1) * 23;
      page.drawRectangle({
        x: 421,
        y,
        width: 65,
        height: 23,
        color: i === 2 ? dark : rgb(0.94, 0.95, 0.96),
        borderColor: line,
        borderWidth: 0.55,
      });
      page.drawRectangle({
        x: 486,
        y,
        width: 67,
        height: 23,
        borderColor: line,
        borderWidth: 0.55,
      });
      write(String(label), 429, y + 7, 8.5, i === 2 ? white : ink);
      const amount = yen(Number(value));
      write(amount, 548 - font.widthOfTextAtSize(amount, 8.5), y + 7, 8.5);
    });
    page.drawRectangle({ x: 42, y: 116, width: 511, height: 25, color: dark });
    center("備考", 124, 9, white);
    const notes = [
      d.due
        ? `${d.kind === "estimate" ? "有効期限" : "お支払期限"}：${d.due}`
        : "",
      d.kind === "invoice" && d.company.bank
        ? `お振込先：${d.company.bank}`
        : "",
      d.notes,
    ]
      .filter(Boolean)
      .join("　");
    write(fit(notes, 501, 8), 47, 96, 8, muted);
  }
  if (d.status === "draft") write("下書き", 42, 30, 9, muted);
  if (d.status === "cancelled")
    write("取消済み", 42, 30, 10, rgb(0.78, 0.2, 0.2));
  if (d.company.name.includes("サンプル"))
    write("SAMPLE / 実際の取引には使用できません", 190, 30, 8, muted);
}
