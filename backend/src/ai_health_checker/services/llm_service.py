import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import anthropic

_MODEL = "claude-haiku-4-5"

# フェデレーションルールの audience と一致させる JWT の aud
_FEDERATION_AUDIENCE = "https://api.anthropic.com"

# 分析の切り口ごとのレポート観点（#107）
_FOCUS_INSTRUCTIONS: dict[str, str] = {
    "general": """\
- 全体的な傾向（気分・疲労度・残業の推移）
- 項目間の関係で注目すべき点（例: 残業が多い日の翌朝の気分、運動と疲労の関係）
- データに基づく、来週に向けた具体的なアドバイス（1〜2点）""",
    "fatigue": """\
- 疲労度の推移と、疲労が高かった日のパターン
- 疲労と他項目（残業・運動・休日・気分）の関係で注目すべき点
- 疲労を溜めないための具体的なアドバイス（1〜2点）""",
    "overtime_mood": """\
- 残業スコアと気分（朝・終業後）の関係
- 残業が続いた期間が翌日以降の気分へ与えた影響
- 残業と気分の付き合い方についての具体的なアドバイス（1〜2点）""",
    "gym": """\
- ジムに行った日と行かなかった日の気分・疲労度の違い
- ジム習慣の頻度と継続の傾向
- 運動習慣を続ける・活かすための具体的なアドバイス（1〜2点）""",
}

_SYSTEM_PROMPT_TEMPLATE = """\
あなたは個人のライフログ（気分・疲労度・勤務時間・運動・コメント）を\
分析するアシスタントです。与えられた期間のログから以下を日本語でレポートしてください。

{instructions}

制約:
- 記録されたデータから言えることだけを述べ、憶測は「可能性があります」と明示する
- 見出し記号や Markdown は使わず、段落分けしたプレーンテキストで書く
- 全体で400字程度に収める"""


def _fetch_google_identity_token() -> str:
    """Cloud Run のメタデータサーバーから Google 署名の ID トークンを取得する。"""
    import google.auth.transport.requests
    import google.oauth2.id_token

    return str(
        google.oauth2.id_token.fetch_id_token(  # type: ignore[no-untyped-call]
            google.auth.transport.requests.Request(), _FEDERATION_AUDIENCE
        )
    )


def _create_client() -> "anthropic.Anthropic":
    """認証方式を環境変数から選んで Anthropic クライアントを作る（#136）。

    ANTHROPIC_API_KEY があれば API キーを優先する（ローカル開発・移行期間用）。
    キーがなく ANTHROPIC_FEDERATION_RULE_ID があれば Workload Identity Federation
    で認証する。どちらも無い場合は SDK 既定の解決に任せる。
    """
    # anthropic の import はバックエンド全体の import コストの大半を占めるため、
    # AI 分析を実行するときだけ読み込む。ログ取得など他のエンドポイントの
    # コールドスタートからこのコストを外すのが目的（#125）
    import anthropic

    rule_id = os.environ.get("ANTHROPIC_FEDERATION_RULE_ID")
    if os.environ.get("ANTHROPIC_API_KEY") or not rule_id:
        return anthropic.Anthropic()
    return anthropic.Anthropic(
        credentials=anthropic.WorkloadIdentityCredentials(
            identity_token_provider=_fetch_google_identity_token,
            federation_rule_id=rule_id,
            organization_id=os.environ["ANTHROPIC_ORGANIZATION_ID"],
            service_account_id=os.environ["ANTHROPIC_SERVICE_ACCOUNT_ID"],
            workspace_id=os.environ.get("ANTHROPIC_WORKSPACE_ID"),
        )
    )


def generate_analysis_report(
    prompt: str, user_id: str, focus: str = "general"
) -> str:
    """ログを整形したプロンプトから分析レポート本文を生成する。

    focus に応じてレポートの観点を切り替える（未知の値は総合にフォールバック）。
    認証方式（API キー / Workload Identity Federation）は _create_client が解決する。
    """
    instructions = _FOCUS_INSTRUCTIONS.get(focus, _FOCUS_INSTRUCTIONS["general"])
    client = _create_client()
    response = client.messages.create(
        model=_MODEL,
        max_tokens=2048,
        system=_SYSTEM_PROMPT_TEMPLATE.format(instructions=instructions),
        messages=[{"role": "user", "content": prompt}],
        metadata={"user_id": user_id},
    )
    return "".join(
        block.text for block in response.content if block.type == "text"
    )
