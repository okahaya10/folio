"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  ArrowUpRight,
  ArrowRight,
  Plus,
  LayoutDashboard,
  Users,
  Receipt,
  Settings,
  Search,
  ChevronRight,
  ChevronLeft,
  Building2,
  Check,
  CheckCheck,
  Wallet,
  Download,
  Share2,
  Copy,
  Mail,
  Trash2,
  Loader2,
  LogOut,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  MoreHorizontal,
  CalendarDays,
  X,
  Upload,
  Layers,
  Send,
  Menu,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  State,
  Doc,
  Kind,
  Item,
  labels,
  today,
  yen,
  totals,
  Company,
  defaultEmailTemplates,
} from "@/lib/domain";
type View =
  | "home"
  | "documents"
  | "customers"
  | "settings"
  | "item-settings"
  | "team"
  | "admin";
const navigation = [
  { id: "home", label: "ホーム", icon: LayoutDashboard },
  { id: "documents", label: "書類", icon: FileText },
  { id: "customers", label: "取引先", icon: Users },
] as const;
const descriptions: Record<View, string> = {
  home: "必要な書類を、すぐに作成。",
  documents: "見積から領収まで、ここに。",
  customers: "いつもの取引先に、すぐアクセス。",
  settings: "あなたの会社に合わせて。",
  "item-settings": "入力候補と送付文章を管理。",
  team: "一緒に働くメンバーを管理。",
  admin: "会社ごとの利用状況を管理。",
};
const viewNames: Record<View, string> = {
  home: "ホーム",
  documents: "書類",
  customers: "取引先",
  settings: "会社設定",
  "item-settings": "項目・メール設定",
  team: "メンバー",
  admin: "運営管理",
};
const iconMap = { estimate: FileText, invoice: Wallet, receipt: Receipt };
const defaultItems: string[] = [],
  defaultUnits = ["式", "台", "個", "人", "時間"];
const japaneseDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return match
    ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日`
    : value;
};
const normalizeInvoiceNumber = (value: string) =>
  value
    .replace(/[！-～]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0xfee0),
    )
    .replaceAll("　", " ")
    .replace(/[0-9]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) + 0xfee0),
    );
const blankItem = (): Item => ({
  description: "",
  quantity: 1,
  unit: "式",
  price: 0,
  rate: 10,
  date: "",
});
function Choose({
  value,
  onChange,
  options,
  placeholder = "選択してください",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="select-field">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function PresetInput({
  value,
  onChange,
  options,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  label: string;
}) {
  return (
    <div className="preset-input">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <Select onValueChange={onChange}>
        <SelectTrigger
          className="preset-picker"
          aria-label={label + "の候補を開く"}
        >
          <SelectValue placeholder="候補" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function Badge({ doc }: { doc: Doc }) {
  if (doc.status === "cancelled")
    return <span className="status-badge red">取消済み</span>;
  if (doc.status === "draft")
    return <span className="status-badge gray">下書き</span>;
  return (
    <span className={"status-badge " + (doc.sentAt ? "blue" : "gray")}>
      {doc.sentAt ? "送付済み" : "未送付"}
    </span>
  );
}
function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div>
        <FileText size={27} />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={"field " + (wide ? "full" : "")}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function SidebarNavButton({
  active,
  onClick,
  icon: Icon,
  iconSize = 18,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number }>;
  iconSize?: number;
  children: React.ReactNode;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <button
      className={active ? "active" : ""}
      onClick={() => {
        onClick();
        if (isMobile) setOpenMobile(false);
      }}
    >
      <Icon size={iconSize} />
      {children}
    </button>
  );
}
export default function Workspace({ authMode }: { authMode?: "vps" } = {}) {
  const [state, setState] = useState<State | null>(null),
    [tenants, setTenants] = useState<any[]>([]),
    [tenantId, setTenantId] = useState(""),
    [version, setVersion] = useState(0),
    [role, setRole] = useState("owner"),
    [contract, setContract] = useState("active"),
    [members, setMembers] = useState<any[]>([]),
    [isAdmin, setIsAdmin] = useState(false),
    [user, setUser] = useState<any>(null),
    [view, setView] = useState<View>("home"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(""),
    [tab, setTab] = useState("all"),
    [statusFilter, setStatusFilter] = useState("all"),
    [month, setMonth] = useState(today().slice(0, 7));
  const [modal, setModal] = useState(""),
    [form, setForm] = useState<any>({}),
    [detail, setDetail] = useState<string | null>(null),
    [cancelId, setCancelId] = useState(""),
    [reason, setReason] = useState(""),
    [deleteId, setDeleteId] = useState(""),
    [inviteLink, setInviteLink] = useState("");
  const [quickCustomer, setQuickCustomer] = useState<{
    name: string;
    contact: string;
  } | null>(null);
  const [quickCustomerBusy, setQuickCustomerBusy] = useState(false);
  const requestId = useRef("");
  const current = state?.docs.find((d) => d.id === detail);
  const canManage = ["owner", "admin"].includes(role);
  const canWrite = contract === "active";
  const getData = useCallback(async (id?: string) => {
    const r = await fetch(
      "/api/workspace" + (id ? "?tenant=" + encodeURIComponent(id) : ""),
    );
    const data: any = await r.json();
    if (!r.ok) throw new Error(data.error);
    setTenants(data.tenants);
    setUser(data.user);
    setIsAdmin(data.isAdmin);
    if (id) {
      setState(data.state);
      setVersion(data.version);
      setRole(data.role);
      setContract(data.status);
      setMembers(data.members);
      setTenantId(id);
    }
    return data;
  }, []);
  const rawPost = async (a: any) => {
    const r = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(a),
    });
    const j: any = await r.json();
    if (!r.ok) throw new Error(j.error);
    return j;
  };
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const q = new URLSearchParams(location.search);
        const invite = q.get("invite");
        if (invite) {
          const accepted = await rawPost({ type: "accept", token: invite });
          history.replaceState({}, "", location.pathname);
          await getData(accepted.id);
        } else {
          const data = await getData();
          if (!data.tenants.length) {
            requestId.current = crypto.randomUUID();
            setForm({ name: "", email: "", address: "", contact: "" });
            setModal("tenant");
          } else await getData(data.tenants[0].id);
        }
      } catch (e: any) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [getData]);
  const switchTenant = async (id: string) => {
    setLoading(true);
    setState(null);
    setDetail(null);
    setModal("");
    setSearch("");
    setView("home");
    try {
      await getData(id);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  const mutate = async (a: any, keep = false) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await rawPost({
        ...a,
        tenant: tenantId,
        version,
        requestId: requestId.current || crypto.randomUUID(),
      });
      await getData(tenantId);
      if (!keep) setModal("");
      requestId.current = "";
      toast.success("保存しました");
      return result;
    } catch (e: any) {
      toast.error(e.message);
      if (e.message.includes("更新されました")) await getData(tenantId);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const nav = (v: View) => {
    setView(v);
    setSearch("");
    setTab("all");
    setStatusFilter("all");
  };
  const open = (type: string, doc?: Doc) => {
    requestId.current = crypto.randomUUID();
    setInviteLink("");
    setQuickCustomer(null);
    if (["estimate", "invoice", "receipt"].includes(type))
      setForm({
        kind: type,
        customerId: doc?.customerId || "",
        title: doc?.title || "",
        date: today(),
        due: doc?.kind === type ? doc.due : "",
        dueEnabled: doc?.kind === type && !!doc.due,
        items: doc ? doc.items.map((i) => ({ ...i })) : [blankItem()],
        notes: doc?.notes || "",
        received: false,
        method: "現金",
      });
    else if (type === "edit" && doc)
      setForm({ ...doc, kind: doc.kind, dueEnabled: !!doc.due });
    else if (type === "settings") setForm({ ...state?.company });
    else if (type === "presets")
      setForm({
        itemPresets: (state?.company.itemPresets || []).join("\n"),
        unitPresets: (state?.company.unitPresets || []).join("\n"),
        contactPresets: (state?.company.contactPresets || []).join("\n"),
      });
    else if (type === "emailTemplates")
      setForm({
        ...defaultEmailTemplates,
        ...(state?.company.emailTemplates || {}),
      });
    else if (type === "invite") setForm({ email: "", role: "staff" });
    else if (type === "changePassword")
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    else setForm({ name: "", email: "", address: "", contact: "", notes: "" });
    setModal(type);
  };
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(
      ctx.registerTool(
        {
          name: "folio_read_summary",
          description: "現在の会社の書類件数と未送付件数を取得します。",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: () => ({
            company: state?.company.name,
            documents: state?.docs.length || 0,
            unsent:
              state?.docs.filter((d) => d.status === "issued" && !d.sentAt)
                .length || 0,
          }),
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    Promise.resolve(
      ctx.registerTool(
        {
          name: "folio_start_document",
          description: "書類作成画面を開きます。保存や発行はしません。",
          inputSchema: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                enum: ["estimate", "invoice", "receipt"],
              },
            },
            required: ["kind"],
            additionalProperties: false,
          },
          execute: (i: any) => {
            if (!["estimate", "invoice", "receipt"].includes(i.kind))
              throw Error("書類の種類が不正です");
            open(i.kind);
            return { opened: i.kind };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, [state]);
  const matchesStatus = (d: Doc) =>
    statusFilter === "all" ||
    d.status === statusFilter ||
    (statusFilter === "sent" && !!d.sentAt) ||
    (statusFilter === "unsent" && d.status === "issued" && !d.sentAt);
  const rows =
    state?.docs.filter(
      (d) =>
        (tab === "all" || d.kind === tab) &&
        matchesStatus(d) &&
        (!search ||
          [d.customer.name, d.number, d.title]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase())),
    ) || [];
  const invoices =
    state?.docs.filter((d) => d.kind === "invoice" && d.status === "issued") ||
    [];
  const monthly = invoices.filter((d) => d.date.startsWith(month));
  const monthlyAmount = monthly.reduce((n, d) => n + d.total, 0);
  const monthlyIssuedCount =
    state?.docs.filter(
      (d) => d.status === "issued" && d.date.startsWith(month),
    ).length || 0;
  const unsentCount =
    state?.docs.filter((d) => d.status === "issued" && !d.sentAt).length || 0;
  const changeMonth = (delta: number) => {
    const d = new Date(month + "-15T00:00:00");
    d.setMonth(d.getMonth() + delta);
    setMonth(d.toLocaleDateString("sv-SE").slice(0, 7));
  };
  const submitDoc = async (issue: boolean) => {
    const r = await mutate({ ...form, type: "document", issue });
    if (r?.id) setDetail(r.id);
  };
  const exportCsv = () => {
    if (!state) return;
    const esc = (v: any) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@\-]/, (m) => "'" + m)
        .replace(/"/g, '""') +
      '"';
    const csv =
      "\uFEFF" +
      [
        ["書類番号", "種類", "取引先", "発行日", "税込金額", "状態"],
        ...state.docs.map((d) => [
          d.number,
          labels[d.kind],
          d.customer.name,
          d.date,
          d.total,
          d.status,
        ]),
      ]
        .map((r) => r.map(esc).join(","))
        .join("\r\n");
    download(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      "Folio_書類一覧.csv",
    );
  };
  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  const pdf = async (d: Doc, share = false) => {
    setBusy(true);
    try {
      const r = await fetch(
        "/api/document?tenant=" +
          encodeURIComponent(tenantId) +
          "&id=" +
          encodeURIComponent(d.id),
      );
      if (!r.ok) {
        const e: any = await r.json();
        throw Error(e.error);
      }
      const b = await r.blob();
      const name = labels[d.kind] + "_" + d.number + ".pdf";
      const file = new File([b], name, { type: "application/pdf" });
      const shareData = {
        files: [file],
        title: labels[d.kind],
        text: emailBody(d),
      };
      if (share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        if (d.status === "issued" && !d.sentAt && canWrite) {
          requestId.current = crypto.randomUUID();
          await mutate({ type: "sent", id: d.id });
        } else {
          toast.success("共有しました");
        }
      } else {
        download(b, name);
        toast.success(
          share
            ? "PDFを保存しました。メールに添付して送付してください"
            : "PDFをダウンロードしました",
        );
      }
    } catch (e: any) {
      if (e.name !== "AbortError") toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const emailBody = (d: Doc) => {
    const source =
      state?.company.emailTemplates?.[d.kind] || defaultEmailTemplates[d.kind];
    const values: Record<string, string> = {
      "{取引先名}": d.customer.name,
      "{自社名}": d.company.name,
      "{件名}": d.title,
      "{書類名}": labels[d.kind],
      "{書類番号}": d.number,
    };
    return Object.entries(values).reduce(
      (body, [key, value]) => body.replaceAll(key, value),
      source,
    );
  };
  const monthPicker = (
    <div className="month-switch">
      <button aria-label="前月" onClick={() => changeMonth(-1)}>
        <ChevronLeft size={16} />
      </button>
      <span>{month.replace("-", "年 ")}月</span>
      <button aria-label="翌月" onClick={() => changeMonth(1)}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
  const newMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="btn primary" disabled={!canWrite}>
          <Plus size={17} />
          <span>新しく作る</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {(["estimate", "invoice", "receipt"] as const).map((k) => (
          <DropdownMenuItem
            key={k}
            onClick={() => open(k)}
            disabled={!canManage && (k === "invoice" || k === "receipt")}
          >
            {labels[k]}を作成
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  function DocumentList({
    docs,
    compact = false,
  }: {
    docs: Doc[];
    compact?: boolean;
  }) {
    return !docs.length ? (
      <Empty
        title="書類はまだありません"
        body="見積書から、最初の一枚を作ってみましょう。"
        action={
          <button className="btn" onClick={() => open("estimate")}>
            <Plus size={16} />
            見積書を作る
          </button>
        }
      />
    ) : (
      <div className="document-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>書類 / 取引先</TableHead>
              <TableHead className="hide-small">発行日</TableHead>
              <TableHead className="money-cell">金額（税込）</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead className="chevron-cell"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((d) => {
              const Icon = iconMap[d.kind];
              return (
                <TableRow
                  key={d.id}
                  onClick={() => setDetail(d.id)}
                  className="clickable-row"
                >
                  <TableCell>
                    <div className="doc-name">
                      <span className={"doc-icon " + d.kind}>
                        <Icon size={19} />
                      </span>
                      <div>
                        <button
                          className="doc-title"
                          onClick={() => setDetail(d.id)}
                        >
                          {d.customer.name}
                        </button>
                        <span className="meta">
                          {labels[d.kind]}{" "}
                          <span className="dot-separator">·</span>{" "}
                          {d.number === "下書き" ? d.title : d.number}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hide-small date-cell">
                    {d.date.replaceAll("-", "/")}
                  </TableCell>
                  <TableCell className="money-cell">{yen(d.total)}</TableCell>
                  <TableCell>
                    <Badge doc={d} />
                  </TableCell>
                  <TableCell className="chevron-cell">
                    <ChevronRight size={16} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "238px" } as React.CSSProperties}
    >
      <Toaster position="top-center" theme="light" richColors />
      <Sidebar className="app-sidebar">
        <SidebarHeader>
          <div className="brand">
            folio<span className="brand-dot">.</span>
          </div>
          <div className="company-switch static-company">
            <span className="company-avatar">
              <Building2 size={17} />
            </span>
            <span>
              <strong>{state?.company.name || "会社アカウント"}</strong>
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <div className="nav-caption">ワークスペース</div>
          <nav>
            {navigation.map((n) => (
              <SidebarNavButton
                key={n.id}
                active={view === n.id}
                onClick={() => nav(n.id)}
                icon={n.icon}
                iconSize={19}
              >
                {n.label}
              </SidebarNavButton>
            ))}
          </nav>
          <div className="nav-caption management">管理</div>
          <nav>
            {[
              { id: "settings", label: "会社設定", icon: Settings },
              { id: "item-settings", label: "項目・メール設定", icon: Layers },
              { id: "team", label: "メンバー", icon: Users },
              ...(isAdmin
                ? [{ id: "admin", label: "運営管理", icon: ShieldCheck }]
                : []),
            ].map((n) => (
              <SidebarNavButton
                key={n.id}
                active={view === n.id}
                onClick={() => nav(n.id as View)}
                icon={n.icon}
              >
                {n.label}
              </SidebarNavButton>
            ))}
          </nav>
        </SidebarContent>
        <SidebarFooter>
          <div className="sidebar-note">
            <Layers size={20} />
            <span>
              見積・請求・領収を、
              <br />
              ひとつの場所に。
            </span>
          </div>
          <div className="user-row">
            <span className="user-avatar">
              {user?.name?.slice(0, 1) || "H"}
            </span>
            <div>
              <strong>
                {user?.name?.includes("@")
                  ? "マイアカウント"
                  : user?.name || "ようこそ"}
              </strong>
              <small>
                {role === "owner"
                  ? "オーナー"
                  : role === "admin"
                    ? "管理者"
                    : "スタッフ"}
              </small>
            </div>
            {authMode === "vps" && (
              <button
                type="button"
                title="パスワード変更"
                onClick={() => open("changePassword")}
              >
                <KeyRound size={16} />
              </button>
            )}
            {authMode === "vps" ? (
              <button
                type="button"
                title="ログアウト"
                onClick={async () => {
                  try {
                    const csrfRes = await fetch("/api/auth/csrf");
                    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
                    await fetch("/api/auth/signout", {
                      method: "POST",
                      headers: { "Content-Type": "application/x-www-form-urlencoded" },
                      body: new URLSearchParams({ csrfToken, json: "true" }),
                    });
                  } catch {
                    // Fall through to the reload below regardless — if
                    // signout genuinely didn't reach the server, page.tsx's
                    // own session check on "/" will just show the login
                    // screen again and the user can retry.
                  }
                  window.location.href = "/";
                }}
              >
                <LogOut size={16} />
              </button>
            ) : (
              <a href="/signout-with-chatgpt?return_to=/" title="ログアウト">
                <LogOut size={16} />
              </a>
            )}
          </div>
        </SidebarFooter>
      </Sidebar>
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger className="mobile-trigger" />
            <span className="desktop-only">ワークスペース</span>
            <ChevronRight size={13} className="desktop-only" />
            <strong>{viewNames[view]}</strong>
          </div>
          <div className="topbar-right">
            <span className="save-indicator">
              <CheckCheck size={14} />
              クラウド保存
            </span>
            <span className="header-divider" />
            <span>
              {new Date().toLocaleDateString("ja-JP", {
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </span>
            <span className="top-avatar">
              <Building2 size={15} />
            </span>
          </div>
        </header>
        {loading ? (
          <div className="loading-state">
            <Loader2 className="spin" />
            <h2>ワークスペースを開いています</h2>
          </div>
        ) : error ? (
          <div className="loading-state">
            <ShieldCheck size={35} />
            <h2>{error}</h2>
            {error.includes("ログイン") ? (
              <a
                className="btn primary"
                href="/signin-with-chatgpt?return_to=/"
                target="_top"
              >
                ChatGPTでログイン
              </a>
            ) : (
              <button className="btn" onClick={() => location.reload()}>
                再読み込み
              </button>
            )}
          </div>
        ) : (
          state && (
            <div className="page-body">
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    {view === "home" ? "OVERVIEW" : view.toUpperCase()}
                  </p>
                  <h1>{viewNames[view]}</h1>
                  <p>{descriptions[view]}</p>
                </div>
                {view === "customers" ? (
                  <button
                    className="btn primary"
                    onClick={() => open("customer")}
                    disabled={!canWrite}
                  >
                    <Plus size={17} />
                    取引先を追加
                  </button>
                ) : view === "team" ? (
                  <button
                    className="btn primary"
                    disabled={!canManage || !canWrite}
                    onClick={() => open("invite")}
                  >
                    <Plus size={17} />
                    招待する
                  </button>
                ) : view === "settings" ||
                  view === "item-settings" ||
                  view === "admin" ? null : (
                  newMenu
                )}
              </div>
              {state.demo && (
                <div className="demo-note">
                  <span>
                    <span className="tiny-badge">SAMPLE</span>
                    サンプルデータで操作をお試しいただけます。
                  </span>
                </div>
              )}
              {contract !== "active" && (
                <div className="notice">
                  この会社は閲覧専用です。書類の閲覧と出力ができます。
                </div>
              )}
              {view === "home" && (
                <>
                  <section className="summary-section">
                    <div className="section-line">
                      <h2>今月のサマリー</h2>
                      {monthPicker}
                    </div>
                    <div className="metrics simple-metrics">
                      <button
                        className="metric featured"
                        onClick={() => {
                          nav("documents");
                          setTab("invoice");
                        }}
                      >
                        <div className="metric-label">
                          <span>今月の請求額</span>
                          <Wallet size={18} />
                        </div>
                        <strong>{yen(monthlyAmount)}</strong>
                        <div className="metric-foot">
                          <span>{monthly.length}件の請求書</span>
                          <span>税込</span>
                        </div>
                        <div className="metric-rule" />
                      </button>
                      <button
                        className="metric"
                        onClick={() => {
                          nav("documents");
                          setStatusFilter("unsent");
                        }}
                      >
                        <div className="metric-label">
                          <span>未送付の書類</span>
                          <Send size={18} />
                        </div>
                        <strong>{unsentCount}件</strong>
                        <div className="metric-foot">
                          <span className="amber-text">
                            共有すると自動で送付済みに
                          </span>
                          <ArrowUpRight size={15} />
                        </div>
                      </button>
                      <div className="metric">
                        <div className="metric-label">
                          <span>今月発行した書類</span>
                          <FileText size={18} />
                        </div>
                        <strong>{monthlyIssuedCount}件</strong>
                        <div className="metric-foot">
                          <span>見積・請求・領収の合計</span>
                        </div>
                      </div>
                    </div>
                  </section>
                  <section className="quick-section">
                    <div className="section-line">
                      <h2>書類を作る</h2>
                      <span className="quiet">作りたい書類を選ぶだけ。</span>
                    </div>
                    <div className="quick-grid simple-actions">
                      {[
                        {
                          k: "estimate",
                          title: "見積書を作る",
                          sub: "金額を提示する",
                          icon: FileText,
                          c: "blue",
                        },
                        {
                          k: "invoice",
                          title: "請求書を作る",
                          sub: "代金を請求する",
                          icon: Wallet,
                          c: "teal",
                        },
                        {
                          k: "receipt",
                          title: "領収書を作る",
                          sub: "受領した代金を記録",
                          icon: Receipt,
                          c: "orange",
                        },
                      ].map((a) => (
                        <button
                          className="quick-card"
                          key={a.k}
                          onClick={() => open(a.k)}
                          disabled={
                            !canWrite ||
                            (!canManage && ["invoice", "receipt"].includes(a.k))
                          }
                        >
                          <span className={"action-icon " + a.c}>
                            <a.icon size={20} />
                          </span>
                          <div>
                            <strong>{a.title}</strong>
                            <small>{a.sub}</small>
                          </div>
                          <ArrowUpRight size={16} />
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="panel flow-guide">
                    <div>
                      <strong>書類を送る流れ</strong>
                      <p>
                        <b>1</b> 書類を発行 <ChevronRight size={14} />
                        <b>2</b> 共有ボタンでPDFと本文を送付（自動で送付済みに）
                      </p>
                    </div>
                  </section>
                  <section className="panel recent-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>最近の書類</h2>
                        <p>直近の見積・請求・領収書</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => nav("documents")}
                      >
                        すべて見る
                        <ArrowRight size={14} />
                      </button>
                    </div>
                    <DocumentList docs={state.docs.slice(0, 6)} compact />
                  </section>
                  <footer className="page-footer">
                    <span>Folio — 見積から領収まで、ひとつに。</span>
                    <span>
                      <ShieldCheck size={13} />
                      会社ごとのワークスペース
                    </span>
                  </footer>
                </>
              )}
              {view === "documents" && (
                <section className="panel">
                  <div className="list-toolbar">
                    <Tabs value={tab} onValueChange={setTab}>
                      <TabsList variant="line">
                        <TabsTrigger value="all">
                          すべて <span>{state.docs.length}</span>
                        </TabsTrigger>
                        {Object.entries(labels).map(([k, v]) => (
                          <TabsTrigger key={k} value={k}>
                            {v}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                    <button className="btn subtle" onClick={exportCsv}>
                      <Download size={15} />
                      CSV出力
                    </button>
                  </div>
                  <div className="filter-row">
                    <div className="search-box">
                      <Search size={17} />
                      <input
                        aria-label="書類を検索"
                        placeholder="取引先・書類番号で検索"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <Choose
                      value={statusFilter}
                      onChange={setStatusFilter}
                      options={[
                        { value: "all", label: "すべての状態" },
                        { value: "draft", label: "下書き" },
                        { value: "sent", label: "送付済み" },
                        { value: "unsent", label: "未送付" },
                        { value: "cancelled", label: "取消済み" },
                      ]}
                    />
                  </div>
                  <DocumentList docs={rows} />
                  <div className="table-footer">{rows.length}件の書類</div>
                </section>
              )}
              {view === "customers" && (
                <>
                  <div className="customer-search">
                    <div className="search-box">
                      <Search size={18} />
                      <input
                        aria-label="取引先を検索"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="取引先を検索"
                      />
                    </div>
                    <span className="quiet">
                      {state.customers.length}件の取引先
                    </span>
                  </div>
                  <div className="customer-grid">
                    {state.customers
                      .filter((c) => (c.name + c.contact).includes(search))
                      .map((c, i) => (
                        <div className="panel customer-card" key={c.id}>
                          <div className={"customer-avatar tone-" + (i % 3)}>
                            <Building2 size={23} />
                          </div>
                          <h3>{c.name}</h3>
                          <p>{c.contact || "担当者未設定"}</p>
                          {c.notes && <p className="customer-notes">{c.notes}</p>}
                          <div className="customer-meta">
                            <span>
                              <Mail size={14} />
                              {c.email || "メール未登録"}
                            </span>
                            <span>
                              <FileText size={14} />
                              書類{" "}
                              {
                                state.docs.filter((d) => d.customerId === c.id)
                                  .length
                              }
                              件
                            </span>
                          </div>
                          <div className="customer-actions">
                            <button
                              onClick={() => {
                                open("estimate");
                                setForm((f: any) => ({
                                  ...f,
                                  customerId: c.id,
                                }));
                              }}
                            >
                              見積を作る
                              <ArrowRight size={14} />
                            </button>
                            <button
                              onClick={() => {
                                open("customer");
                                setForm({ ...c });
                              }}
                            >
                              編集
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                  {!state.customers.length && (
                    <Empty
                      title="取引先を登録しましょう"
                      body="一度登録すれば、次回から選ぶだけ。"
                    />
                  )}
                </>
              )}
              {view === "settings" && (
                <div className="settings-layout">
                  <section className="panel settings-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>会社情報</h2>
                        <p>見積書・請求書・領収書に記載されます</p>
                      </div>
                      <button
                        className="btn"
                        disabled={!canManage || !canWrite}
                        onClick={() => open("settings")}
                      >
                        編集する
                      </button>
                    </div>
                    <dl className="company-details">
                      {[
                        ["会社名", state.company.name],
                        ["郵便番号", state.company.postalCode],
                        ["住所", state.company.address],
                        ["電話番号", state.company.phone],
                        ["メール", state.company.email],
                        ["担当者", state.company.contact],
                        ["登録番号", state.company.registration],
                        ["振込先", state.company.bank],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v || <span className="quiet">未登録</span>}</dd>
                        </div>
                      ))}
                    </dl>
                    <div
                      className={
                        "verification " +
                        (state.company.verified ? "verified" : "")
                      }
                    >
                      <ShieldCheck size={18} />
                      {state.company.verified
                        ? "会社情報は確認済みです"
                        : "発行を始める前に、会社情報を確認してください。"}
                    </div>
                  </section>
                  <section className="panel stamp-panel">
                    <h2>角印</h2>
                    <p>書類に配置するPNG画像を登録</p>
                    <div className="stamp-preview">
                      {state.company.stampKey ? (
                        <img
                          src={
                            "/api/stamp?tenant=" +
                            encodeURIComponent(tenantId) +
                            "&v=" +
                            version
                          }
                          alt="登録した角印"
                        />
                      ) : (
                        <>
                          <Upload size={28} />
                          <span>角印が未登録です</span>
                        </>
                      )}
                    </div>
                    <label className="btn upload-btn">
                      <Upload size={16} />
                      PNGをアップロード
                      <input
                        type="file"
                        accept="image/png"
                        disabled={!canManage || !canWrite}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setBusy(true);
                          try {
                            const fd = new FormData();
                            fd.append("file", f);
                            const r = await fetch(
                              "/api/stamp?tenant=" +
                                encodeURIComponent(tenantId),
                              { method: "POST", body: fd },
                            );
                            const j: any = await r.json();
                            if (!r.ok) throw Error(j.error);
                            await getData(tenantId);
                            toast.success("角印を保存しました");
                          } catch (e: any) {
                            toast.error(e.message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      />
                    </label>
                    <small>透過PNG推奨・500KB以内</small>
                  </section>
                  <section className="panel export-panel">
                    <div>
                      <h2>データの出力</h2>
                      <p>会社の書類・取引先データを保存できます。</p>
                    </div>
                    <button
                      className="btn"
                      onClick={() =>
                        download(
                          new Blob([JSON.stringify(state, null, 2)], {
                            type: "application/json",
                          }),
                          "Folio_データ控え.json",
                        )
                      }
                    >
                      <Download size={16} />
                      データを出力
                    </button>
                  </section>
                </div>
              )}
              {view === "item-settings" && (
                <div className="document-settings-grid">
                  <section className="panel setting-card">
                    <div className="setting-card-icon">
                      <Layers size={21} />
                    </div>
                    <div>
                      <h2>項目・単位・担当者</h2>
                      <p>書類作成時にプルダウンで選ぶ候補です。</p>
                      <div className="preset-preview">
                        <span>
                          {(state.company.itemPresets || defaultItems).length
                            ? (state.company.itemPresets || defaultItems).join(
                                "・",
                              )
                            : "未登録"}
                        </span>
                        <span>
                          {(state.company.unitPresets || defaultUnits).join(
                            "・",
                          )}
                        </span>
                        {!!state.company.contactPresets?.length && (
                          <span>
                            {state.company.contactPresets.join("・")}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="btn"
                      disabled={!canManage || !canWrite}
                      onClick={() => open("presets")}
                    >
                      編集する
                    </button>
                  </section>
                  <section className="panel setting-card">
                    <div className="setting-card-icon mail">
                      <Mail size={21} />
                    </div>
                    <div>
                      <h2>メール文章テンプレート</h2>
                      <p>見積書・請求書・領収書ごとの送付文章を設定します。</p>
                      <div className="template-tags">
                        <span>{"{取引先名}"}</span>
                        <span>{"{自社名}"}</span>
                        <span>{"{件名}"}</span>
                        <span>{"{書類名}"}</span>
                        <span>{"{書類番号}"}</span>
                      </div>
                    </div>
                    <button
                      className="btn"
                      disabled={!canManage || !canWrite}
                      onClick={() => open("emailTemplates")}
                    >
                      編集する
                    </button>
                  </section>
                </div>
              )}
              {view === "team" && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>
                      メンバー{" "}
                      <span className="count-pill">{members.length}</span>
                    </h2>
                    <p>この会社にアクセスできる人</p>
                  </div>
                  {members.map((m) => (
                    <div className="member-row" key={m.user}>
                      <div className="member-avatar">
                        {m.email[0].toUpperCase()}
                      </div>
                      <strong>{m.email}</strong>
                      <span className="status-badge gray">
                        {m.role === "owner"
                          ? "オーナー"
                          : m.role === "admin"
                            ? "管理者"
                            : "スタッフ"}
                      </span>
                      {canManage && m.role !== "owner" && (
                        <button
                          className="btn subtle"
                          onClick={async () => {
                            await mutate({
                              type: "removeMember",
                              user: m.user,
                            });
                          }}
                        >
                          所属を解除
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="team-note">
                    <ShieldCheck size={18} />
                    <p>
                      招待したメールアドレスでログインすると、この会社のワークスペースに参加できます。
                    </p>
                  </div>
                </section>
              )}
              {view === "admin" && isAdmin && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>会社ワークスペース</h2>
                      <p>各社が作成したアカウントの利用状態を管理します。</p>
                    </div>
                    <span className="count-pill">{tenants.length}社</span>
                  </div>
                  {tenants.map((t) => (
                    <div className="tenant-row" key={t.id}>
                      <span className="customer-avatar">
                        <Building2 size={22} />
                      </span>
                      <div>
                        <strong>{t.name}</strong>
                        <small>{t.plan}</small>
                      </div>
                      <Choose
                        value={t.status}
                        onChange={async (status) => {
                          setBusy(true);
                          try {
                            await rawPost({
                              type: "contract",
                              tenant: t.id,
                              status,
                            });
                            await getData();
                            if (t.id === tenantId) {
                              setContract(status);
                              if (status === "suspended") {
                                setState(null);
                                setError("この会社は利用停止中です。");
                              }
                            }
                            toast.success("利用状態を変更しました");
                          } catch (e: any) {
                            toast.error(e.message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                        options={[
                          { value: "active", label: "利用中" },
                          { value: "read_only", label: "閲覧専用" },
                          { value: "suspended", label: "利用停止" },
                        ]}
                      />
                    </div>
                  ))}
                </section>
              )}
            </div>
          )
        )}
        <div className="mobile-nav">
          {navigation.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => nav(n.id)}
            >
              <n.icon size={21} />
              <span>{n.label}</span>
            </button>
          ))}
        </div>
      </main>
      <Dialog
        open={!!modal}
        onOpenChange={(v) => {
          if (!v && !busy && state) setModal("");
        }}
      >
        <DialogContent
          className={
            "app-dialog " +
            (["estimate", "invoice", "receipt", "edit"].includes(modal)
              ? "editor-dialog"
              : "")
          }
        >
          <DialogHeader>
            <DialogTitle>
              {modal === "customer"
                ? "取引先を登録"
                : modal === "tenant"
                  ? "会社アカウントを作成"
                  : modal === "settings"
                    ? "会社情報を編集"
                    : modal === "presets"
                      ? "入力候補を設定"
                      : modal === "emailTemplates"
                        ? "メール文章を設定"
                        : modal === "invite"
                          ? "メンバーを招待"
                          : modal === "changePassword"
                            ? "パスワードを変更"
                            : labels[form.kind as Kind] + "を作成"}
            </DialogTitle>
            <DialogDescription>
              {modal === "tenant"
                ? "会社名を登録すると、専用のワークスペースが作成されます。"
                : modal === "presets"
                  ? "1行に1つずつ登録してください。書類作成時に候補から選べます。"
                  : modal === "emailTemplates"
                    ? "差し込み項目は文章内の好きな位置で使用できます。"
                    : modal === "invite"
                      ? "有効期限7日間の招待リンクを作成します。"
                      : modal === "changePassword"
                        ? "現在のパスワードを入力して、新しいパスワードを設定してください。"
                        : "入力内容を確認して保存してください。"}
            </DialogDescription>
          </DialogHeader>
          <div className="dialog-scroll">
            {["estimate", "invoice", "receipt", "edit"].includes(modal) && (
              <>
                <div className="form-grid">
                  <Field label="取引先 *" wide>
                    {quickCustomer ? (
                      <div className="quick-customer-form">
                        <input
                          className="login-input"
                          value={quickCustomer.name}
                          onChange={(e) =>
                            setQuickCustomer({ ...quickCustomer, name: e.target.value })
                          }
                          placeholder="株式会社〇〇"
                          autoFocus
                        />
                        <input
                          className="login-input"
                          value={quickCustomer.contact}
                          onChange={(e) =>
                            setQuickCustomer({ ...quickCustomer, contact: e.target.value })
                          }
                          placeholder="担当者（任意）"
                        />
                        <div className="quick-customer-actions">
                          <button
                            type="button"
                            className="btn subtle"
                            disabled={quickCustomerBusy}
                            onClick={() => setQuickCustomer(null)}
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            className="btn primary"
                            disabled={quickCustomerBusy || !quickCustomer.name.trim()}
                            onClick={async () => {
                              setQuickCustomerBusy(true);
                              try {
                                const result = await mutate(
                                  {
                                    type: "customer",
                                    name: quickCustomer.name,
                                    contact: quickCustomer.contact,
                                    email: "",
                                    address: "",
                                    notes: "",
                                  },
                                  true,
                                );
                                if (result?.id) {
                                  setForm((f: any) => ({ ...f, customerId: result.id }));
                                  setQuickCustomer(null);
                                }
                              } finally {
                                setQuickCustomerBusy(false);
                              }
                            }}
                          >
                            追加して選択
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Choose
                          value={form.customerId || ""}
                          onChange={(v) => setForm({ ...form, customerId: v })}
                          options={(state?.customers || []).map((c) => ({
                            value: c.id,
                            label: c.name,
                          }))}
                        />
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setQuickCustomer({ name: "", contact: "" })}
                        >
                          <Plus size={14} />
                          新しい取引先を追加
                        </button>
                      </>
                    )}
                  </Field>
                  <Field
                    label={form.kind === "receipt" ? "受領日 *" : "発行日 *"}
                  >
                    <input
                      type="date"
                      value={form.date || ""}
                      onChange={(e) =>
                        setForm({ ...form, date: e.target.value })
                      }
                    />
                  </Field>
                  {form.kind !== "receipt" && (
                    <Field
                      label={
                        form.kind === "estimate"
                          ? "見積の有効期限"
                          : "請求の支払期限"
                      }
                    >
                      <input
                        type="date"
                        disabled={!form.dueEnabled}
                        value={form.due || ""}
                        onChange={(e) =>
                          setForm({ ...form, due: e.target.value })
                        }
                      />
                      <label className="inline-check">
                        <Checkbox
                          checked={!form.dueEnabled}
                          onCheckedChange={(v) =>
                            setForm({
                              ...form,
                              dueEnabled: !v,
                              due: v ? "" : form.due,
                            })
                          }
                        />
                        期限を設けない
                      </label>
                    </Field>
                  )}
                  <Field
                    label={form.kind === "receipt" ? "但し書き" : "件名"}
                    wide
                  >
                    <input
                      placeholder="例：家具家電移動のお見積り"
                      value={form.title || ""}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <div className="editor-section-heading">
                  <h3>明細</h3>
                  <span>税抜単価 / 税は税率ごとに切捨て</span>
                </div>
                <div className="item-list">
                  {(form.items || []).map((item: Item, i: number) => (
                    <div className="item-card" key={i}>
                      <div className="item-card-head">
                        <span>明細 {String(i + 1).padStart(2, "0")}</span>
                        <button
                          className="icon-button"
                          aria-label={"明細" + (i + 1) + "を削除"}
                          disabled={form.items.length === 1}
                          onClick={() =>
                            setForm({
                              ...form,
                              items: form.items.filter(
                                (_: any, j: number) => i !== j,
                              ),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <Field label="項目・作業内容 *">
                        <PresetInput
                          value={item.description}
                          onChange={(v) =>
                            setForm({
                              ...form,
                              items: form.items.map((x: Item, j: number) =>
                                j === i ? { ...x, description: v } : x,
                              ),
                            })
                          }
                          options={
                            state?.company.itemPresets?.length
                              ? state.company.itemPresets
                              : defaultItems
                          }
                          placeholder="選択または直接入力"
                          label="項目・作業内容"
                        />
                      </Field>
                      <div className="item-numbers">
                        <Field label="数量">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.quantity}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                items: form.items.map((x: Item, j: number) =>
                                  j === i
                                    ? { ...x, quantity: Number(e.target.value) }
                                    : x,
                                ),
                              })
                            }
                          />
                        </Field>
                        <Field label="単位">
                          <PresetInput
                            value={item.unit}
                            onChange={(v) =>
                              setForm({
                                ...form,
                                items: form.items.map((x: Item, j: number) =>
                                  j === i ? { ...x, unit: v } : x,
                                ),
                              })
                            }
                            options={
                              state?.company.unitPresets?.length
                                ? state.company.unitPresets
                                : defaultUnits
                            }
                            placeholder="選択または直接入力"
                            label="単位"
                          />
                        </Field>
                        <Field label="単価（税抜）">
                          <input
                            type="text"
                            inputMode="text"
                            value={item.price || ""}
                            placeholder="値引きは -1000 のように入力"
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (!/^-?\d*$/.test(raw)) return;
                              setForm({
                                ...form,
                                items: form.items.map((x: Item, j: number) =>
                                  j === i ? { ...x, price: raw as any } : x,
                                ),
                              });
                            }}
                          />
                        </Field>
                        <Field label="税率">
                          <Choose
                            value={String(item.rate)}
                            onChange={(v) =>
                              setForm({
                                ...form,
                                items: form.items.map((x: Item, j: number) =>
                                  j === i ? { ...x, rate: Number(v) } : x,
                                ),
                              })
                            }
                            options={[
                              { value: "10", label: "10%" },
                              { value: "8", label: "8% 軽減" },
                              { value: "0", label: "非課税" },
                            ]}
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  className="add-line"
                  onClick={() =>
                    setForm({ ...form, items: [...form.items, blankItem()] })
                  }
                >
                  <Plus size={16} />
                  明細を追加
                </button>
                <div className="editor-total">
                  <span>合計（税込）</span>
                  <strong>
                    {yen(
                      (() => {
                        try {
                          return totals(form.items || []).total;
                        } catch {
                          return 0;
                        }
                      })(),
                    )}
                  </strong>
                </div>
                <Field label="備考">
                  <textarea
                    rows={3}
                    placeholder="作業内容やお支払条件など"
                    value={form.notes || ""}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </Field>
                {form.kind === "receipt" && (
                  <label className="check-field">
                    <Checkbox
                      checked={form.received}
                      onCheckedChange={(v) =>
                        setForm({ ...form, received: !!v })
                      }
                    />
                    記載した金額を実際に受領しました
                  </label>
                )}
              </>
            )}
            {(modal === "customer" || modal === "tenant") && (
              <div className="form-grid">
                <Field label="会社・取引先名 *" wide>
                  <input
                    value={form.name}
                    placeholder="株式会社 ○○"
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </Field>
                {modal === "customer" && (
                  <>
                    <Field label="担当者">
                      <input
                        value={form.contact}
                        onChange={(e) =>
                          setForm({ ...form, contact: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="メールアドレス">
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="住所" wide>
                      <input
                        value={form.address}
                        onChange={(e) =>
                          setForm({ ...form, address: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="備考" wide>
                      <textarea
                        rows={4}
                        value={form.notes || ""}
                        placeholder="取引先に関するメモを自由に入力できます"
                        onChange={(e) =>
                          setForm({ ...form, notes: e.target.value })
                        }
                      />
                    </Field>
                  </>
                )}
              </div>
            )}
            {modal === "settings" && (
              <>
                <div className="form-grid">
                  {[
                    ["会社名 *", "name"],
                    ["郵便番号", "postalCode"],
                    ["住所", "address"],
                    ["電話番号", "phone"],
                    ["メール", "email"],
                  ].map(([l, k]) => (
                    <Field label={l} key={k} wide={k === "address"}>
                      <input
                        value={form[k] || ""}
                        placeholder={k === "postalCode" ? "123-4567" : undefined}
                        onChange={(e) =>
                          setForm({ ...form, [k]: e.target.value })
                        }
                      />
                    </Field>
                  ))}
                  <Field label="担当者">
                    <PresetInput
                      value={form.contact || ""}
                      onChange={(v) => setForm({ ...form, contact: v })}
                      options={state?.company.contactPresets || []}
                      placeholder="選択または直接入力"
                      label="担当者"
                    />
                    <small>
                      候補は「項目・メール設定」画面でまとめて登録できます。
                    </small>
                  </Field>
                  <Field label="登録番号（T＋半角数字13桁）">
                    <input
                      value={form.registration || ""}
                      placeholder="T1234567890123"
                      onChange={(e) =>
                        setForm({ ...form, registration: e.target.value })
                      }
                    />
                    <small>全角数字は登録できません。半角で入力してください。</small>
                  </Field>
                  <Field label="振込先" wide>
                    <textarea
                      rows={3}
                      value={form.bank || ""}
                      onChange={(e) =>
                        setForm({ ...form, bank: e.target.value })
                      }
                      placeholder="銀行名・支店名・種別・口座番号・名義"
                    />
                  </Field>
                </div>
                <label className="check-field">
                  <Checkbox
                    checked={!!form.verified}
                    onCheckedChange={(v) => setForm({ ...form, verified: !!v })}
                  />
                  会社情報・登録番号・振込先を確認しました
                </label>
              </>
            )}
            {modal === "presets" && (
              <div className="form-grid">
                <Field label="項目・作業内容の候補" wide>
                  <textarea
                    rows={7}
                    value={form.itemPresets || ""}
                    onChange={(e) =>
                      setForm({ ...form, itemPresets: e.target.value })
                    }
                    placeholder={"家具移動\n搬入・設置\n養生作業"}
                  />
                </Field>
                <Field label="単位の候補" wide>
                  <textarea
                    rows={5}
                    value={form.unitPresets || ""}
                    onChange={(e) =>
                      setForm({ ...form, unitPresets: e.target.value })
                    }
                    placeholder={"式\n台\n個\n人\n時間"}
                  />
                </Field>
                <Field label="担当者の候補" wide>
                  <textarea
                    rows={5}
                    value={form.contactPresets || ""}
                    onChange={(e) =>
                      setForm({ ...form, contactPresets: e.target.value })
                    }
                    placeholder={"田中\n山田\n佐藤"}
                  />
                </Field>
              </div>
            )}
            {modal === "emailTemplates" && (
              <div className="template-form">
                <p className="template-help">
                  使用可能：{"{取引先名}"} {"{自社名}"} {"{件名}"} {"{書類名}"}{" "}
                  {"{書類番号}"}
                </p>
                {(["estimate", "invoice", "receipt"] as Kind[]).map((kind) => (
                  <Field label={labels[kind] + "の送付文章"} wide key={kind}>
                    <textarea
                      rows={7}
                      value={form[kind] || ""}
                      onChange={(e) =>
                        setForm({ ...form, [kind]: e.target.value })
                      }
                    />
                  </Field>
                ))}
              </div>
            )}
            {modal === "invite" && (
              <>
                {inviteLink ? (
                  <div className="invite-result">
                    <CheckCircle2 size={30} />
                    <h3>招待リンクを作成しました</h3>
                    <p>このリンクを {form.email} さんに送ってください。</p>
                    <textarea readOnly value={inviteLink} />
                    <button
                      className="btn"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inviteLink);
                          toast.success("コピーしました");
                        } catch {
                          toast.error("リンクを選択してコピーしてください");
                        }
                      }}
                    >
                      <Copy size={16} />
                      リンクをコピー
                    </button>
                  </div>
                ) : (
                  <div className="form-grid">
                    <Field label="招待する人のメールアドレス" wide>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="役割" wide>
                      <Choose
                        value={form.role}
                        onChange={(v) => setForm({ ...form, role: v })}
                        options={[
                          { value: "staff", label: "スタッフ（見積書の作成）" },
                          ...(role === "owner"
                            ? [
                                {
                                  value: "admin",
                                  label: "管理者（請求・領収・設定も操作）",
                                },
                              ]
                            : []),
                        ]}
                      />
                    </Field>
                  </div>
                )}
              </>
            )}
            {modal === "changePassword" && (
              <div className="form-grid">
                <Field label="現在のパスワード *" wide>
                  <input
                    type="password"
                    value={form.currentPassword || ""}
                    onChange={(e) =>
                      setForm({ ...form, currentPassword: e.target.value })
                    }
                  />
                </Field>
                <Field label="新しいパスワード *" wide>
                  <input
                    type="password"
                    minLength={8}
                    value={form.newPassword || ""}
                    onChange={(e) =>
                      setForm({ ...form, newPassword: e.target.value })
                    }
                  />
                </Field>
                <Field label="新しいパスワード（確認） *" wide>
                  <input
                    type="password"
                    minLength={8}
                    value={form.confirmPassword || ""}
                    onChange={(e) =>
                      setForm({ ...form, confirmPassword: e.target.value })
                    }
                  />
                </Field>
              </div>
            )}
          </div>
          <div className="dialog-actions">
            {state && (
              <button
                className="btn"
                disabled={busy}
                onClick={() => setModal("")}
              >
                閉じる
              </button>
            )}
            {["estimate", "invoice", "receipt", "edit"].includes(modal) ? (
              <>
                <button
                  className="btn"
                  disabled={busy || !canWrite}
                  onClick={() => submitDoc(false)}
                >
                  下書き保存
                </button>
                <button
                  className="btn primary"
                  disabled={busy || !canWrite}
                  onClick={() => submitDoc(true)}
                >
                  {busy ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  発行する
                </button>
              </>
            ) : modal === "invite" ? (
              !inviteLink && (
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={async () => {
                    const r = await mutate({ ...form, type: "invite" }, true);
                    if (r?.token)
                      setInviteLink(location.origin + "/?invite=" + r.token);
                  }}
                >
                  招待リンクを作成
                </button>
              )
            ) : (
              <button
                className="btn primary"
                disabled={busy}
                onClick={async () => {
                  if (modal === "tenant") {
                    setBusy(true);
                    try {
                      const r = await rawPost({
                        type: "createTenant",
                        name: form.name,
                      });
                      setModal("");
                      await switchTenant(r.id);
                      toast.success("会社アカウントを作成しました");
                    } catch (e: any) {
                      toast.error(e.message);
                    } finally {
                      setBusy(false);
                    }
                  } else if (modal === "changePassword") {
                    if (form.newPassword !== form.confirmPassword) {
                      toast.error("新しいパスワードが一致しません");
                      return;
                    }
                    setBusy(true);
                    try {
                      await rawPost({
                        type: "changePassword",
                        currentPassword: form.currentPassword,
                        newPassword: form.newPassword,
                      });
                      setModal("");
                      toast.success("パスワードを変更しました");
                    } catch (e: any) {
                      toast.error(e.message);
                    } finally {
                      setBusy(false);
                    }
                  } else if (modal === "presets")
                    await mutate({
                      type: "presets",
                      itemPresets: String(form.itemPresets || "").split(/\n/),
                      unitPresets: String(form.unitPresets || "").split(/\n/),
                      contactPresets: String(form.contactPresets || "").split(/\n/),
                    });
                  else if (modal === "emailTemplates")
                    await mutate({
                      type: "emailTemplates",
                      templates: {
                        estimate: form.estimate,
                        invoice: form.invoice,
                        receipt: form.receipt,
                      },
                    });
                  else
                    await mutate(
                      modal === "settings"
                        ? { type: "settings", company: form }
                        : { ...form, type: "customer" },
                    );
                }}
              >
                {busy ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Check size={16} />
                )}
                保存する
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Sheet
        open={!!current}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
      >
        <SheetContent side="right" className="document-sheet">
          <SheetHeader>
            <SheetTitle>{current ? labels[current.kind] : ""}の詳細</SheetTitle>
            <SheetDescription>
              {current?.number} <span className="dot-separator">·</span>{" "}
              発行時の内容を表示しています
            </SheetDescription>
          </SheetHeader>
          {current && (
            <>
              <div className="detail-tools">
                <Badge doc={current} />
                <div>
                  <button
                    className="icon-button"
                    aria-label="複製する"
                    onClick={() => open(current.kind, current)}
                  >
                    <Copy size={17} />
                  </button>
                  <button
                    className="btn"
                    onClick={() => pdf(current)}
                    disabled={busy}
                  >
                    <Download size={16} />
                    PDF
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => pdf(current, true)}
                    disabled={busy}
                  >
                    <Share2 size={16} />
                    共有
                  </button>
                </div>
              </div>
              <div className="sheet-scroll">
                {current.status !== "draft" && (
                  <iframe
                    className="issued-pdf-preview"
                    title={`${labels[current.kind]} PDFプレビュー`}
                    src={
                      "/api/document?tenant=" +
                      encodeURIComponent(tenantId) +
                      "&id=" +
                      encodeURIComponent(current.id) +
                      "&inline=1#page=1&view=Fit&zoom=page-fit&toolbar=0&navpanes=0"
                    }
                  />
                )}
                <article
                  className={`paper ${current.status !== "draft" ? "issued-paper-preview" : ""}`}
                >
                  <div className="paper-top">
                    <h2>{labels[current.kind]}</h2>
                    <span className="paper-date">
                      {current.number}
                      <br />
                      {current.kind === "receipt" ? "受領日" : "発行日"}：
                      {japaneseDate(current.date)}
                    </span>
                  </div>
                  <div className="paper-parties">
                    <div>
                      <strong className="paper-customer">
                        {current.customer.name} 御中
                      </strong>
                      <p>件名：{current.title}</p>
                    </div>
                    <div className="paper-company">
                      <dl>
                        <div>
                          <dt>会社名：</dt>
                          <dd>{current.company.name}</dd>
                        </div>
                        <div>
                          <dt>住　所：</dt>
                          <dd>{current.company.address}</dd>
                        </div>
                        <div>
                          <dt>ＴＥＬ：</dt>
                          <dd>{current.company.phone}</dd>
                        </div>
                        {current.company.registration && (
                          <div>
                            <dt>登録番号：</dt>
                            <dd>
                              {normalizeInvoiceNumber(
                                current.company.registration,
                              )}
                            </dd>
                          </div>
                        )}
                      </dl>
                      {current.company.stampKey && (
                        <img
                          src={
                            "/api/stamp?tenant=" +
                            encodeURIComponent(tenantId) +
                            "&v=" +
                            version
                          }
                          alt="角印"
                        />
                      )}
                    </div>
                  </div>
                  <div className="paper-amount">
                    <span>
                      {current.kind === "receipt"
                        ? "受領金額"
                        : "合計金額（税込）"}
                    </span>
                    <strong>{yen(current.total)}</strong>
                  </div>
                  <div className="paper-lines">
                    <div className="paper-line heading">
                      <span>摘要</span>
                      <span>数量</span>
                      <span>単位</span>
                      <span>単価</span>
                      <span>金額</span>
                    </div>
                    {Array.from(
                      { length: Math.max(12, current.items.length) },
                      (_, idx) => current.items[idx],
                    ).map((i, idx) => (
                      <div className="paper-line" key={idx}>
                        <span>
                          {i?.date && (
                            <small>
                              {i.date}
                              <br />
                            </small>
                          )}
                          {i?.description || ""}
                        </span>
                        <span>{i?.quantity ?? ""}</span>
                        <span>{i?.unit || ""}</span>
                        <span>{i ? yen(i.price) : ""}</span>
                        <span>
                          {i
                            ? yen(
                                Math.floor(
                                  (Math.round(i.quantity * 100) * i.price) /
                                    100,
                                ),
                              )
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="paper-totals">
                    <div>
                      <span>小計</span>
                      <b>{yen(current.subtotal)}</b>
                    </div>
                    {Object.entries(current.taxes).map(([r, t]) => (
                      <div key={r}>
                        <span>消費税({r}%)</span>
                        <b>{yen(t)}</b>
                      </div>
                    ))}
                    <div className="sum">
                      <span>合計</span>
                      <b>{yen(current.total)}</b>
                    </div>
                  </div>
                  {current.due && (
                    <p className="paper-notes">
                      {current.kind === "estimate" ? "有効期限" : "お支払期限"}
                      ：{current.due}
                    </p>
                  )}
                  {current.kind === "invoice" && current.company.bank && (
                    <p className="paper-notes">
                      お振込先
                      <br />
                      {current.company.bank}
                    </p>
                  )}
                  {current.notes && (
                    <p className="paper-notes">
                      備考
                      <br />
                      {current.notes}
                    </p>
                  )}
                  {state?.demo && (
                    <p className="sample-watermark">
                      SAMPLE — 実際の取引には使用できません
                    </p>
                  )}
                </article>
                <div className="detail-actions">
                  {current.status === "draft" ? (
                    <button
                      className="btn primary"
                      onClick={() => open("edit", current)}
                      disabled={!canWrite}
                    >
                      編集して発行
                    </button>
                  ) : current.status === "issued" ? (
                    <>
                      {current.kind === "estimate" && (
                        <button
                          className="btn primary"
                          disabled={!canManage || !canWrite}
                          onClick={() => open("invoice", current)}
                        >
                          請求書に転記
                          <ArrowRight size={16} />
                        </button>
                      )}
                      {current.kind === "invoice" && (
                        <button
                          className="btn primary"
                          disabled={!canManage || !canWrite}
                          onClick={() => open("receipt", current)}
                        >
                          領収書に転記
                          <ArrowRight size={16} />
                        </button>
                      )}
                      <button
                        className="btn"
                        onClick={() => {
                          requestId.current = crypto.randomUUID();
                          mutate({ type: "sent", id: current.id });
                        }}
                        disabled={!!current.sentAt || busy || !canWrite}
                      >
                        <Send size={16} />
                        {current.sentAt ? "送付記録済み" : "送付済みにする"}
                      </button>
                      <button
                        className="text-button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              emailBody(current),
                            );
                            toast.success("メール本文をコピーしました");
                          } catch {
                            toast.error("コピーできませんでした");
                          }
                        }}
                      >
                        <Mail size={16} />
                        メール本文をコピー
                      </button>
                    </>
                  ) : null}
                  {current.status !== "cancelled" && canManage && (
                    <button
                      className="text-button danger"
                      disabled={!canWrite}
                      onClick={() => {
                        setCancelId(current.id);
                        setReason("");
                      }}
                    >
                      書類を取り消す
                    </button>
                  )}
                  {current.status === "cancelled" && canManage && (
                    <button
                      className="text-button danger"
                      disabled={!canWrite}
                      onClick={() => setDeleteId(current.id)}
                    >
                      <Trash2 size={16} />
                      完全に削除
                    </button>
                  )}
                  {current.reason && (
                    <p className="notice">取消理由：{current.reason}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={!!cancelId}
        onOpenChange={(v) => {
          if (!v) setCancelId("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この書類を取り消しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              書類と取消履歴は保持されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field label="取消理由">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例：金額を訂正して再発行するため"
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>戻る</AlertDialogCancel>
            <AlertDialogAction
              disabled={!reason || busy}
              onClick={async () => {
                requestId.current = crypto.randomUUID();
                await mutate({ type: "cancel", id: cancelId, reason });
                setCancelId("");
              }}
            >
              取り消す
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(v) => {
          if (!v) setDeleteId("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この書類を完全に削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              取消済みの書類を完全に削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>戻る</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => {
                requestId.current = crypto.randomUUID();
                const id = deleteId;
                const r = await mutate({ type: "delete", id });
                setDeleteId("");
                if (r) setDetail(null);
              }}
            >
              完全に削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
