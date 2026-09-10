import { ArrowRight, Building2, Check, FileText, Receipt } from "lucide-react";
import { chatGPTSignInPath } from "./chatgpt-auth";

export default function LoginScreen() {
  const signInPath = chatGPTSignInPath("/");

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
          <p className="login-help">本人確認後、所属する会社の画面を開きます。</p>
          <a className="login-primary" href={signInPath} target="_top">
            ログインする <ArrowRight size={18} />
          </a>
          <div className="login-divider"><span>はじめて利用する方</span></div>
          <a className="login-secondary" href={signInPath} target="_top">
            <Building2 size={18} />会社アカウントを作る
          </a>
          <ul className="login-assurance">
            <li><Check size={14} />会社ごとにデータを分けて保存</li>
            <li><Check size={14} />登録後すぐに書類作成を開始</li>
          </ul>
          <p className="login-footnote">ログインにはChatGPTアカウントを使用します。</p>
        </div>
      </section>
    </main>
  );
}
