import { Building2, FileText, Receipt } from "lucide-react";
import LoginFormVps from "./login-form-vps";

export default function LoginScreenVps() {
  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-wordmark">folio<span>.</span></div>
        <div className="login-message">
          <p className="eyebrow">DOCUMENTS, MADE SIMPLE</p>
          <h1>見積から領収まで、<br />スマホでシンプルに。</h1>
          <p>会社ごとの専用ワークスペースで、<br />大切な書類を安全に管理します。</p>
        </div>
        <div className="login-flow" aria-label="作成できる書類">
          <span><FileText size={18} />見積書</span><i />
          <span><Building2 size={18} />請求書</span><i />
          <span><Receipt size={18} />領収書</span>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="mobile-login-logo">folio<span>.</span></div>
          <p className="eyebrow">WELCOME TO FOLIO</p>
          <h2>会社アカウントへログイン</h2>
          <p className="login-help">メールアドレスとパスワードでログインします。</p>
          <LoginFormVps />
        </div>
      </section>
    </main>
  );
}
