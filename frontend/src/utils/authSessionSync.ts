const CHANNEL_NAME = 'wanderchina.auth'
const AUTH_KEY_PREFIX = 'wanderchina.auth.'

type SessionMessageType = 'session-updated' | 'logged-out'
type SessionMessage = { type: SessionMessageType }

let sessionChannel: BroadcastChannel | null = null

function isSessionMessage(value: unknown): value is SessionMessage {
  if (typeof value !== 'object' || value === null) return false
  const keys = Object.keys(value)
  return (
    keys.length === 1 &&
    keys[0] === 'type' &&
    'type' in value &&
    (value.type === 'session-updated' || value.type === 'logged-out')
  )
}

function broadcast(type: SessionMessageType): void {
  if (!sessionChannel) return
  try {
    // 消息只表达状态变化；其他标签页收到后自行读取 localStorage。
    sessionChannel.postMessage({ type } satisfies SessionMessage)
  } catch {
    // 通道不可用时，localStorage 写入仍会触发同源 storage 事件。
  }
}

export function notifyAuthSessionUpdated(): void {
  broadcast('session-updated')
}

export function notifyAuthSessionLoggedOut(): void {
  broadcast('logged-out')
}

export function startAuthSessionSync(hydrate: () => void): () => void {
  const rehydrate = () => {
    try {
      hydrate()
    } catch {
      // 单个标签页同步失败不能阻断另一标签页的会话操作。
    }
  }

  const onChannelMessage = (event: MessageEvent<unknown>) => {
    if (isSessionMessage(event.data)) rehydrate()
  }
  let channel: BroadcastChannel | null = null
  try {
    if (typeof globalThis.BroadcastChannel === 'function') {
      channel = new globalThis.BroadcastChannel(CHANNEL_NAME)
      channel.addEventListener('message', onChannelMessage)
      sessionChannel = channel
    }
  } catch {
    channel = null
    sessionChannel = null
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(AUTH_KEY_PREFIX)) rehydrate()
  }
  globalThis.addEventListener('storage', onStorage)

  return () => {
    channel?.removeEventListener('message', onChannelMessage)
    channel?.close()
    if (sessionChannel === channel) sessionChannel = null
    globalThis.removeEventListener('storage', onStorage)
  }
}
