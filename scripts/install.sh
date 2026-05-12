#!/usr/bin/env bash
set -e
RED='\033[0;31m' GREEN='\033[0;32m' BLUE='\033[0;34m' YELLOW='\033[1;33m' CYAN='\033[0;36m' NC='\033[0m' BOLD='\033[1m'
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; } log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; } log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

detect_os() { case "$(uname -s)" in Linux*) echo "linux";; Darwin*) echo "macos";; MINGW*|MSYS*|CYGWIN*) echo "windows";; esac; }
is_wsl() { grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; }
check_cmd() { command -v "$1" >/dev/null 2>&1; }
detect_dl() { check_cmd curl && echo "curl" || (check_cmd wget && echo "wget" || echo "none"); }

check_node() {
    if ! check_cmd node; then log_error "Node.js not found. Install from https://nodejs.org"; return 1; fi
    local v=$(node -v | sed 's/v//' | cut -d. -f1)
    [[ $v -lt 18 ]] && log_error "Node.js must be >= 18. Current: $(node -v)" && return 1
    log_success "Node.js $(node -v)"; return 0
}

check_npm() { check_cmd npm && log_success "npm $(npm -v)" || { log_error "npm not found"; return 1; }; }
check_docker() { check_cmd docker && docker info >/dev/null 2>&1 && log_success "Docker detected" || return 1; }
check_git() { check_cmd git && log_success "Git detected" || log_warn "Git not found"; }

install_npm() { log_step "Installing via npm..."; log_info "Run: npx freeswap"; log_success "Done!"; }
install_docker() {
    log_step "Installing via Docker..."
    cd "$(dirname "$0")/.."
    docker build -t freeswap:latest . && log_success "Run: docker run --rm -it freeswap" || log_error "Docker build failed"
}
install_local() {
    log_step "Installing locally..."
    cd "$(dirname "$0")/.."
    npm install && npm run build && log_success "Run: npm start" || log_error "Local install failed"
}

create_env() {
    local env_file="$(dirname "$0")/../.env"
    [[ -f "$env_file" ]] && log_warn ".env exists" && return 0
    log_step "Creating .env..."
    cat > "$env_file" << 'EOF'
# FreeSwap Environment
SOLANA_RPC_URL=
# WALLET_PRIVATE_KEY=
# SOLANA_RPC_URL_BACKUP=
# JITO_RPC_URL=
# DEBUG=false
EOF
    log_success ".env created"
}

show_welcome() {
    echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════╗
║              🎉 Installation Complete!                   ║
╚═══════════════════════════════════════════════════════╝${NC}
${BOLD}Next steps:${NC}
  1. Edit .env with your configuration
  2. Run: npx freeswap (npm) | docker run freeswap | npm start (local)

  Docs: https://github.com/freeswap/docs
"
}

main() {
    echo -e "${CYAN}
╔═══════════════════════════════════════════════════════╗
║               🚀 FreeSwap Installer                    ║
╚═══════════════════════════════════════════════════════╝${NC}"

    local os=$(detect_os); log_info "OS: $os"; is_wsl && log_info "WSL detected"

    log_step "Checking prerequisites..."
    check_node || exit 1; check_npm || exit 1
    local has_docker=false; check_docker && has_docker=true; check_git
    log_info "Downloader: $(detect_dl)"

    echo -e "\n${BOLD}Select installation:${NC}
  ${GREEN}1${NC}) npm (npx freeswap) - Quick, works everywhere
  ${GREEN}2${NC}) Docker              - Containerized
  ${GREEN}3${NC}) Local build         - From source
  ${GREEN}4${NC}) Skip                - Just create .env
"
    echo -n "Enter choice [1-4]: "; read -r ch
    case "$ch" in 1) install_npm;; 2) $has_docker && install_docker || { log_error "Docker unavailable"; install_npm; };; 3) install_local;; 4) log_info "Skipped";; *) log_error "Invalid"; exit 1;; esac

    create_env; show_welcome
}
main "$@"