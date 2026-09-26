param([string]$Expression = 'document.body.innerText', [int]$Port = 9237, [string]$Screenshot)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$pages = Invoke-RestMethod "http://127.0.0.1:$Port/json"
$page = $pages | Where-Object {$_.type -eq 'page' -and $_.url -match 'tauri|localhost'} | Select-Object -First 1
if (-not $page) {throw 'Clerk WebView not found'}
$socket = New-Object System.Net.WebSockets.ClientWebSocket
$cancel = New-Object System.Threading.CancellationTokenSource
$cancel.CancelAfter(30000)
try {
    [void]$socket.ConnectAsync([Uri]$page.webSocketDebuggerUrl,$cancel.Token).GetAwaiter().GetResult()
    $message = @{id=1;method='Runtime.evaluate';params=@{expression=$Expression;returnByValue=$true;awaitPromise=$true}} | ConvertTo-Json -Compress -Depth 10
    if ($Screenshot) { $message = '{"id":1,"method":"Page.captureScreenshot","params":{"format":"png"}}' }
    $bytes=[Text.Encoding]::UTF8.GetBytes($message)
    [void]$socket.SendAsync([ArraySegment[byte]]::new($bytes),[Net.WebSockets.WebSocketMessageType]::Text,$true,$cancel.Token).GetAwaiter().GetResult()
    do {
        $stream=New-Object IO.MemoryStream
        do {
            $buffer=New-Object byte[] 65536
            $result=$socket.ReceiveAsync([ArraySegment[byte]]::new($buffer),$cancel.Token).GetAwaiter().GetResult()
            $stream.Write($buffer,0,$result.Count)
        } while (-not $result.EndOfMessage)
        $reply=[Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
        $stream.Dispose()
    } while ($reply.id -ne 1)
    if ($reply.result.exceptionDetails) {throw ($reply.result.exceptionDetails | ConvertTo-Json -Depth 10)}
    if ($Screenshot) { [IO.File]::WriteAllBytes($Screenshot,[Convert]::FromBase64String($reply.result.data)); Write-Output $Screenshot } else { $reply.result.result.value | ConvertTo-Json -Depth 15 }
} finally {$socket.Dispose();$cancel.Dispose()}
