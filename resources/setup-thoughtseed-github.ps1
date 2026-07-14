param(
  [switch]$Check
)

$ErrorActionPreference = 'Stop'
$organization = 'thoughtseed-labs'
$organizationId = 65741640L
$allowedFounders = @{ sheshiyer = 7611727L; psychon7 = 47470954L }
$setupUrl = 'plexus://github/setup/v1'

foreach ($entry in @(Get-ChildItem Env:)) {
  if (@(
    'PATH', 'PATHEXT', 'HOME', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA',
    'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME',
    'TMPDIR', 'TEMP', 'TMP', 'SYSTEMROOT', 'COMSPEC', 'LANG', 'LC_ALL',
    'LC_CTYPE', 'TERM', 'NO_COLOR'
  ) -notcontains $entry.Name.ToUpperInvariant()) {
    Remove-Item "Env:$($entry.Name)" -ErrorAction SilentlyContinue
  }
}

try {
  $ghCommand = (Get-Command gh -ErrorAction Stop).Source
  & $ghCommand auth status --hostname github.com 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'not authenticated' }
} catch {
  Write-Error 'Setup stopped safely: GitHub CLI is unavailable or not authenticated through its credential store. Install gh, then run gh auth login --hostname github.com.'
  exit 1
}

try {
  $user = & $ghCommand api user | ConvertFrom-Json
  $membership = & $ghCommand api "user/memberships/orgs/$organization" | ConvertFrom-Json
} catch {
  Write-Error 'Setup stopped safely: GitHub verification failed. Run gh auth refresh --hostname github.com --scopes read:org.'
  exit 1
}

$login = [string]$user.login
$accountId = 0L
if (-not [long]::TryParse([string]$user.id, [ref]$accountId) -or $accountId -le 0) {
  Write-Error 'Setup stopped safely: GitHub did not return an immutable numeric account id.'
  exit 1
}
$normalizedLogin = $login.ToLowerInvariant()
if (-not $allowedFounders.ContainsKey($normalizedLogin)) {
  Write-Error "Setup stopped safely: GitHub CLI is authenticated as $login, not an allowed Thoughtseed Labs founder."
  exit 1
}
if ($accountId -ne $allowedFounders[$normalizedLogin]) {
  Write-Error 'Setup stopped safely: founder login does not match its pinned public GitHub account id. Deliberately update the allowlist only after verifying a legitimate rename.'
  exit 1
}
if ([string]$membership.state -ne 'active' -or [string]$membership.organization.login -ne $organization -or [long]$membership.organization.id -ne $organizationId) {
  Write-Error "Setup stopped safely: $login does not have active $organization membership."
  exit 1
}

Write-Output "Verified $login (GitHub account $accountId) as an active $organization member."
Write-Output 'Installation owners available in Plexus: thoughtseed-labs (#65741640), Sheshiyer (#7611727), psychon7 (#47470954).'
if ($Check) {
  Write-Output 'Preflight passed. Plexus was not opened because -Check was used.'
  exit 0
}
Start-Process $setupUrl
Write-Output 'Plexus is opening at Settings > GitHub. Complete in-app verification; this preflight grants no authority.'
