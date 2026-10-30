#!/usr/bin/env bash
# =============================================================================
# vps-update.sh — update the Incident Manager plugin on a tak-stack VPS without
# losing its deployment settings (config.local.ts and deployment/).
#
# Run it from the plugin checkout inside CloudTAK:
#   ~/tak-stack/CloudTAK/app/plugins/incident-manager/scripts/vps-update.sh [options]
#
#   1. Backs up config.local.ts and deployment/ outside the CloudTAK tree
#      (~/tak-stack/plugin-config-backups/incident-manager/).
#   2. Pulls the branch (fast-forward only).
#   3. Puts config.local.ts / deployment/ back if they are missing, and lists
#      settings that are new in config.local.example.ts.
#   4. With --rebuild: runs ~/tak-stack/cloudtak-update.sh rebuild + restart and
#      checks the running image has config.local.ts.
#
# Options:  --branch <name>   branch to pull (default: multi-op)
#           --rebuild         rebuild and restart CloudTAK after updating
#           --init            create config.local.ts from the example if none exists
#           -y | --yes        skip confirmations (also passed to cloudtak-update.sh)
#
# Env:      STACK_DIR         tak-stack directory (default: ~/tak-stack)
# =============================================================================
set -Eeuo pipefail

# Everything runs inside main(), so bash has read the whole file before
# `git pull` can replace it.
main() {
    local branch="multi-op" rebuild=0 init=0
    ASSUME_YES=0
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --branch) branch="${2:?--branch needs a name}"; shift ;;
            --rebuild) rebuild=1 ;;
            --init) init=1 ;;
            -y|--yes) ASSUME_YES=1 ;;
            -h|--help) sed -n '2,24p' "${BASH_SOURCE[0]}"; exit 0 ;;
            *) die "Unknown option: $1 (see --help)" ;;
        esac
        shift
    done

    local plugin_dir; plugin_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    local plugin_name; plugin_name="$(basename "$plugin_dir")"
    local stack_dir="${STACK_DIR:-$HOME/tak-stack}"
    local backup_root="$stack_dir/plugin-config-backups/$plugin_name"
    local config="$plugin_dir/config.local.ts"
    local example="$plugin_dir/config.local.example.ts"
    local staged="$plugin_dir/deployment"
    g() { git -C "$plugin_dir" "$@"; }

    hdr "Plugin"
    [[ -d "$plugin_dir/.git" ]] || die "$plugin_dir is not a git checkout"
    info "folder:  $plugin_dir"
    info "branch:  $(g branch --show-current || echo detached)"
    info "commit:  $(g log --oneline -1 | cut -c1-70)"
    [[ -z "$(g status --porcelain --untracked-files=no)" ]] \
        || die "Plugin has uncommitted changes to tracked files — commit or stash them first (git -C $plugin_dir status)"
    ok "No uncommitted changes to tracked files"

    hdr "Back up settings -> $backup_root"
    local ts; ts="$(date +%Y%m%d-%H%M%S)"
    if [[ -f "$config" || -d "$staged" ]]; then
        mkdir -p "$backup_root/$ts" "$backup_root/latest"
        if [[ -f "$config" ]]; then
            cp -a "$config" "$backup_root/$ts/" && cp -a "$config" "$backup_root/latest/"
            ok "config.local.ts backed up ($backup_root/$ts/)"
        fi
        if [[ -d "$staged" ]]; then
            cp -a "$staged" "$backup_root/$ts/" && rm -rf "$backup_root/latest/deployment" \
                && cp -a "$staged" "$backup_root/latest/"
            ok "deployment/ backed up ($(find "$staged" -type f | wc -l | tr -d ' ') file(s))"
        fi
    else
        warn "No config.local.ts or deployment/ in the plugin folder — nothing to back up"
    fi

    hdr "Update ($branch)"
    local before; before="$(g rev-parse HEAD)"
    g fetch --quiet --tags origin || die "git fetch origin failed"
    if [[ "$(g branch --show-current)" != "$branch" ]]; then
        confirm "Switch the plugin from '$(g branch --show-current || echo detached)' to '$branch'?"
        g checkout --quiet "$branch" || die "git checkout $branch failed"
    fi
    g pull --quiet --ff-only origin "$branch" || die "git pull --ff-only failed (local commits on $branch?)"
    if [[ "$(g rev-parse HEAD)" == "$before" ]]; then
        ok "Already up to date ($(g log --oneline -1 | cut -c1-60))"
    else
        ok "Updated to $(g log --oneline -1 | cut -c1-60)"
        g log --oneline "$before..HEAD" | sed 's/^/      /'
    fi

    hdr "Settings check"
    if [[ ! -f "$config" && -f "$backup_root/latest/config.local.ts" ]]; then
        cp -a "$backup_root/latest/config.local.ts" "$config"
        warn "config.local.ts was missing — restored from $backup_root/latest/"
    fi
    if [[ ! -d "$staged" && -d "$backup_root/latest/deployment" ]]; then
        cp -a "$backup_root/latest/deployment" "$staged"
        warn "deployment/ was missing — restored from $backup_root/latest/"
    fi
    if [[ ! -f "$config" && $init -eq 1 ]]; then
        cp "$example" "$config"
        ok "Created config.local.ts from the example — edit it, then rebuild"
    fi

    if [[ -f "$config" ]]; then
        ok "config.local.ts present ($(wc -c <"$config" | tr -d ' ') bytes, modified $(date -r "$config" '+%F %R'))"
        if cmp -s "$config" "$example"; then
            warn "config.local.ts is still the unedited example — the build will use the built-in defaults"
        fi
        local missing; missing="$(comm -23 <(setting_keys "$example") <(setting_keys "$config") | tr '\n' ' ')"
        if [[ -n "${missing// /}" ]]; then
            warn "New settings in config.local.example.ts not in your config.local.ts (built-in defaults apply):"
            info "  $missing"
            info "  Copy the lines you want from config.local.example.ts."
        else
            ok "config.local.ts has every setting in the example"
        fi
    else
        warn "No config.local.ts — the build will use the built-in defaults (rerun with --init to create one)"
    fi

    if [[ $rebuild -eq 0 ]]; then
        hdr "Next"
        info "Rebuild:  $0 --rebuild"
        info "     or:  cd $stack_dir && ./cloudtak-update.sh rebuild && ./cloudtak-update.sh restart"
        exit 0
    fi

    hdr "Rebuild CloudTAK"
    local updater="$stack_dir/cloudtak-update.sh"
    [[ -x "$updater" ]] || die "$updater not found or not executable"
    local yes=(); [[ $ASSUME_YES -eq 1 ]] && yes=(-y)
    (cd "$stack_dir" && "$updater" rebuild "${yes[@]}") || die "cloudtak-update.sh rebuild failed"
    (cd "$stack_dir" && "$updater" restart "${yes[@]}") || die "cloudtak-update.sh restart failed"

    hdr "Verify running image"
    local in_image="/home/etl/app/plugins/$plugin_name/config.local.ts"
    if [[ -f "$config" ]]; then
        if (cd "$stack_dir" && docker compose exec -T cloudtak-api test -f "$in_image"); then
            ok "Running cloudtak-api has $in_image"
        else
            die "Running cloudtak-api does NOT have $in_image — settings were not built in"
        fi
    else
        info "No config.local.ts, so nothing to verify"
    fi
    ok "Done"
}

# ------------------------------- helpers -------------------------------------
B=$(tput bold 2>/dev/null || true); R=$(tput sgr0 2>/dev/null || true)
G=$(tput setaf 2 2>/dev/null || true); Y=$(tput setaf 3 2>/dev/null || true); E=$(tput setaf 1 2>/dev/null || true)
hdr()  { printf "\n%s== %s ==%s\n" "$B" "$*" "$R"; }
ok()   { printf "  %s✔%s %s\n" "$G" "$R" "$*"; }
warn() { printf "  %s⚠%s %s\n" "$Y" "$R" "$*"; }
info() { printf "    %s\n" "$*"; }
die()  { printf "\n  %s✘ %s%s\n\n" "$E" "$*" "$R" >&2; exit 1; }

confirm() {
    local ans
    [[ $ASSUME_YES -eq 1 ]] && return 0
    [[ -t 0 ]] || die "Confirmation needed but no terminal — rerun with -y if intended"
    read -r -p "  $1 [y/N]: " ans
    [[ "$ans" == [yY] ]] || die "Aborted"
}

# Top-level keys of the deploymentDefaults object, one per line, sorted.
setting_keys() {
    grep -oE '^[[:space:]]+[A-Za-z0-9_]+:' "$1" | tr -d ' \t:' | sort -u
}

main "$@"
