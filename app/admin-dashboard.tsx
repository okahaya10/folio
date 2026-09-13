"use client";
import { useEffect, useState } from "react";
import { Building2, Copy, LogOut, ShieldCheck } from "lucide-react";

type Tenant = {
  id: string;
  name: string;
  status: "active" | "read_only" | "suspended";
  plan: string;
  owner_email: string | null;
};

const statusLabel: Record<Tenant["status"], string> = {
  active: "利用中",
  read_only: "閲覧専用",
  suspended: "利用停止",
};

function randomPassword() {
  return crypto
    .getRandomValues(new Uint32Array(3))
    .reduce((s, n) => s + n.toString(36), "")
    .slice(0, 12);
}

export default function AdminDashboard() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(randomPassword());
  const [formError, setFormError] = useState("");
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/admin");
      const data = (await res.json()) as { error?: string; tenants?: Tenant[] };
      if (!res.ok) {
        setLoadError(data.error || "取得に失敗しました");
        setTenants([]);
        return;
      }
      setTenants(data.tenants ?? []);
      setLoadError("");
    } catch {
      setLoadError("通信に失敗しました");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const grantAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "grantAccount", companyName, contactName, email, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFormError(data.error || "発行に失敗しました");
        return;
      }
      setIssued({ email, password });
      setCompanyName("");
      setContactName("");
      setEmail("");
      setPassword(randomPassword());
      await load();
    } catch {
      setFormError("通信に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (tenantId: string, status: string) => {
    setBusy(true);
    try {
      await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "contract", tenant: tenantId, status }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken, json: "true" }),
      });
    } catch {
      // Fall through to the reload below regardless — if signout genuinely
      // didn't reach the server, the page's own session check will just
      // redirect to /login again and the user can retry.
    }
    window.location.href = "/login";
  };

  return (
    <main className="admin-page">
      <header className="admin-header">
        <ShieldCheck size={22} />
        <h1>Folio 運営管理</h1>
        <button type="button" className="btn subtle admin-logout" title="ログアウト" onClick={logout}>
          <LogOut size={16} />
          ログアウト
        </button>
      </header>

      {loadError && <p className="login-error admin-permission-error">{loadError}</p>}

      <section className="panel admin-panel">
        <div className="panel-heading">
          <div>
            <h2>会社アカウントを発行</h2>
            <p>クライアントの会社名・担当者メールを入力して、ログイン情報を発行します。</p>
          </div>
        </div>
        <form className="admin-grant-form" onSubmit={grantAccount}>
          <label className="field">
            <span>会社名 *</span>
            <input
              className="login-input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="株式会社〇〇"
              required
            />
          </label>
          <label className="field">
            <span>担当者名</span>
            <input
              className="login-input"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="山田 太郎"
            />
          </label>
          <label className="field">
            <span>メールアドレス *</span>
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              required
            />
          </label>
          <label className="field">
            <span>初期パスワード *</span>
            <div className="admin-password-row">
              <input
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <button type="button" className="btn subtle" onClick={() => setPassword(randomPassword())}>
                再生成
              </button>
            </div>
          </label>
          {formError && <p className="login-error">{formError}</p>}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "発行中…" : "会社アカウントを発行する"}
          </button>
        </form>
        {issued && (
          <div className="admin-issued-box">
            <p>発行しました。以下をクライアントに安全な方法で伝えてください（この画面を閉じると再表示できません）。</p>
            <p>
              <strong>メール：</strong>
              {issued.email}
            </p>
            <p>
              <strong>初期パスワード：</strong>
              {issued.password}
              <button
                type="button"
                className="text-button"
                onClick={() => navigator.clipboard?.writeText(issued.password)}
              >
                <Copy size={14} />
                コピー
              </button>
            </p>
          </div>
        )}
      </section>

      <section className="panel admin-panel">
        <div className="panel-heading">
          <div>
            <h2>会社ワークスペース</h2>
            <p>各社が作成したアカウントの利用状態を管理します。</p>
          </div>
          <span className="count-pill">{tenants?.length ?? 0}社</span>
        </div>
        {tenants?.map((t) => (
          <div className="tenant-row" key={t.id}>
            <span className="customer-avatar">
              <Building2 size={22} />
            </span>
            <div>
              <strong>{t.name}</strong>
              <small>{t.owner_email || t.plan}</small>
            </div>
            <select
              className="admin-status-select"
              value={t.status}
              disabled={busy}
              onChange={(e) => changeStatus(t.id, e.target.value)}
            >
              {(Object.keys(statusLabel) as Tenant["status"][]).map((s) => (
                <option key={s} value={s}>
                  {statusLabel[s]}
                </option>
              ))}
            </select>
          </div>
        ))}
        {tenants && tenants.length === 0 && !loadError && <p className="quiet">まだ会社がありません。</p>}
      </section>
    </main>
  );
}
