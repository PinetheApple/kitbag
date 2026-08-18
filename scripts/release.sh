#!/usr/bin/env bash
# Cuts a release: version, changelog, tag, signed APK, checksum, GitHub release.
#
# Every step that could publish something wrong runs before anything is pushed.
# The signature gate is the reason this script exists rather than a list of
# commands in a doc: an APK signed with the public debug key can never be
# upgraded by a properly-signed one, and that mistake is unrecoverable once the
# artifact is downloaded.
set -uo pipefail

readonly EXIT_FAILED=1
readonly EXIT_DIRTY=2
readonly EXIT_USAGE=3

DRY_RUN=0
SKIP_PREFLIGHT=0
VERSION=""

usage() {
  cat <<'USAGE'
usage: release.sh <major.minor.patch> [--dry-run] [--skip-preflight]

Cuts a release from the current branch's HEAD:
  preflight -> version bump -> changelog -> commit -> tag
  -> signed release APK -> signature gate -> versionName gate -> sha256
  -> push -> GitHub release with the APK and its checksum

Requires ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD and ANDROID_KEY_ALIAS
(see .env.example) and an authenticated `gh`.

  --dry-run          do everything local, push nothing and publish nothing
  --skip-preflight   trust an already-green gate run (CI does not skip)

exit 0  released
exit 1  a gate failed — nothing was pushed
exit 2  the working tree or branch is not in a releasable state
exit 3  usage error
USAGE
}

while (($#)); do
  case $1 in
    --dry-run) DRY_RUN=1 ;;
    --skip-preflight) SKIP_PREFLIGHT=1 ;;
    -h | --help)
      usage
      exit "$EXIT_USAGE"
      ;;
    -*)
      echo "release: unknown option $1" >&2
      exit "$EXIT_USAGE"
      ;;
    *) VERSION=$1 ;;
  esac
  shift
done

if [[ ! $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  usage >&2
  exit "$EXIT_USAGE"
fi

cd "$(git rev-parse --show-toplevel)"

readonly TAG="v${VERSION}"
readonly ARTIFACT="kitbag-${TAG}.apk"
readonly BUILT_APK=packages/app-shell/android/app/build/outputs/apk/release/app-release.apk

die() {
  echo "release: $1" >&2
  exit "${2:-$EXIT_FAILED}"
}

step() { printf '\033[1m==> %s\033[0m\n' "$1"; }

# --- Preconditions, before anything is written ------------------------------

[[ -z $(git status --porcelain) ]] || die "working tree is dirty — commit or stash first" "$EXIT_DIRTY"

if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  die "tag ${TAG} already exists" "$EXIT_DIRTY"
fi

current=$(./scripts/version.sh current)
# Same-version releases are the drift SPEC §2 was written about: two tags, one
# versionCode, and no way to tell which artifact a bug report came from.
[[ $current != "$VERSION" ]] || die "app.json is already ${VERSION}" "$EXIT_DIRTY"

for var in ANDROID_KEYSTORE_PATH ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS; do
  [[ -n ${!var-} ]] || die "${var} is unset — a release build without it is debug-signed" "$EXIT_DIRTY"
done

command -v gh >/dev/null || die "gh is not installed" "$EXIT_DIRTY"
((DRY_RUN)) || gh auth status >/dev/null 2>&1 || die "gh is not authenticated" "$EXIT_DIRTY"

if ((SKIP_PREFLIGHT)); then
  step "Preflight — skipped by request"
else
  step "Preflight — every gate CI runs"
  bash scripts/preflight.sh --no-fix || die "preflight failed"
fi

# --- Version, changelog, commit, tag ----------------------------------------

step "Version — ${current} -> ${VERSION}"
./scripts/version.sh set "$VERSION" || die "version bump failed"

step "Changelog — regenerate with ${TAG} titled"
bash scripts/changelog.sh --tag "$TAG" || die "changelog generation failed"

step "Commit and tag"
git add packages/app-shell/app.json package.json packages/app-shell/package.json CHANGELOG.md
git commit -m "chore(release): ${TAG}" || die "commit failed"
git tag -a "$TAG" -m "${TAG}" || die "tag failed"

# --- Build the artifact the tag names ---------------------------------------

step "Build — signed release APK"
rm -f "$BUILT_APK"
(cd packages/app-shell/android && ./gradlew :app:assembleRelease -q) || die "release build failed"
[[ -f $BUILT_APK ]] || die "build produced no APK at ${BUILT_APK}"

step "Signature gate"
./scripts/verify-apk-signature.sh "$BUILT_APK" || die "APK is unsigned or debug-signed — not publishing"

step "Version gate — the APK matches the tag"
aapt2=$(find "${ANDROID_HOME:-$HOME/Android/Sdk}/build-tools" -name aapt2 -type f 2>/dev/null | sort -V | tail -1)
if [[ -x $aapt2 ]]; then
  apk_version=$("$aapt2" dump badging "$BUILT_APK" | sed -n "s/.*versionName='\([^']*\)'.*/\1/p")
  [[ $apk_version == "$VERSION" ]] ||
    die "APK reports versionName ${apk_version}, tag says ${VERSION}"
  echo "    versionName ${apk_version}"
else
  echo "    aapt2 not found — cannot confirm the APK's versionName" >&2
fi

step "Artifact and checksum"
release_dir=$(mktemp -d)
cp "$BUILT_APK" "${release_dir}/${ARTIFACT}"
(cd "$release_dir" && sha256sum "$ARTIFACT" > "${ARTIFACT}.sha256")
cat "${release_dir}/${ARTIFACT}.sha256"

# --- Publish ----------------------------------------------------------------

if ((DRY_RUN)); then
  echo
  echo "release: dry run — ${TAG} is committed and tagged locally, nothing pushed."
  echo "  artifact: ${release_dir}/${ARTIFACT}"
  echo "  undo:     git tag -d ${TAG} && git reset --hard HEAD~1"
  exit 0
fi

step "Push ${TAG}"
branch=$(git rev-parse --abbrev-ref HEAD)
git push origin "$branch" || die "push failed"
git push origin "$TAG" || die "tag push failed"

step "GitHub release"
notes=$(git-cliff --tag "$TAG" --latest 2>/dev/null)
gh release create "$TAG" \
  "${release_dir}/${ARTIFACT}" \
  "${release_dir}/${ARTIFACT}.sha256" \
  --title "$TAG" \
  --notes "${notes:-See CHANGELOG.md}" || die "gh release create failed"

echo
echo "release: ${TAG} published with ${ARTIFACT} and its sha256"
