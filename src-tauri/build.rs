fn main() {
    // Cargo must rebuild the PE resources when only the source icon changes.
    println!("cargo:rerun-if-changed=../assets/icon.png");
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=icons/icon.png");
    let windows = tauri_build::WindowsAttributes::new().window_icon_path("icons/icon.ico");
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
        .expect("Clerk 아이콘/리소스 생성 실패");
}
