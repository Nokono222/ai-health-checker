.PHONY: venv run run-emulator emulator stop lint lint-fix format typecheck test e2e compile sync upgrade clean docker-build docker-up docker-down

VENV = venv
STAMP = $(VENV)/.installed

# Windows: Scripts/  Linux/macOS (devcontainer): bin/
ifeq ($(OS),Windows_NT)
  PYTHON = py -3.14
  VENV_SCRIPTS = $(VENV)/Scripts
else
  PYTHON = python3
  VENV_SCRIPTS = $(VENV)/bin
endif

VENV_PYTHON = $(VENV_SCRIPTS)/python
PIP = $(VENV_SCRIPTS)/pip

# venvは一度だけ作る
$(VENV_SCRIPTS)/activate:
	$(PYTHON) -m venv $(VENV)

# requirementsが更新されたらpip installだけ実行
# ローカルは開発ツール・移行スクリプトも要るので dev 側を入れる（本番は requirements.txt のみ）
$(STAMP): backend/requirements-dev.txt $(VENV_SCRIPTS)/activate
	$(PIP) install -r backend/requirements-dev.txt
	$(VENV_PYTHON) -c "open('$(STAMP)', 'w').close()"

venv: $(STAMP)

run: venv
	PYTHONPATH=backend/src $(VENV_SCRIPTS)/uvicorn ai_health_checker.main:app --reload --port 8000

# エミュレータに接続してバックエンドを起動（make emulator と併用）
run-emulator: venv
	FIRESTORE_EMULATOR_HOST=localhost:8080 \
	FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
	PYTHONPATH=backend/src $(VENV_SCRIPTS)/uvicorn ai_health_checker.main:app --reload --port 8000

# Firebase Emulator Suite 起動（Auth: 9099 / Firestore: 8080 / UI: 4000）
emulator:
	firebase emulators:start --project ai-health-checker-stg --only auth,firestore

# 開発で使う全ポートのプロセスを停止
# 3000: Next.js / 8000: backend / 8080: Firestore emulator / 9099: Auth emulator / 4000: Emulator UI
stop:
	@for port in 3000 8000 8080 9099 4000; do \
		fuser -k $$port/tcp 2>/dev/null && echo "killed :$$port" || true; \
	done
	@echo "done"

# requirements.txtを更新(ロック更新)。本番用と開発用の両方を再生成する
compile:
	$(VENV_SCRIPTS)/pip-compile backend/requirements.in --output-file backend/requirements.txt
	$(VENV_SCRIPTS)/pip-compile backend/requirements-dev.in --output-file backend/requirements-dev.txt

# requirements-dev.txtに従ってpip install(環境同期)
sync:
	$(VENV_SCRIPTS)/pip-sync backend/requirements-dev.txt

# requirements.txtを更新し、pip install
upgrade:
	$(VENV_SCRIPTS)/pip-compile --upgrade backend/requirements.in --output-file backend/requirements.txt
	$(VENV_SCRIPTS)/pip-compile --upgrade backend/requirements-dev.in --output-file backend/requirements-dev.txt

lint: venv
	$(VENV_PYTHON) -m ruff check backend/src/

lint-fix: venv
	$(VENV_PYTHON) -m ruff check --fix backend/src/
	$(VENV_PYTHON) -m black backend/src/

format: venv
	$(VENV_PYTHON) -m black backend/src/

typecheck: venv
	$(VENV_PYTHON) -m mypy backend/src/

test: venv
	PYTHONPATH=backend/src $(VENV_PYTHON) -m pytest backend/tests/ -v; \
	exit_code=$$?; [ $$exit_code -eq 5 ] && exit 0 || exit $$exit_code

# E2E テスト（エミュレータ + backend + frontend を起動して Playwright 実行）
e2e: venv
	firebase emulators:exec --project ai-health-checker-stg --only auth,firestore \
		"cd frontend && npx playwright test"

docker-build:
	docker compose build

docker-up:
	docker compose up

docker-down:
	docker compose down

# venvを削除
clean:
	rm -rf $(VENV)
