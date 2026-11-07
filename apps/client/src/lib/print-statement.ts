import type { BillingStatement, Language } from "@udyam/shared";
export function printStatement(s: BillingStatement, language: Language) {
  if (typeof window === "undefined") return;
  const win = window.open("", "_blank");
  if (!win) return;
  win.opener = null;
  const escape = (v: unknown) =>
    String(v).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  const t = (en: string, hi: string) => (language === "hi" ? hi : en);
  const money = (n: number) => `₹${(n / 100).toLocaleString("en-IN")}`;
  win.document.write(
    `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>Udyam Digital - demo statement</title><style>body{font:16px/1.6 system-ui,sans-serif;margin:40px;color:#17191d}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}button{padding:12px} @media print{button{display:none}@page{size:A4;margin:18mm}body{margin:0}}</style></head><body><h1>${t("Demo billing statement — not a tax invoice", "डेमो बिल — टैक्स इनवॉइस नहीं")}</h1><p>Udyam Digital · ${escape(s.period)}</p><table><thead><tr>${[t("Product", "उत्पाद"), t("Quantity", "मात्रा"), t("Monthly", "मासिक"), t("Setup once", "सेटअप एक बार")].map((h) => "<th>" + h + "</th>").join("")}</tr></thead><tbody>${s.lines.map((l) => `<tr><td>${escape(l.product.name)}</td><td>${l.quantity}</td><td>${money(l.monthlyPaise)}</td><td>${money(l.setupPaise)}</td></tr>`).join("")}</tbody></table><p>${t("Monthly subtotal", "मासिक उप-योग")}: ${money(s.monthlyPaise)}<br>${t("One-time setup", "एक बार सेटअप")}: ${money(s.setupPaise)}</p><h2>${t("Total excluding taxes", "कुल, कर अतिरिक्त")}: ${money(s.totalPaise)}</h2><p>${t("No payment is collected. This is the initial sample statement.", "कोई भुगतान नहीं लिया जाता। यह पहला नमूना बिल है।")}</p><button onclick="window.print()">${t("Print / Save PDF", "प्रिंट / PDF सेव करें")}</button></body></html>`,
  );
  win.document.close();
  win.focus();
}
