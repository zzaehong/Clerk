// Windows Job Objects close the Codex process tree when Clerk exits or reconnects.
#[cfg(windows)]
pub struct ProcessTree(usize);
#[cfg(windows)]
impl ProcessTree {
    pub fn attach(child: &std::process::Child) -> Result<Self, String> {
        use std::{mem::{size_of, zeroed}, os::windows::io::AsRawHandle, ptr::null};
        use windows_sys::Win32::{Foundation::CloseHandle, System::JobObjects::*};
        unsafe {
            let job = CreateJobObjectW(null(), null());
            if job.is_null() { return Err(std::io::Error::last_os_error().to_string()); }
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(job, JobObjectExtendedLimitInformation, &info as *const _ as _, size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32) == 0
                || AssignProcessToJobObject(job, child.as_raw_handle()) == 0 {
                let e = std::io::Error::last_os_error().to_string();
                CloseHandle(job); return Err(e);
            }
            Ok(Self(job as usize))
        }
    }
}
#[cfg(windows)]
impl Drop for ProcessTree {
    fn drop(&mut self) { unsafe { windows_sys::Win32::Foundation::CloseHandle(self.0 as _); } }
}
#[cfg(not(windows))]
pub struct ProcessTree;
#[cfg(not(windows))]
impl ProcessTree { pub fn attach(_: &std::process::Child) -> Result<Self, String> { Ok(Self) } }
