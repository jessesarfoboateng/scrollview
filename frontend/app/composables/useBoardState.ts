/**
 * useBoardState — central reactive state store for the LED notice board.
 * Bridges the WebSocket event stream with local reactive state that
 * all pages and components read from.
 */

export interface BoardMessage {
  id:   number;
  text: string;
}

export interface BoardStatus {
  messages:    number;
  active:      number;
  speed:       number;
  mode:        'potentiometer' | 'computer';
}

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

// Shared singleton state
const connectionStatus = ref<ConnectionStatus>('disconnected');
const connectedPort    = ref<string | null>(null);
const messages         = ref<BoardMessage[]>([]);
const boardStatus      = ref<BoardStatus | null>(null);
const activeMessageId  = ref<number | null>(null);
const isInitialized    = ref(false);

export function useBoardState() {
  const ws = useWebSocket();

  function init() {
    if (isInitialized.value) return;
    isInitialized.value = true;

    // Connect WebSocket to backend
    ws.connect();

    ws.on('init', (e) => {
      if (e.connected) {
        connectionStatus.value = 'connected';
        connectedPort.value    = e.port as string ?? null;
      } else {
        connectionStatus.value = 'disconnected';
      }
    });

    ws.on('connected', (e) => {
      connectionStatus.value = 'connected';
      connectedPort.value    = e.port as string ?? null;
    });

    ws.on('disconnected', () => {
      connectionStatus.value = 'disconnected';
    });

    ws.on('reconnecting', () => {
      connectionStatus.value = 'reconnecting';
    });

    ws.on('ready', () => {
      // Arduino restarted — status will come from the post-connect sync
      connectionStatus.value = 'connected';
    });

    ws.on('status', (e) => {
      boardStatus.value = e.data as BoardStatus;
      if (e.data && typeof (e.data as BoardStatus).active === 'number') {
        const active = (e.data as BoardStatus).active;
        activeMessageId.value = active === 0 ? null : active;
      }
    });

    ws.on('messages', (e) => {
      messages.value = (e.messages as BoardMessage[]) ?? [];
    });
  }

  function setMessages(msgs: BoardMessage[]) {
    messages.value = msgs;
  }

  function updateStatus(s: BoardStatus) {
    boardStatus.value = s;
  }

  function setConnectionStatus(status: ConnectionStatus, port?: string) {
    connectionStatus.value = status;
    if (port !== undefined) connectedPort.value = port;
  }

  function setActiveMessage(id: number | null) {
    activeMessageId.value = id;
  }

  return {
    connectionStatus: readonly(connectionStatus),
    connectedPort:    readonly(connectedPort),
    messages:         readonly(messages),
    boardStatus:      readonly(boardStatus),
    activeMessageId:  readonly(activeMessageId),
    wsStatus:         ws.wsStatus,
    init,
    setMessages,
    updateStatus,
    setConnectionStatus,
    setActiveMessage,
  };
}
