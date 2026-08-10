from unittest.mock import MagicMock

import anthropic
import pytest

from ai_health_checker.services import llm_service

TEST_USER_ID = "test-user-id"


def _make_mock_client(text_blocks: list[str]) -> MagicMock:
    client = MagicMock()
    content = []
    for text in text_blocks:
        block = MagicMock()
        block.type = "text"
        block.text = text
        content.append(block)
    client.messages.create.return_value.content = content
    return client


class TestGenerateAnalysisReport:
    def test_should_return_text_from_claude_response(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_client = _make_mock_client(["疲労度と残業時間に強い相関があります。"])
        monkeypatch.setattr(
            anthropic, "Anthropic", MagicMock(return_value=mock_client)
        )

        result = llm_service.generate_analysis_report(
            "ログを分析してください。", TEST_USER_ID
        )

        assert result == "疲労度と残業時間に強い相関があります。"

    def test_should_call_claude_with_prompt_and_user_metadata(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_client = _make_mock_client(["ok"])
        monkeypatch.setattr(
            anthropic, "Anthropic", MagicMock(return_value=mock_client)
        )

        llm_service.generate_analysis_report("プロンプト", TEST_USER_ID)

        kwargs = mock_client.messages.create.call_args.kwargs
        assert kwargs["messages"] == [{"role": "user", "content": "プロンプト"}]
        assert kwargs["metadata"] == {"user_id": TEST_USER_ID}
        assert kwargs["model"] == "claude-haiku-4-5"

    def test_should_use_focus_specific_instructions_in_system_prompt(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_client = _make_mock_client(["ok"])
        monkeypatch.setattr(
            anthropic, "Anthropic", MagicMock(return_value=mock_client)
        )

        llm_service.generate_analysis_report("プロンプト", TEST_USER_ID, "fatigue")

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "疲労度の推移" in system
        assert "全体的な傾向" not in system

    def test_should_use_general_instructions_by_default(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_client = _make_mock_client(["ok"])
        monkeypatch.setattr(
            anthropic, "Anthropic", MagicMock(return_value=mock_client)
        )

        llm_service.generate_analysis_report("プロンプト", TEST_USER_ID)

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "全体的な傾向" in system

    def test_should_fall_back_to_general_for_unknown_focus(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_client = _make_mock_client(["ok"])
        monkeypatch.setattr(
            anthropic, "Anthropic", MagicMock(return_value=mock_client)
        )

        llm_service.generate_analysis_report("プロンプト", TEST_USER_ID, "unknown")

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "全体的な傾向" in system

    def test_should_join_multiple_text_blocks(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_client = _make_mock_client(["前半。", "後半。"])
        monkeypatch.setattr(
            anthropic, "Anthropic", MagicMock(return_value=mock_client)
        )

        result = llm_service.generate_analysis_report("プロンプト", TEST_USER_ID)

        assert result == "前半。後半。"

    def test_should_ignore_non_text_blocks(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_client = MagicMock()
        thinking_block = MagicMock()
        thinking_block.type = "thinking"
        text_block = MagicMock()
        text_block.type = "text"
        text_block.text = "本文"
        mock_client.messages.create.return_value.content = [
            thinking_block,
            text_block,
        ]
        monkeypatch.setattr(
            anthropic, "Anthropic", MagicMock(return_value=mock_client)
        )

        result = llm_service.generate_analysis_report("プロンプト", TEST_USER_ID)

        assert result == "本文"
