<template>
  <div class="card" id="section-messages">
    <div class="card-header">
      <div>
        <div class="card-title">Message Manager</div>
        <div class="card-subtitle">Stored in Arduino EEPROM</div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-secondary btn-sm" :disabled="!connected || loading" @click="refresh">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Refresh
        </button>
        <button class="btn btn-primary btn-sm" :disabled="!connected" @click="openAdd">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add
        </button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" style="padding:1.5rem;text-align:center;color:var(--color-text-muted);font-size:0.875rem;">
      Loading messages…
    </div>

    <!-- Empty state -->
    <div v-else-if="messages.length === 0"
         style="padding:2rem;text-align:center;color:var(--color-text-muted);font-size:0.875rem;">
      <div style="font-size:2rem;margin-bottom:0.5rem;">📭</div>
      No messages stored. Click <strong>Add</strong> to create one.
    </div>

    <!-- Message list -->
    <div v-else style="display:flex;flex-direction:column;gap:0.5rem;">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message-item"
        :class="{ 'active-msg': state.activeMessageId.value === msg.id }"
      >
        <div class="message-id">{{ msg.id }}</div>
        <div class="message-text" :title="msg.text">{{ msg.text }}</div>
        <div class="message-actions">
          <button class="btn btn-ghost btn-icon btn-sm" :disabled="!connected" title="Display this message" @click="show(msg.id)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm" :disabled="!connected" title="Edit" @click="openEdit(msg)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm" :disabled="!connected" title="Delete" style="color:var(--color-red);" @click="requestDelete(msg)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Clear all button -->
    <div v-if="messages.length > 0" style="margin-top:1rem;display:flex;justify-content:flex-end;">
      <button class="btn btn-danger btn-sm" :disabled="!connected" @click="requestClear">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        </svg>
        Clear All
      </button>
    </div>

    <!-- Error -->
    <p v-if="errorMsg" style="margin-top:0.625rem;font-size:0.8rem;color:var(--color-red);">{{ errorMsg }}</p>
  </div>

  <!-- Add / Edit modal -->
  <Teleport to="body">
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-title">{{ editingMsg ? 'Edit Message' : 'Add Message' }}</div>
        <div class="modal-body" style="margin-bottom:1rem;">
          <div class="form-group">
            <label class="form-label">Message Text</label>
            <textarea
              v-model="modalText"
              class="form-input"
              rows="3"
              :maxlength="60"
              placeholder="Enter message text…"
              style="resize:vertical;"
              @keydown.enter.ctrl="submitModal"
            />
            <div class="char-counter" :class="{ warn: modalText.length > 50 }">
              {{ modalText.length }} / 60
            </div>
          </div>
          <p v-if="modalError" style="font-size:0.8rem;color:var(--color-red);margin-top:0.5rem;">{{ modalError }}</p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="closeModal">Cancel</button>
          <button class="btn btn-primary" :disabled="submitting || !modalText.trim()" @click="submitModal">
            {{ submitting ? 'Saving…' : (editingMsg ? 'Save Changes' : 'Add Message') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirm modal -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal">
        <div class="modal-title">Delete Message</div>
        <div class="modal-body">
          Are you sure you want to delete message #{{ deleteTarget.id }}?<br>
          <strong>"{{ deleteTarget.text }}"</strong><br><br>
          This will remove it from the Arduino EEPROM permanently.
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="deleteTarget = null">Cancel</button>
          <button class="btn btn-danger" :disabled="submitting" @click="confirmDelete">
            {{ submitting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Clear all confirm modal -->
    <div v-if="showClearConfirm" class="modal-overlay" @click.self="showClearConfirm = false">
      <div class="modal">
        <div class="modal-title">Clear All Messages</div>
        <div class="modal-body">
          Are you sure you want to delete <strong>all stored messages</strong>?<br><br>
          This will erase all messages from the Arduino EEPROM and cannot be undone.
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showClearConfirm = false">Cancel</button>
          <button class="btn btn-danger" :disabled="submitting" @click="confirmClear">
            {{ submitting ? 'Clearing…' : 'Yes, Clear All' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
interface Msg { id: number; text: string }

const api   = useApi();
const state = useBoardState();

const messages       = computed(() => state.messages.value);
const connected      = computed(() => state.connectionStatus.value === 'connected');
const loading        = ref(false);
const errorMsg       = ref('');

// Modal state
const showModal   = ref(false);
const editingMsg  = ref<Msg | null>(null);
const modalText   = ref('');
const modalError  = ref('');
const submitting  = ref(false);

// Delete / clear state
const deleteTarget     = ref<Msg | null>(null);
const showClearConfirm = ref(false);

async function refresh() {
  loading.value   = true;
  errorMsg.value  = '';
  const res = await api.getMessages();
  if (res.ok && res.data) {
    state.setMessages((res.data as { messages: Msg[] }).messages);
  } else {
    errorMsg.value = res.error ?? 'Failed to load messages';
  }
  loading.value = false;
}

function openAdd() {
  editingMsg.value = null;
  modalText.value  = '';
  modalError.value = '';
  showModal.value  = true;
}

function openEdit(msg: Msg) {
  editingMsg.value = msg;
  modalText.value  = msg.text;
  modalError.value = '';
  showModal.value  = true;
}

function closeModal() {
  showModal.value  = false;
  editingMsg.value = null;
  modalText.value  = '';
  modalError.value = '';
}

async function submitModal() {
  const text = modalText.value.trim();
  if (!text) { modalError.value = 'Message cannot be empty.'; return; }
  submitting.value = true;
  modalError.value = '';
  let res;
  if (editingMsg.value) {
    res = await api.editMessage(editingMsg.value.id, text);
  } else {
    // Arduino assigns its own slot; we pass the next logical seq ID.
    // Use max(existing ids) + 1, falling back to 1 — Arduino echoes this
    // in OK|ADD|<id> but the actual EEPROM slot is its own business.
    const existingIds = messages.value.map((m) => m.id);
    const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    res = await api.addMessage(nextId, text);
  }
  if (res.ok) {
    closeModal();
    await refresh();
  } else {
    modalError.value = res.error ?? 'Failed to save message';
  }
  submitting.value = false;
}

async function show(id: number) {
  state.setActiveMessage(id);
  await api.showMessage(id);
}

function requestDelete(msg: Msg) {
  deleteTarget.value = msg;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  submitting.value = true;
  errorMsg.value   = '';
  const res = await api.deleteMessage(deleteTarget.value.id);
  if (res.ok) {
    deleteTarget.value = null;
    submitting.value   = false;
    await refresh();
  } else {
    errorMsg.value   = res.error ?? 'Delete failed';
    submitting.value = false;
  }
}

function requestClear() {
  showClearConfirm.value = true;
}

async function confirmClear() {
  submitting.value = true;
  const res = await api.clearMessages();
  if (res.ok) {
    showClearConfirm.value = false;
    state.setMessages([]);
    state.setActiveMessage(null);
  } else {
    errorMsg.value = res.error ?? 'Clear failed';
  }
  submitting.value = false;
}

onMounted(() => {
  if (connected.value) refresh();
});

watch(connected, (val) => {
  if (val) refresh();
});
</script>
