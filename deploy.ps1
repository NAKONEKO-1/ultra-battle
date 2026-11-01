# 一键发布到 GitHub Pages
# 用法：装好 GitHub CLI 并登录后，在本目录运行  .\deploy.ps1

$ErrorActionPreference = "Stop"

Write-Host "检查 GitHub CLI..." -ForegroundColor Cyan
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "没装 gh。先运行：winget install --id GitHub.cli" -ForegroundColor Red
    exit 1
}

$auth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "还没登录，先运行：gh auth login" -ForegroundColor Red
    exit 1
}

$repo = "ultra-battle"
Write-Host "创建仓库 $repo ..." -ForegroundColor Cyan

# 初始化本地仓库并推送
git init -b main 2>$null
git add .
git commit -m "初代怪兽对战 · 初版" 2>$null

$user = gh api user --jq .login
Write-Host "当前账号：$user" -ForegroundColor Green

gh repo create $repo --public --source=. --remote=origin --push 2>&1

Write-Host "开启 Pages ..." -ForegroundColor Cyan
gh api "repos/$user/$repo/pages" -X POST -f "source[branch]=main" -f "source[path]=/" 2>&1

Write-Host ""
Write-Host "完成。链接（可能需等 1-2 分钟生效）：" -ForegroundColor Green
Write-Host "https://$user.github.io/$repo/" -ForegroundColor Yellow
