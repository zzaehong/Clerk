export type ChatMessage = {id: string; role: 'user' | 'assistant'; text: string; failed?: boolean};

// Item IDs keep interleaved commentary and final answers separate. Completion
// replaces streamed text rather than appending the same answer a second time.
export function updateAssistant(messages: ChatMessage[], id: string, text: string, delta = false): ChatMessage[] {
  const existing = messages.find(m => m.id === id && m.role === 'assistant');
  if (!existing) return [...messages, {id, role: 'assistant', text}];
  return messages.map(m => m === existing ? {...m, text: delta ? m.text + text : text} : m);
}
