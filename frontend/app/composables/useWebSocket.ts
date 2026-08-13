/**
 * useWebSocket — manages the WebSocket connection to the backend.
 * Exposes a reactive event stream that components can subscribe to.
 */

export type WsEventType =
  | 'init'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'ready'
  | 'status'
  | 'messages'
  | 'log';

export interface WsEvent {
  type: WsEventType;
  [key: string]: unknown;
}

// Singleton state — shared across all composable calls
const ws          = ref<WebSocket | null>(null);
const wsStatus    = ref<'connecting' | 'open' | 'closed'>('closed');
const lastEvent   = ref<WsEvent | null>(null);
const listeners   = new Map<WsEventType, Set<(e: WsEvent) => void>>();
let   reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function getListeners(type: WsEventType): Set<(e: WsEvent) => void> {
  if (!listeners.has(type)) listeners.set(type, new Set());
  return listeners.get(type)!;
}

function emit(event: WsEvent) {
  lastEvent.value = event;
  getListeners(event.type).forEach((cb) => cb(event));
}

export function useWebSocket() {
  const config = useRuntimeConfig();
  const wsUrl  = config.public.wsBase as string;

  function connect() {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) return;

    wsStatus.value = 'connecting';
    const socket   = new WebSocket(wsUrl);

    socket.onopen = () => {
      wsStatus.value = 'open';
      ws.value = socket;
      console.log('[WS] Connected');
    };

    socket.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as WsEvent;
        emit(data);
      } catch {
        console.warn('[WS] Non-JSON message:', ev.data);
      }
    };

    socket.onclose = () => {
      wsStatus.value = 'closed';
      ws.value = null;
      console.log('[WS] Closed — reconnecting in 3s…');
      reconnectTimer = setTimeout(() => connect(), 3000);
    };

    socket.onerror = () => {
      console.error('[WS] Error');
      socket.close();
    };
  }

  function close() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws.value?.close();
    ws.value = null;
    wsStatus.value = 'closed';
  }

  /** Subscribe to a specific event type. Returns an unsubscribe function. */
  function on(type: WsEventType, cb: (e: WsEvent) => void): () => void {
    getListeners(type).add(cb);
    return () => getListeners(type).delete(cb);
  }

  return { wsStatus, lastEvent, connect, close, on };
}
