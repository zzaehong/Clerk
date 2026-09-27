#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod process_tree;
use process_tree::ProcessTree;
use tauri_plugin_opener::OpenerExt;
use serde_json::{json, Value};
use std::{io::{BufRead, BufReader, Write}, process::{Child, ChildStdin, Command, Stdio}, sync::{Arc, Mutex}};
use tauri::{ipc::Channel, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct Runtime { process: Mutex<Option<Process>> }
struct Process { child: Arc<Mutex<Child>>, stdin: ChildStdin, _tree: ProcessTree }
impl Runtime {
    fn stop(&self) {
        if let Some(p) = self.process.lock().unwrap().take() {
            let mut child = p.child.lock().unwrap();
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
impl Drop for Runtime { fn drop(&mut self) { self.stop(); } }

#[tauri::command]
fn start_codex(app: tauri::AppHandle, runtime: State<Runtime>, events: Channel<Value>) -> Result<(), String> {
    runtime.stop();
    #[cfg(windows)]
    let mut cmd = {
        let root = app.path().resource_dir().map_err(|e| e.to_string())?.join("codex");
        let exe = root.join("bin/codex-app-server.exe");
        if !exe.is_file() { return Err(format!("설치 파일이 누락되었습니다. Clerk를 다시 설치해 주세요: {}", exe.display())); }
        let mut c = Command::new(exe);
        c.args(["--listen", "stdio://"]);
        c
    };
    #[cfg(not(windows))]
    let mut cmd = { let _ = app; let mut c = Command::new("codex"); c.args(["app-server", "--listen", "stdio://"]); c };
    cmd
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(windows)] { use std::os::windows::process::CommandExt; cmd.creation_flags(0x08000000); }
    let mut child = cmd.spawn().map_err(|e| format!("Codex 실행 실패: {e}"))?;
    let tree = match ProcessTree::attach(&child) {
        Ok(tree) => tree,
        Err(e) => { let _ = child.kill(); let _ = child.wait(); return Err(format!("Codex 프로세스 보호 설정 실패: {e}")); }
    };
    let stdin = child.stdin.take().ok_or("Codex stdin unavailable")?;
    let stdout = child.stdout.take().ok_or("Codex stdout unavailable")?;
    let stderr = child.stderr.take().ok_or("Codex stderr unavailable")?;
    let child = Arc::new(Mutex::new(child));
    *runtime.process.lock().unwrap() = Some(Process { child: child.clone(), stdin, _tree: tree });
    let errors = events.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            eprintln!("Codex: {line}");
            let _ = errors.send(json!({"kind":"diagnostic", "text":line}));
        }
    });
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            match line {
                Ok(line) => match serde_json::from_str::<Value>(&line) {
                    Ok(message) => { let _ = events.send(json!({"kind":"message", "message":message})); }
                    Err(e) => { let _ = events.send(json!({"kind":"diagnostic", "text":format!("Invalid Codex JSON: {e}")})); }
                },
                Err(e) => { let _ = events.send(json!({"kind":"diagnostic", "text":e.to_string()})); break; }
            }
        }
        let status = child.lock().unwrap().try_wait();
        let _ = events.send(json!({"kind":"closed", "text":format!("Codex stdout closed: {status:?}")}));
    });
    Ok(())
}

#[tauri::command]
fn write_codex(runtime: State<Runtime>, message: Value) -> Result<(), String> {
    let mut guard = runtime.process.lock().unwrap();
    let p = guard.as_mut().ok_or("Codex is disconnected")?;
    let mut bytes = serde_json::to_vec(&message).map_err(|e| e.to_string())?;
    bytes.push(b'\n');
    p.stdin.write_all(&bytes).and_then(|_| p.stdin.flush()).map_err(|e| e.to_string())
}
#[tauri::command]
fn stop_codex(runtime: State<Runtime>) { runtime.stop(); }
#[tauri::command]
async fn choose_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog().file().blocking_pick_folder().map(|p| p.into_path().map(|p| p.to_string_lossy().into_owned()).map_err(|e| e.to_string())).transpose()
    }).await.map_err(|e| e.to_string())?
}
#[tauri::command]
fn open_login_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let parsed = tauri::Url::parse(&url).map_err(|e| e.to_string())?;
    if parsed.scheme() != "https" || !matches!(parsed.host_str(), Some("auth.openai.com" | "chatgpt.com" | "auth0.openai.com")) || !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("공식 로그인 주소만 열 수 있습니다.".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}
#[tauri::command]
fn platform() -> &'static str { std::env::consts::OS }
fn main() {
    let app = tauri::Builder::default().plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_opener::init())
        .manage(Runtime::default())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window.set_icon(tauri::include_image!("icons/icon.png"))?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![start_codex, write_codex, stop_codex, choose_folder, open_login_url, platform])
        .build(tauri::generate_context!()).expect("Clerk 초기화 실패");
    app.run(|app, event| { if let tauri::RunEvent::Exit = event { app.state::<Runtime>().stop(); } });
}
