import importlib
from collections.abc import Iterator

import httpx
import pytest
from fastapi.testclient import TestClient

from ai_health_checker import main

PRIMARY_ORIGIN = "https://ai-health-checker.nokono.net"
LEGACY_ORIGIN = "https://ai-health-checker.shunniehub.com"
UNKNOWN_ORIGIN = "https://evil.example.com"


@pytest.fixture
def cors_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """CORS_ALLOWED_ORIGINS に複数オリジンを設定した状態で app を組み立て直す"""
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", f"{PRIMARY_ORIGIN},{LEGACY_ORIGIN}")
    reloaded = importlib.reload(main)
    yield TestClient(reloaded.app)
    monkeypatch.undo()
    importlib.reload(main)


def preflight(client: TestClient, origin: str) -> httpx.Response:
    return client.options(
        "/logs",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
    )


class TestCors:
    @pytest.mark.parametrize("origin", [PRIMARY_ORIGIN, LEGACY_ORIGIN])
    def test_should_allow_preflight_when_origin_is_configured(
        self, cors_client: TestClient, origin: str
    ) -> None:
        response = preflight(cors_client, origin)

        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin

    def test_should_reject_preflight_when_origin_is_not_configured(
        self, cors_client: TestClient
    ) -> None:
        response = preflight(cors_client, UNKNOWN_ORIGIN)

        assert response.status_code == 400
        assert "access-control-allow-origin" not in response.headers
