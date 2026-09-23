# ai-health-checker

個人のライフログを蓄積し、AI が長期分析できるプラットフォーム。

## 概要

毎日の気分・疲労・勤務時間などを記録し、AI（Claude API）による分析で  
「幸福度が高い日の共通点」「疲労の傾向」「残業と体調の関係」などを可視化する。

## アーキテクチャ

```
Firebase App Hosting（Next.js）
        ↓ Firebase Auth token
Cloud Run（FastAPI）
  ├── Firestore    ← CRUD
  ├── Claude API   ← AI 分析
  └── Email        ← 通知
```

## テックスタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js / TypeScript |
| バックエンド | Python / FastAPI |
| 認証 | Firebase Auth |
| データベース | Firestore |
| AI | Anthropic Claude API（claude-haiku-4-5） |
| インフラ | Cloud Run / Firebase App Hosting |

## セットアップ

### バックエンド

```bash
make venv    # 仮想環境セットアップ
make sync    # 依存関係インストール
make run     # FastAPI サーバー起動（http://localhost:8000）
```

### フロントエンド

```bash
cd frontend
npm install
npm run dev  # 開発サーバー起動（http://localhost:3000）
```

### Firebase エミュレータ

```bash
make emulator      # Auth + Firestore エミュレータ起動
make run-emulator  # エミュレータに接続してバックエンド起動
```

### 環境変数

`frontend/.env.local` を `.env.local.example` をもとに作成：

```bash
cp frontend/.env.local.example frontend/.env.local
```

## ローカル動作確認の2パターン

### パターン1: フル emulator（日常開発）

実環境に一切接続せず、ローカルで完結する構成。

```bash
make emulator      # ターミナル1: Auth + Firestore エミュレータ
make run-emulator  # ターミナル2: バックエンド（エミュレータ接続）
cd frontend && npm run dev  # ターミナル3: フロントエンド
```

- `frontend/.env.local` に `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` を設定する
- `make run-emulator` は `FIRESTORE_EMULATOR_HOST` を設定するため、
  `.env` に `GOOGLE_APPLICATION_CREDENTIALS` があってもエミュレータ接続が優先される

### パターン2: 実 stg 接続（結合確認）

実 Firebase Auth・Firestore（staging）に接続してエンドツーエンドで確認する構成。

```bash
make run                    # ターミナル1: バックエンド（.env の GOOGLE_APPLICATION_CREDENTIALS で実 Firestore に接続）
cd frontend && npm run dev  # ターミナル2: フロントエンド
```

- `frontend/.env.local` に `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false` を設定し、
  実 Firebase プロジェクト（stg）の `NEXT_PUBLIC_FIREBASE_*` を設定する
- **注意**: staging の実データを読み書きするため、確認後は不要データを削除すること

> エミュレータのフロントとバックエンドを混在させると、エミュレータ発行の
> Auth トークンを実 Firebase Auth が検証できず 401 になる。
> フロント・バックエンドは必ず同じパターンに揃えること。

## 開発コマンド

```bash
make lint        # Ruff lint チェック
make lint-fix    # Ruff 自動修正 + Black フォーマット
make typecheck   # mypy 型チェック
make test        # pytest 実行
make e2e         # E2E テスト（Playwright + フルエミュレータ構成）
```

E2E テストはエミュレータ + ローカル backend/frontend を自動起動して実行する
（実 stg には接続しない）。ポート 3000 / 8000 / 8080 / 9099 を使用するため、
起動中のプロセスがあれば `make stop` で停止しておくこと。

## デプロイ（staging）

| 対象 | ホスティング | URL | トリガー |
|---|---|---|---|
| フロントエンド | Firebase App Hosting（asia-east1） | https://ai-health-checker.nokono.net （旧ドメイン https://ai-health-checker.shunniehub.com は 2027 年に閉鎖予定 / デフォルトURL: https://ai-health-checker--ai-health-checker-stg.asia-east1.hosted.app ） | main への push（`frontend/` を含むコミットで自動ロールアウト） |
| バックエンド | Cloud Run（asia-northeast1） | https://ai-health-checker-api-yoieoj4i7a-an.a.run.app | main への push（`backend/**`）or `deploy-backend.yml` の手動実行 |
| Firestore rules | Firebase | — | main への push（`deploy-staging.yml`） |

- フロントの環境変数は `frontend/apphosting.yaml`（Secret Manager 参照）で管理
- バックエンドのシークレットは GCP Secret Manager から `--set-secrets` で注入（`deploy-backend.yml`）

## AI 分析の API 利用料の目安

AI 分析は Anthropic Claude API（claude-haiku-4-5）を使用する。従量課金のため、利用料の目安を以下に示す。

**単価**（2026年7月時点）: 入力 $1 / 出力 $5（100万トークンあたり）

**1回の分析あたり**（30日分のログを `count_tokens` API で実測）:

| 項目 | トークン数 | 料金 |
|---|---|---|
| 入力（システムプロンプト + 30日分のログ） | 約 2,700 | 約 $0.003 |
| 出力（400字程度のレポート） | 約 350 | 約 $0.002 |
| **合計** | — | **約 $0.005（約 0.7 円）** |

出力が上限（`max_tokens=2048`）に達した場合でも 1 回あたり約 $0.013（約 2 円）。

**月額の目安**（1ドル150円で換算）:

| 利用パターン | 回数/月 | 月額 |
|---|---|---|
| 月次の定期分析のみ | 1 | 約 $0.005（約 0.7 円） |
| 定期分析 + オンデマンド分析を週数回 | 約 20 | 約 $0.09（約 14 円） |
| 毎日オンデマンド分析を実行 | 約 30 | 約 $0.14（約 20 円） |

ログの日数・コメントの長さに応じて入力トークン数は増減する。最新の単価は [Anthropic の料金ページ](https://claude.com/pricing#api) を参照。

## ドキュメント

- [要件定義](docs/requirements.md)
- [アーキテクチャ設計](docs/architecture.md)
- [デザインシステム](docs/design-system.md)

## ライセンス

[MIT License](LICENSE) — Copyright (c) 2026 Shunnie816
