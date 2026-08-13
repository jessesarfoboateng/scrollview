/**
 * useApi — thin $fetch wrapper pointed at the Node.js backend.
 * Reads the base URL from runtimeConfig so it works in both dev and prod.
 */
export function useApi() {
  const config = useRuntimeConfig();
  const base   = config.public.apiBase as string;

  async function call<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path:   string,
    body?:  Record<string, unknown>,
  ): Promise<{ ok: boolean; data?: T; error?: string }> {
    const hasBody = body !== undefined && Object.keys(body).length > 0;
    try {
      const res = await $fetch<{ ok: boolean } & Record<string, unknown>>(
        `${base}${path}`,
        {
          method,
          ...(hasBody ? {
            body:    JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
          } : {}),
        },
      );
      return { ok: true, data: res as T };
    } catch (err: unknown) {
      // $fetch throws an FetchError with a .data property on HTTP errors
      const fetchErr = err as { data?: { error?: string; ok?: boolean }; message?: string };
      const msg = fetchErr?.data?.error ?? fetchErr?.message ?? 'NETWORK_ERROR';
      return { ok: false, error: msg };
    }
  }

  return {
    // Ports
    getPorts:    () => call<{ ports: Array<{ path: string; manufacturer?: string }> }>('GET', '/api/ports'),

    // Connection
    connect:     (port: string) => call('POST', '/api/connection/connect',   { port }),
    disconnect:  ()             => call('POST', '/api/connection/disconnect'),
    getState:    ()             => call('GET',  '/api/connection/state'),

    // Messages
    getMessages:  ()                          => call<{ messages: Array<{ id: number; text: string }> }>('GET',    '/api/messages'),
    addMessage:   (id: number, text: string)  => call('POST',   '/api/messages',       { id, text }),
    editMessage:  (id: number, text: string)  => call('PUT',    `/api/messages/${id}`, { text }),
    deleteMessage:(id: number)                => call('DELETE',  `/api/messages/${id}`),
    showMessage:  (id: number)                => call('POST',    `/api/messages/${id}/show`),
    clearMessages:()                          => call('DELETE',  '/api/messages'),

    // Speed
    setSpeed:    (speed: number)              => call('POST', '/api/speed',      { speed }),
    setMode:     (mode: string)               => call('POST', '/api/speed/mode', { mode }),

    // Status
    getStatus:   ()                           => call('GET',  '/api/status'),
  };
}
