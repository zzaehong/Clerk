param([Parameter(Mandatory=$true)][string]$Installer)
$ErrorActionPreference='Stop'
$install = Start-Process -FilePath $Installer -ArgumentList '/S' -PassThru -Wait
if ($install.ExitCode -ne 0) {throw "Installer exit: $($install.ExitCode)"}
$app=Join-Path $env:LOCALAPPDATA 'Clerk\clerk.exe'
if (-not (Test-Path $app)) {throw 'Installed application not found'}
$info=New-Object Diagnostics.ProcessStartInfo
$info.FileName=$app
$info.UseShellExecute=$false
$info.EnvironmentVariables['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS']='--remote-debugging-port=9237'
$p=[Diagnostics.Process]::Start($info)
@{installerExit=$install.ExitCode;app=$app;pid=$p.Id;installedRuntime=(Test-Path (Join-Path $env:LOCALAPPDATA 'Clerk\codex\bin\codex-app-server.exe'))}|ConvertTo-Json -Compress
