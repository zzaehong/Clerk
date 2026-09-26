param([Parameter(Mandatory=$true)][string]$Server)
$ErrorActionPreference = 'Stop'
$info = New-Object System.Diagnostics.ProcessStartInfo
$info.FileName = $Server
$info.Arguments = '--listen stdio://'
$info.WorkingDirectory = $env:TEMP
$info.UseShellExecute = $false
$info.CreateNoWindow = $true
$info.RedirectStandardInput = $true
$info.RedirectStandardOutput = $true
$info.RedirectStandardError = $true
$p = New-Object System.Diagnostics.Process
$p.StartInfo = $info
try {
    [void]$p.Start()
    $errors = $p.StandardError.ReadToEndAsync()
    function Request($id, $method, $parameters) {
        $p.StandardInput.WriteLine((@{id=$id;method=$method;params=$parameters}|ConvertTo-Json -Compress -Depth 10))
        $p.StandardInput.Flush()
        while ($true) {
            $line = $p.StandardOutput.ReadLineAsync()
            if (-not $line.Wait(30000)) {throw "Timed out: $method"}
            if ($null -eq $line.Result) {throw "Codex exited before response: $method"}
            $msg = $line.Result | ConvertFrom-Json
            if ($msg.id -eq $id -and -not $msg.method) {
                if ($msg.error) {throw ($msg.error|ConvertTo-Json -Compress -Depth 10)}
                return $msg.result
            }
        }
    }
    $init = Request 1 'initialize' @{clientInfo=@{name='clerk_probe';version='0.1.0'};capabilities=@{experimentalApi=$true}}
    $p.StandardInput.WriteLine('{"method":"initialized","params":{}}')
    $account = Request 2 'account/read' @{}
    $sandbox = Request 3 'windowsSandbox/readiness' @{}
    @{initialized=$true;accountPresent=($null -ne $account.account);authRequired=$account.requiresOpenaiAuth;sandbox=$sandbox.status}|ConvertTo-Json -Compress
} finally {
    if ($p.Id -and -not $p.HasExited) {$p.Kill();$p.WaitForExit()}
    $p.Dispose()
}
