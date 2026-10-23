# ai-health-checker — Claude Code ガイド

## プロジェクト概要

個人のライフログを蓄積し、AIが長期分析できるプラットフォーム。

**現在のフェーズ**: MVP 実装済み・v1.0 リリース準備  
**将来のゴール**: 蓄積データを活かした長期分析（幸福度指数などの独自指標）への発展

> 詳細は `docs/` を参照：
> - [要件定義](docs/requirements.md) — データモデル・MVP スコープ・機能仕様
> - [アーキテクチャ設計](docs/architecture.md) — 全体構成・データフロー・ディレクトリ設計
> - [デザインシステム](docs/design-system.md) — デザイントークン・UI運用ルール

---

## アーキテクチャ（概要）

```
Firebase App Hosting（Next.js）
        ↓ Firebase Auth token
Cloud Run（FastAPI）
  ├── Firestore    ← CRUD
  ├── Claude API   ← AI 分析
  └── Email        ← 通知
        ↑
Cloud Scheduler（定期実行）
```

詳細: [docs/architecture.md](docs/architecture.md)

---

## テックスタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js / TypeScript（UI ライブラリは未定） |
| バックエンド | Python / FastAPI |
| 認証 | Firebase Auth |
| データベース | Firestore |
| AI | Anthropic Claude API（claude-haiku-4-5） |
| インフラ | Cloud Run（backend）/ Firebase App Hosting（frontend） |
| 通知 | Email |

---

## ディレクトリ構成

```
ai-health-checker/
├── backend/                      # FastAPI (Cloud Run)
│   ├── src/ai_health_checker/
│   │   ├── main.py               # FastAPI エントリーポイント
│   │   ├── dependencies.py       # 認証などの共通依存
│   │   ├── firebase_app.py       # Firebase Admin 初期化
│   │   ├── migrate_excel.py      # 既存 Excel → Firestore 移行スクリプト（ワンタイム）
│   │   ├── models/               # Pydantic モデル（log / analysis）
│   │   ├── routers/              # API ルーター（logs / analysis / reminders）
│   │   └── services/             # ビジネスロジック（log / analysis / llm / email / reminder）
│   ├── tests/
│   ├── requirements.in
│   └── requirements.txt
├── frontend/                     # Next.js (App Hosting)
│   ├── src/
│   │   ├── app/                  # App Router ページ（/ /login /logs /graph /reports）
│   │   ├── components/           # 画面コンポーネント（ui/ は汎用パーツ）
│   │   ├── context/              # AuthContext
│   │   ├── hooks/                # ロジック用カスタムフック
│   │   ├── lib/                  # APIクライアント・ユーティリティ
│   │   └── __tests__/            # Vitest ユニットテスト
│   ├── e2e/                      # Playwright E2E テスト
│   └── design-system/            # Claude Design 同期用プレビュー（@dsCard付きHTML）
├── docs/                         # 要件・設計ドキュメント
│   ├── requirements.md
│   ├── architecture.md
│   └── design-system.md
├── pyproject.toml                # ruff / black / mypy 設定
├── makefile
└── .github/workflows/
```

---

## 利用可能なコマンド

```bash
make venv        # 仮想環境セットアップ
make run         # FastAPI サーバー起動
make lint        # Ruff lint チェック
make lint-fix    # Ruff 自動修正 + Black フォーマット
make format      # Black フォーマットのみ
make typecheck   # mypy 型チェック
make test        # pytest 実行
make compile     # requirements.txt 更新（pip-compile）
make sync        # 環境を requirements.txt に同期
make clean       # venv 削除
```

---

## 環境変数

`.env` ファイルに以下を設定：

```
ANTHROPIC_API_KEY=  # Anthropic APIキー（ローカル開発用。本番 Cloud Run は Workload Identity Federation で認証し、キーは設定しない）
SCHEDULER_API_KEY=  # Cloud Scheduler トリガー認証用の共有シークレット
SMTP_HOST=          # レポート完了メール送信用（未設定の場合は送信をスキップ）
SMTP_PORT=          # 未設定時は 587
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=
```

---

## Git ワークフロー

- **main**: プロダクションブランチ。直接 commit・push 禁止
- **作業ブランチ**: `{prefix}/issue-{number}-{slug}` のみ。**develop ブランチは使用しない**
  - 例: `feature/issue-1-firestore-data-model`
  - プレフィックス: `feature`, `fix`, `chore`, `refactor`, `docs`, `test`
- **Issue 駆動開発**: 必ず GitHub Issue を起点に作業開始
- **commit メッセージ**: Conventional Commits 形式
  - `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`

---

## リリース運用

機能追加・バグ修正の PR が main へマージされたら、タグと GitHub Release を作成する。

- **バージョニング**: Semantic Versioning（`vX.Y.Z`）
  - 破壊的変更（データモデル・API の非互換変更）→ **major**
  - 機能追加（`feat`）→ **minor**
  - バグ修正・その他（`fix` / `chore` / `refactor` / `docs`）→ **patch**
- **タイミング**: マージごとに毎回打つ必要はなく、ユーザー影響のあるまとまりで打つ。複数 PR をまとめて1リリースにしてよい
- **手順**（main の最新を取り込んだ状態で実行）:

```bash
git log $(git describe --tags --abbrev=0)..origin/main --oneline  # 前回タグ以降の変更を確認
gh release create vX.Y.Z --target main --title "vX.Y.Z" --generate-notes
```

- リリースノートは `--generate-notes` を基本とし、ユーザー向けの補足があれば日本語で追記する
- Claude は main へのマージを確認したら、リリース作成をユーザーに提案するか、指示があれば作成まで行う

---

## 開発方針

- **優先順位**: データ入力・蓄積 → 分析機能
- **MVP データ**: `date`, `is_holiday`, `mood`, `fatigue`, `work_start`, `work_end`, `overtime_score`, `gym`, `comment`
- 最初から複雑な分析機能を作らない
- 蓄積されていないデータは後から取り戻せない
- 詳細スコープは [docs/requirements.md](docs/requirements.md) を参照

---

## CI

GitHub Actions（`.github/workflows/ci.yml`）が PR・main push 時に以下を実行：
- `ruff check backend/src/`（lint）
- `mypy backend/src/`（型チェック）

Claude は PR 作成前に必ず `make lint` と `make typecheck` を実行する。
