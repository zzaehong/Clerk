import { Channel, invoke } from '@tauri-apps/api/core';
import { CodexBridge, type TransportEvent } from './bridge.ts';
export const bridge = new CodexBridge({
  async start(receive) { const events = new Channel<TransportEvent>(); events.onmessage = receive; await invoke('start_codex', {events}); },
  write(message) { return invoke('write_codex', {message}); },
  stop() { return invoke('stop_codex'); },
});
export const chooseFolder = () => invoke<string | null>('choose_folder');
export const openLoginUrl = (url: string) => invoke<void>('open_login_url', {url});
export const getPlatform = () => invoke<string>('platform');
