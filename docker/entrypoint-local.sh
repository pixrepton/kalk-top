#!/bin/bash
# NOTE: no set -e — cp errors for junctions/hardlinks are non-fatal

REPO_ROOT=/kalk-top
WP_ROOT="${KALK_TOP_WP_ROOT:-/opt/topinstal-runtime/wordpress}"
PLUGIN_DIR="$WP_ROOT/wp-content/plugins/topinstal-heatpump-calculator"
WP_TEMPLATE=/opt/topinstal-wordpress
SQLITE_PLUGIN_TEMPLATE=/opt/topinstal-sqlite-plugin/sqlite-database-integration
export KALK_TOP_WP_ROOT="$WP_ROOT"

echo "=== kalk-top local Docker entrypoint ==="

ensure_wordpress_runtime() {
    mkdir -p "$WP_ROOT"

    if [ ! -f "$WP_ROOT/wp-load.php" ]; then
        echo "Bootstrapping WordPress core into $WP_ROOT..."
        cp -a "$WP_TEMPLATE/." "$WP_ROOT/"
    fi

    mkdir -p "$WP_ROOT/wp-content/plugins"
    if [ ! -f "$WP_ROOT/wp-content/plugins/sqlite-database-integration/load.php" ]; then
        echo "Installing SQLite database integration plugin..."
        rm -rf "$WP_ROOT/wp-content/plugins/sqlite-database-integration"
        cp -a "$SQLITE_PLUGIN_TEMPLATE" "$WP_ROOT/wp-content/plugins/"
    fi

    if [ ! -f "$WP_ROOT/wp-content/db.php" ]; then
        cp "$WP_ROOT/wp-content/plugins/sqlite-database-integration/db.copy" "$WP_ROOT/wp-content/db.php"
    fi
    mkdir -p "$WP_ROOT/wp-content/database"

    if [ ! -f "$WP_ROOT/wp-config.php" ]; then
        cat > "$WP_ROOT/wp-config.php" <<'PHP'
<?php
define('DB_NAME', 'topinstal_local');
define('DB_USER', 'topinstal');
define('DB_PASSWORD', 'topinstal');
define('DB_HOST', 'localhost');
define('DB_CHARSET', 'utf8');
define('DB_COLLATE', '');

define('WP_DEBUG', true);
define('WP_DEBUG_DISPLAY', false);
define('WP_DEBUG_LOG', true);
define('FS_METHOD', 'direct');
define('AUTOMATIC_UPDATER_DISABLED', true);
define('WP_ENVIRONMENT_TYPE', 'local');

$table_prefix = 'wp_';

if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}

require_once ABSPATH . 'wp-settings.php';
PHP
    fi

    if [ ! -f "$WP_ROOT/_router.php" ]; then
        cat > "$WP_ROOT/_router.php" <<'PHP'
<?php
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (is_string($path) && $path !== '/') {
    $file = __DIR__ . $path;
    if (is_file($file)) {
        return false;
    }
}
require __DIR__ . '/index.php';
PHP
    fi
}

ensure_wordpress_installed() {
    WP_ROOT="$WP_ROOT" php <<'PHP'
<?php
define('WP_INSTALLING', true);
$wp_root = getenv('WP_ROOT');
if (!is_string($wp_root) || $wp_root === '') {
    fwrite(STDERR, "WP_ROOT is not set\n");
    exit(1);
}

require_once $wp_root . '/wp-load.php';

if (!function_exists('is_blog_installed')) {
    require_once ABSPATH . 'wp-includes/functions.php';
}

if (!is_blog_installed()) {
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    wp_install(
        'TOP-INSTAL kalk-top local',
        'operator',
        'operator@topinstal.local',
        true,
        '',
        'local-dev-password'
    );
}
PHP
}

ensure_wordpress_runtime
if [ ! -f "$WP_ROOT/wp-load.php" ] || [ ! -f "$WP_ROOT/_router.php" ]; then
    echo "FATAL: incomplete WordPress runtime in $WP_ROOT" >&2
    exit 1
fi

ensure_wordpress_installed

# Remove NTFS junctions (appear as symlinks in WSL2) or broken non-directory entries
# so that mkdir + cp can create a real directory in their place.
# Note: [ -d ] returns true for symlinks pointing to dirs, so we MUST check [ -L ] first.
cleanup_junction() {
    local dest="$1"
    if [ -L "$dest" ]; then
        echo "  removing symlink/junction: $dest"
        rm -f "$dest"
    elif [ -e "$dest" ] && [ ! -d "$dest" ]; then
        echo "  removing broken entry: $dest"
        rm -f "$dest"
    fi
}

mkdir -p "$PLUGIN_DIR"

echo "Syncing plugin files to $PLUGIN_DIR..."

# Use find-based copy for all top-level plugin dirs.
# WSL2 bind mounts may not expose all subdirectory entries to readdir() (cp -rf sees only
# what readdir() returns). Using find -mindepth 1 -maxdepth 1 enumerates correctly.
copy_dir_safe() {
    local src="$1"
    local dest_parent="$2"
    local dir_name
    dir_name=$(basename "$src")
    cleanup_junction "$dest_parent/$dir_name"
    mkdir -p "$dest_parent/$dir_name"
    # Copy top-level items individually via find to bypass WSL2 readdir() truncation
    find "$src" -mindepth 1 -maxdepth 1 | while IFS= read -r item; do
        cp -rf "$item" "$dest_parent/$dir_name/" 2>/dev/null || true
    done
    echo "  synced: $dir_name"
}

for dir in core docs frontend img kalkulator konfigurator libraries; do
    if [ -d "$REPO_ROOT/$dir" ]; then
        copy_dir_safe "$REPO_ROOT/$dir" "$PLUGIN_DIR"
    fi
done

# wp-adapter has nested subdirs — do two-level find-based copy
if [ -d "$REPO_ROOT/wp-adapter" ]; then
    cleanup_junction "$PLUGIN_DIR/wp-adapter"
    mkdir -p "$PLUGIN_DIR/wp-adapter"
    find "$REPO_ROOT/wp-adapter" -mindepth 1 -maxdepth 1 | while IFS= read -r item; do
        name=$(basename "$item")
        if [ -d "$item" ]; then
            mkdir -p "$PLUGIN_DIR/wp-adapter/$name"
            find "$item" -mindepth 1 -maxdepth 1 | while IFS= read -r sub; do
                cp -rf "$sub" "$PLUGIN_DIR/wp-adapter/$name/" 2>/dev/null || true
            done
        else
            cp -f "$item" "$PLUGIN_DIR/wp-adapter/" 2>/dev/null || true
        fi
    done
    echo "  synced: wp-adapter (deep)"
fi

# Hard-linked files produce "are the same file" warnings — suppress and continue
for file in AGENTS.md COMPAT_POINTERS.md heatpump-calculator.php preview.php README.md; do
    if [ -f "$REPO_ROOT/$file" ]; then
        cp -f "$REPO_ROOT/$file" "$PLUGIN_DIR/" 2>/dev/null || true
    fi
done

# Sync fast-kalk plugin if mounted
FASTKALK_PLUGIN_DIR="$WP_ROOT/wp-content/plugins/topinstal-lead-widget"
FASTKALK_SRC="/fast-kalk/wp-content/plugins/topinstal-lead-widget"
if [ -d "$FASTKALK_SRC" ]; then
    cleanup_junction "$FASTKALK_PLUGIN_DIR"
    cp -rf "$FASTKALK_SRC" "$WP_ROOT/wp-content/plugins/" 2>/dev/null || true
    echo "  synced: topinstal-lead-widget (fast-kalk)"
fi

# Configure WordPress (sets siteurl, activates plugins)
export KALK_TOP_RUNTIME_BASE_URL="${KALK_TOP_RUNTIME_BASE_URL:-http://localhost:8091}"
echo "Configuring WordPress at $KALK_TOP_RUNTIME_BASE_URL..."
cd "$REPO_ROOT/scripts"
if php configure-runtime-wp.php; then
    echo "WordPress configured OK"
else
    echo "WARN: configure-runtime-wp.php failed (may be first run without DB); continuing"
fi

echo "=== Starting PHP built-in server at 0.0.0.0:8091 ==="
cd "$WP_ROOT"

# Periodic Node B heartbeat (P3.11)
if [ -n "${NODE_B_REGISTRY_TOKEN:-}" ]; then
  KALK_HEARTBEAT_BASE="${NODE_B_REGISTRY_BASE_URL:-http://host.docker.internal:8766}"
  (
    while true; do
      curl -sf -X POST "${KALK_HEARTBEAT_BASE%/}/internal/os-events" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${NODE_B_REGISTRY_TOKEN}" \
        -d '{"event_type":"service_heartbeat","source_repo":"kalk-top","engagement_id":"","payload":{"schema_version":"topinstal.os_event.v1","summary_pl":"kalk-top heartbeat","status":"ok"},"correlation":{}}' \
        >/dev/null 2>&1 || true
      sleep 900
    done
  ) &
fi

exec php -S 0.0.0.0:8091 -t . _router.php
