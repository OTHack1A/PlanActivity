# Pianifica Robustness Test Suite
# Usage: .\tests\robustness_test.ps1 -MasterPass "<master password>"
#   or:  $env:PIANIFICA_MASTER_TEST_PASS = "<master password>"; .\tests\robustness_test.ps1
# Requires the backend running on localhost:8000.
#
# The master password is NOT hardcoded here — it is supplied at run time so no
# clear-text password ever lives in the repository.

param(
    [string]$Base = "http://localhost:8000",
    [string]$MasterUser = $env:PIANIFICA_MASTER_TEST_USER,
    [string]$MasterPass = $env:PIANIFICA_MASTER_TEST_PASS
)

# The suite authenticates as the emergency master account; without its
# credentials it cannot proceed. The master username and password are NOT
# hardcoded here so no secret lives in the repository — supply them at run time.
if (-not $MasterUser -or -not $MasterPass) {
    Write-Host "Set PIANIFICA_MASTER_TEST_USER and PIANIFICA_MASTER_TEST_PASS (or -MasterUser/-MasterPass)." -ForegroundColor Yellow
    exit 2
}

$pass = 0; $fail = 0

function chk {
    param([string]$label, [bool]$ok, [string]$got = "")
    if ($ok) {
        Write-Host "  [PASS] $label" -ForegroundColor Green
        $script:pass++
    } else {
        $extra = if ($got) { " (got $got)" } else { "" }
        Write-Host "  [FAIL] $label$extra" -ForegroundColor Red
        $script:fail++
    }
}

function api {
    param([string]$method, [string]$path, $body, [string]$token, [int]$expect = 200)
    $headers = @{ "Content-Type" = "application/json" }
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    $uri = "$Base$path"
    try {
        if ($body -ne $null) {
            $json = $body | ConvertTo-Json -Depth 10
            $resp = Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -Body $json -ErrorAction Stop
        } else {
            $resp = Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -ErrorAction Stop
        }
        $ok = ($expect -ge 200 -and $expect -lt 300)
        return [pscustomobject]@{ ok = $ok; code = 200; body = $resp }
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return [pscustomobject]@{ ok = ($code -eq $expect); code = $code; body = $null }
    }
}

function upload {
    param([string]$path, [byte[]]$data, [string]$fname, [string]$ct, [string]$token, [int]$expect = 204)
    $hdr  = [System.Text.Encoding]::ASCII.GetBytes("--X`r`nContent-Disposition: form-data; name=`"file`"; filename=`"$fname`"`r`nContent-Type: $ct`r`n`r`n")
    $foot = [System.Text.Encoding]::ASCII.GetBytes("`r`n--X--`r`n")
    $combined = New-Object byte[] ($hdr.Length + $data.Length + $foot.Length)
    [System.Buffer]::BlockCopy($hdr,  0, $combined, 0,                          $hdr.Length)
    [System.Buffer]::BlockCopy($data, 0, $combined, $hdr.Length,                $data.Length)
    [System.Buffer]::BlockCopy($foot, 0, $combined, $hdr.Length + $data.Length, $foot.Length)
    $headers = @{ "Content-Type" = "multipart/form-data; boundary=X" }
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    try {
        $r = Invoke-WebRequest -Method Post -Uri "$Base$path" -Headers $headers -Body $combined -ErrorAction Stop
        $ok = ($r.StatusCode -eq $expect)
        return [pscustomobject]@{ ok = $ok; code = $r.StatusCode }
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return [pscustomobject]@{ ok = ($code -eq $expect); code = $code }
    }
}

# Byte arrays for upload tests
$jpg  = [byte[]]@(0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00)
$png  = [byte[]]@(0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52)
$fake = [System.Text.Encoding]::UTF8.GetBytes("<html>not an image</html>")
$big  = New-Object byte[] (2*1024*1024 + 1)
$big[0] = 0xFF; $big[1] = 0xD8; $big[2] = 0xFF; $big[3] = 0xE0

# ===========================================================================
Write-Host "`n=== 1. Public endpoints ===" -ForegroundColor Cyan

$r = api GET "/api/auth/status"
chk "GET /auth/status: 200" $r.ok $r.code

# ===========================================================================
Write-Host "`n=== 2. Login ===" -ForegroundColor Cyan

$r = api POST "/api/auth/login" @{user=$MasterUser; password=$MasterPass}
chk "Master login: 200" $r.ok $r.code
$tok = $r.body.access_token
if (-not $tok) { Write-Host "ABORT: no token" -ForegroundColor Red; exit 1 }

$r = api POST "/api/auth/login" @{user=$MasterUser; password="WRONG"} -expect 401
chk "Wrong password: 401" $r.ok $r.code

$r = api POST "/api/auth/login" @{user=("x"*51); password="p"} -expect 422
chk "Username >50 chars: 422" $r.ok $r.code

$r = api POST "/api/auth/login" @{user="u"; password=("p"*129)} -expect 422
chk "Password >128 chars: 422" $r.ok $r.code

$r = api POST "/api/auth/login" @{} -expect 422
chk "Empty login body: 422" $r.ok $r.code

# Rate limiting: 3 failures lock on 4th attempt
$rl = "rl_probe_$(Get-Random)"
$r = api POST "/api/auth/login" @{user=$rl; password="bad"} -expect 401
chk "Rate limit - attempt 1: 401" $r.ok $r.code
$r = api POST "/api/auth/login" @{user=$rl; password="bad"} -expect 401
chk "Rate limit - attempt 2: 401" $r.ok $r.code
$r = api POST "/api/auth/login" @{user=$rl; password="bad"} -expect 401
chk "Rate limit - attempt 3 (triggers lockout): 401" $r.ok $r.code
$r = api POST "/api/auth/login" @{user=$rl; password="bad"} -expect 429
chk "Rate limit - attempt 4 (locked): 429" $r.ok $r.code
$r = api POST "/api/auth/login" @{user=$rl; password="bad"} -expect 429
chk "Rate limit - attempt 5 (still locked): 429" $r.ok $r.code

# ===========================================================================
Write-Host "`n=== 3. Auth guard ===" -ForegroundColor Cyan

# FastAPI 0.138 returns 401 (not 403) for missing bearer
$r = api GET "/api/employees" -expect 401
chk "No token: 401" $r.ok $r.code

$r = api GET "/api/employees" -token "not.a.valid.jwt" -expect 401
chk "Malformed JWT: 401" $r.ok $r.code

# ===========================================================================
Write-Host "`n=== 4. Departments ===" -ForegroundColor Cyan

$r = api GET "/api/departments" -token $tok
chk "GET /departments: 200" $r.ok $r.code

$r = api POST "/api/departments" @{name="TestReparto"; color="#ff0000"} -token $tok -expect 201
chk "Create dept: 201" $r.ok $r.code
$dep = $r.body

$r = api POST "/api/departments" @{name=("x"*81); color="#000"} -token $tok -expect 422
chk "Dept name >80 chars: 422" $r.ok $r.code

$r = api POST "/api/departments" @{color="#fff"} -token $tok -expect 422
chk "Dept missing name: 422" $r.ok $r.code

# Department update is not supported (delete+recreate pattern in UI)
$r = api PATCH "/api/departments/anything" @{name="x"} -token $tok -expect 405
chk "PATCH dept not supported: 405" $r.ok $r.code

$r = api DELETE "/api/departments/zzz9999" -token $tok -expect 404
chk "Delete non-existent dept: 404" $r.ok $r.code

# ===========================================================================
Write-Host "`n=== 5. Employees ===" -ForegroundColor Cyan

$emp = $null
if ($dep) {
    $r = api POST "/api/employees" @{name="Mario Rossi"; role="Meccanico"; departmentId=$dep.id; overtime="1.5"} -token $tok -expect 201
    chk "Create employee: 201" $r.ok $r.code
    $emp = $r.body

    $r = api POST "/api/employees" @{name=("n"*81); role="r"; departmentId=$dep.id} -token $tok -expect 422
    chk "Emp name >80 chars: 422" $r.ok $r.code

    $r = api POST "/api/employees" @{name="ok"; role=("r"*81); departmentId=$dep.id} -token $tok -expect 422
    chk "Emp role >80 chars: 422" $r.ok $r.code

    $r = api POST "/api/employees" @{name="x"; role=""; departmentId="zzz9999"} -token $tok -expect 404
    chk "Emp with bogus deptId: 404" $r.ok $r.code

    if ($emp) {
        $r = api PATCH "/api/employees/$($emp.id)" @{role="Elettrauto"} -token $tok
        chk "Patch employee: 200" $r.ok $r.code

        $r = api PATCH "/api/employees/zzz9999" @{role="x"} -token $tok -expect 404
        chk "Patch non-existent emp: 404" $r.ok $r.code
    }
}

$r = api GET "/api/employees" -token $tok
chk "GET /employees: 200" $r.ok $r.code

# ===========================================================================
Write-Host "`n=== 6. Avatar upload ===" -ForegroundColor Cyan

if ($emp) {
    $eid = $emp.id

    $r = upload "/api/employees/$eid/avatar" $jpg "photo.jpg" "image/jpeg" $tok 204
    chk "Valid JPG avatar: 204" $r.ok $r.code

    $r = upload "/api/employees/$eid/avatar" $png "photo.png" "image/png" $tok 204
    chk "Valid PNG avatar: 204" $r.ok $r.code

    $r = upload "/api/employees/$eid/avatar" $fake "evil.jpg" "image/jpeg" $tok 415
    chk "Fake file disguised as JPG: 415" $r.ok $r.code

    $r = upload "/api/employees/$eid/avatar" $fake "file.txt" "text/plain" $tok 415
    chk "Wrong MIME (text/plain): 415" $r.ok $r.code

    $r = upload "/api/employees/$eid/avatar" $big "big.jpg" "image/jpeg" $tok 413
    chk "Oversized avatar (>2MB): 413" $r.ok $r.code

    try {
        $av = Invoke-WebRequest -Uri "$Base/api/employees/$eid/avatar" -Headers @{Authorization="Bearer $tok"} -ErrorAction Stop
        chk "GET avatar after upload: 200" ($av.StatusCode -eq 200) $av.StatusCode
    } catch { chk "GET avatar after upload: 200" $false "exception" }

    $r = upload "/api/employees/$eid/avatar" $jpg "photo.jpg" "image/jpeg" "" 401
    chk "Avatar upload without auth: 401" $r.ok $r.code
}

# ===========================================================================
Write-Host "`n=== 7. Entries ===" -ForegroundColor Cyan

if ($emp) {
    $today = (Get-Date -Format "yyyy-MM-dd")
    $eid   = $emp.id

    $r = api PUT "/api/entries/$eid/$today" @{activities=@(@{id="a1"; activity="Tagliando"; hours=3.5; notes="Fiat 500"})} -token $tok
    chk "PUT activities: 200" $r.ok $r.code

    $r = api PUT "/api/entries/$eid/$today" @{activities=@(@{id="a2"; activity=("x"*201); hours=1})} -token $tok -expect 422
    chk "Activity text >200 chars: 422" $r.ok $r.code

    $r = api PUT "/api/entries/$eid/$today" @{activities=@(@{id="a3"; activity="ok"; hours=1; notes=("n"*1001)})} -token $tok -expect 422
    chk "Activity notes >1000 chars: 422" $r.ok $r.code

    $r = api PUT "/api/entries/$eid/not-a-date" @{activities=@()} -token $tok -expect 422
    chk "Invalid date format: 422" $r.ok $r.code

    $r = api PUT "/api/entries/zzz9999/$today" @{activities=@()} -token $tok -expect 404
    chk "Entries for non-existent emp: 404" $r.ok $r.code

    $r = api GET "/api/entries?from=$today&to=$today" -token $tok
    chk "GET entries: 200" $r.ok $r.code

    $r = api PUT "/api/absences/$eid/$today" @{type="ferie"} -token $tok
    chk "PUT absence ferie: 200" $r.ok $r.code

    $r = api PUT "/api/absences/$eid/$today" @{type="malattia"} -token $tok
    chk "PUT absence malattia: 200" $r.ok $r.code

    $r = api PUT "/api/absences/$eid/$today" @{type=$null} -token $tok
    chk "Clear absence (null type): 200" $r.ok $r.code

    $r = api PUT "/api/absences/$eid/$today" @{type="vacanza"} -token $tok -expect 422
    chk "Invalid absence type: 422" $r.ok $r.code

    $r = api PUT "/api/absences/zzz9999/$today" @{type="ferie"} -token $tok -expect 404
    chk "Absence for non-existent emp: 404" $r.ok $r.code
}

# ===========================================================================
Write-Host "`n=== 8. Log endpoints ===" -ForegroundColor Cyan

$r = api POST "/api/log/event" @{message="Robustness suite: UI event"} -token $tok -expect 204
chk "POST /log/event (message): 204" $r.ok $r.code

$r = api POST "/api/log/event" @{action="open_modal"; details=@{modal="activity"}} -token $tok -expect 204
chk "POST /log/event (legacy action): 204" $r.ok $r.code

$r = api POST "/api/log/event" @{message=("m"*501)} -token $tok -expect 422
chk "Log message >500 chars: 422" $r.ok $r.code

$r = api POST "/api/log/public-event" @{action="login_page_view"} -expect 204
chk "POST /log/public-event: 204" $r.ok $r.code

$r = api POST "/api/log/public-event" @{action=("a"*201)} -expect 422
chk "Public log event >200 chars: 422" $r.ok $r.code

# CRLF injection: must sanitize but return 204 (not 500)
$r = api POST "/api/log/event" @{message="inject`r`nFAKE LOG LINE"} -token $tok -expect 204
chk "CRLF in log message (sanitized): 204" $r.ok $r.code

$r = api GET "/api/log?lines=50" -token $tok
chk "GET /log?lines=50: 200" $r.ok $r.code

$r = api GET "/api/log?lines=0" -token $tok -expect 422
chk "GET /log?lines=0: 422" $r.ok $r.code

$r = api GET "/api/log" -expect 401
chk "GET /log without auth: 401" $r.ok $r.code

# ===========================================================================
Write-Host "`n=== 9. Logo ===" -ForegroundColor Cyan

$r = api GET "/api/logo/status"
chk "GET /logo/status: 200" $r.ok $r.code

try {
    $lr = Invoke-WebRequest -Uri "$Base/api/logo" -ErrorAction Stop
    chk "GET /logo: 200" ($lr.StatusCode -eq 200) $lr.StatusCode
} catch { chk "GET /logo: 200" $false "exception" }

$r = upload "/api/logo" $jpg "logo.jpg" "image/jpeg" "" 409
chk "Second logo upload: 409 (one-shot lock)" $r.ok $r.code

# ===========================================================================
Write-Host "`n=== 10. Account ===" -ForegroundColor Cyan

$r = api GET "/api/account" -token $tok
chk "GET /account: 200" $r.ok $r.code

$r = api GET "/api/account" -expect 401
chk "GET /account without auth: 401" $r.ok $r.code

$r = api POST "/api/account/password" @{current=$MasterPass; next="newpass"} -token $tok -expect 403
chk "Master cannot change password: 403" $r.ok $r.code

# ===========================================================================
Write-Host "`n=== 11. Logout ===" -ForegroundColor Cyan

$r = api POST "/api/auth/logout" -token $tok
chk "Logout: 200" $r.ok $r.code

# ===========================================================================
Write-Host "`n=== 12. Cleanup ===" -ForegroundColor Cyan

$r = api POST "/api/auth/login" @{user=$MasterUser; password=$MasterPass}
chk "Re-login for cleanup: 200" $r.ok $r.code
$tok2 = $r.body.access_token

if ($emp -and $tok2) {
    $r = api DELETE "/api/employees/$($emp.id)" -token $tok2 -expect 204
    chk "Delete test employee: 204" $r.ok $r.code
}
if ($dep -and $tok2) {
    $r = api DELETE "/api/departments/$($dep.id)" -token $tok2 -expect 204
    chk "Delete test dept: 204" $r.ok $r.code
}

# ===========================================================================
Write-Host ""
Write-Host "==========================================" -ForegroundColor White
Write-Host "  RESULTS: $pass passed  |  $fail failed" -ForegroundColor $(if ($fail -eq 0) {"Green"} else {"Red"})
Write-Host "==========================================`n" -ForegroundColor White
if ($fail -gt 0) { exit 1 } else { exit 0 }
