#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

mkdir -p .githooks

cat > .githooks/pre-commit <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(git rev-parse --show-toplevel)"
cd "$REPO_DIR"

if ! git diff --cached --quiet -- apps/field-android && [[ -x apps/field-android/scripts/android-v3-guardrails.sh ]]; then
  apps/field-android/scripts/android-v3-guardrails.sh --staged
fi

if git diff --cached --name-only | grep -q '^apps/report-platform/'; then
  apps/report-platform/scripts/report-platform-guardrails.sh --standard
fi
HOOK

cat > .githooks/pre-push <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(git rev-parse --show-toplevel)"
cd "$REPO_DIR"

if [[ "${ANDROID_V3_PRE_PUSH_GUARDRAILS:-1}" == "1" && -x apps/field-android/scripts/android-v3-guardrails.sh ]]; then
  apps/field-android/scripts/android-v3-guardrails.sh --branch
fi

upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
if [[ -n "$upstream" ]]; then
  changed_against_upstream="$(git diff --name-only "$upstream"..HEAD || true)"
else
  changed_against_upstream="$(git show --name-only --pretty=format: HEAD || true)"
fi

if printf '%s\n' "$changed_against_upstream" | grep -q '^apps/report-platform/'; then
  apps/report-platform/scripts/report-platform-guardrails.sh --standard
fi
HOOK

chmod +x .githooks/pre-commit
chmod +x .githooks/pre-push
git config core.hooksPath .githooks

echo "Installed combined Android/report-platform Git hooks in .githooks and configured core.hooksPath."
