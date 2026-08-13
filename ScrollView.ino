/*
 * ============================================================
 *  ScrollView — Bluetooth-Controlled Scrolling LED Notice Board
 *  Hardware : Arduino Mega 2560
 *             MAX7219 4-in-1 8×8 LED dot-matrix (SPI)
 *             HC-05 Bluetooth module  → Serial1 (TX1=18 / RX1=19)
 *             Potentiometer           → A0
 *             Button PREV             → D2 (active-LOW, INPUT_PULLUP)
 *             Button NEXT             → D3 (active-LOW, INPUT_PULLUP)
 *             Button MODE             → D4 (active-LOW, INPUT_PULLUP)
 *  MAX7219 wiring (SPI):
 *             DIN  → D51 (MOSI)
 *             CLK  → D52 (SCK)
 *             CS   → D53 (SS)
 *  HC-05 Voltage divider on RX pin:
 *             Arduino TX1 (5 V) → 1 kΩ → HC-05 RX → 2 kΩ → GND
 *             (gives ~3.3 V on HC-05 RX)
 * ============================================================
 */

#include <SPI.h>
#include <EEPROM.h>

// ─── MAX7219 pins ───────────────────────────────────────────
#define PIN_DIN  51
#define PIN_CLK  52
#define PIN_CS   53

// Number of chained MAX7219 modules (4 × 8×8 = 32 columns)
#define NUM_DEVICES 4
#define DISPLAY_COLS (NUM_DEVICES * 8)   // 32 visible columns

// ─── Physical buttons ───────────────────────────────────────
#define BTN_PREV   2
#define BTN_NEXT   3
#define BTN_MODE   4

// ─── Potentiometer ──────────────────────────────────────────
#define PIN_POT  A0

// ─── Serial baud rates ──────────────────────────────────────
#define BT_BAUD   9600   // HC-05 default; change if you ran AT+UART
#define DBG_BAUD  9600   // USB Serial for debug

// ─── EEPROM layout ──────────────────────────────────────────
// Byte 0      : magic number (0xAB) — indicates valid EEPROM data
// Byte 1      : message count (uint8_t)
// Byte 2      : speed value  (uint8_t, 1-100)
// Byte 3      : speed mode   (0 = potentiometer, 1 = computer)
// Byte 4–2003 : message slots (max 10 messages × 200 bytes each)
//
// Each message slot (200 bytes):
//   [0]     : active flag (0 = empty, 1 = active)
//   [1]     : message length (uint8_t)
//   [2–198] : message text (max 60 chars + null terminator)
//             (we pad the slot to a fixed 200 bytes for simplicity)

#define EEPROM_MAGIC       0xAB
#define EEPROM_MAGIC_ADDR  0
#define EEPROM_COUNT_ADDR  1
#define EEPROM_SPEED_ADDR  2
#define EEPROM_MODE_ADDR   3
#define EEPROM_MSG_START   4

#define MAX_MESSAGES       10
#define MSG_SLOT_SIZE      200
#define MAX_MSG_LEN        60    // usable text characters per message

#define SPEED_MIN          1
#define SPEED_MAX          100

// ─── Font: 5×7 ASCII bitmap (space=0x20 … ~=0x7E) ──────────
// Each character is 5 bytes wide; column order left→right
// Bit 0 = top row, bit 6 = bottom row (MSB unused)
static const uint8_t FONT5x7[][5] PROGMEM = {
  {0x00,0x00,0x00,0x00,0x00}, // ' ' 32
  {0x00,0x00,0x5F,0x00,0x00}, // '!' 33
  {0x00,0x07,0x00,0x07,0x00}, // '"' 34
  {0x14,0x7F,0x14,0x7F,0x14}, // '#' 35
  {0x24,0x2A,0x7F,0x2A,0x12}, // '$' 36
  {0x23,0x13,0x08,0x64,0x62}, // '%' 37
  {0x36,0x49,0x55,0x22,0x50}, // '&' 38
  {0x00,0x05,0x03,0x00,0x00}, // ''' 39
  {0x00,0x1C,0x22,0x41,0x00}, // '(' 40
  {0x00,0x41,0x22,0x1C,0x00}, // ')' 41
  {0x08,0x2A,0x1C,0x2A,0x08}, // '*' 42
  {0x08,0x08,0x3E,0x08,0x08}, // '+' 43
  {0x00,0x50,0x30,0x00,0x00}, // ',' 44
  {0x08,0x08,0x08,0x08,0x08}, // '-' 45
  {0x00,0x60,0x60,0x00,0x00}, // '.' 46
  {0x20,0x10,0x08,0x04,0x02}, // '/' 47
  {0x3E,0x51,0x49,0x45,0x3E}, // '0' 48
  {0x00,0x42,0x7F,0x40,0x00}, // '1' 49
  {0x42,0x61,0x51,0x49,0x46}, // '2' 50
  {0x21,0x41,0x45,0x4B,0x31}, // '3' 51
  {0x18,0x14,0x12,0x7F,0x10}, // '4' 52
  {0x27,0x45,0x45,0x45,0x39}, // '5' 53
  {0x3C,0x4A,0x49,0x49,0x30}, // '6' 54
  {0x01,0x71,0x09,0x05,0x03}, // '7' 55
  {0x36,0x49,0x49,0x49,0x36}, // '8' 56
  {0x06,0x49,0x49,0x29,0x1E}, // '9' 57
  {0x00,0x36,0x36,0x00,0x00}, // ':' 58
  {0x00,0x56,0x36,0x00,0x00}, // ';' 59
  {0x08,0x14,0x22,0x41,0x00}, // '<' 60
  {0x14,0x14,0x14,0x14,0x14}, // '=' 61
  {0x00,0x41,0x22,0x14,0x08}, // '>' 62
  {0x02,0x01,0x51,0x09,0x06}, // '?' 63
  {0x32,0x49,0x79,0x41,0x3E}, // '@' 64
  {0x7E,0x11,0x11,0x11,0x7E}, // 'A' 65
  {0x7F,0x49,0x49,0x49,0x36}, // 'B' 66
  {0x3E,0x41,0x41,0x41,0x22}, // 'C' 67
  {0x7F,0x41,0x41,0x22,0x1C}, // 'D' 68
  {0x7F,0x49,0x49,0x49,0x41}, // 'E' 69
  {0x7F,0x09,0x09,0x09,0x01}, // 'F' 70
  {0x3E,0x41,0x49,0x49,0x7A}, // 'G' 71
  {0x7F,0x08,0x08,0x08,0x7F}, // 'H' 72
  {0x00,0x41,0x7F,0x41,0x00}, // 'I' 73
  {0x20,0x40,0x41,0x3F,0x01}, // 'J' 74
  {0x7F,0x08,0x14,0x22,0x41}, // 'K' 75
  {0x7F,0x40,0x40,0x40,0x40}, // 'L' 76
  {0x7F,0x02,0x04,0x02,0x7F}, // 'M' 77
  {0x7F,0x04,0x08,0x10,0x7F}, // 'N' 78
  {0x3E,0x41,0x41,0x41,0x3E}, // 'O' 79
  {0x7F,0x09,0x09,0x09,0x06}, // 'P' 80
  {0x3E,0x41,0x51,0x21,0x5E}, // 'Q' 81
  {0x7F,0x09,0x19,0x29,0x46}, // 'R' 82
  {0x46,0x49,0x49,0x49,0x31}, // 'S' 83
  {0x01,0x01,0x7F,0x01,0x01}, // 'T' 84
  {0x3F,0x40,0x40,0x40,0x3F}, // 'U' 85
  {0x1F,0x20,0x40,0x20,0x1F}, // 'V' 86
  {0x3F,0x40,0x38,0x40,0x3F}, // 'W' 87
  {0x63,0x14,0x08,0x14,0x63}, // 'X' 88
  {0x07,0x08,0x70,0x08,0x07}, // 'Y' 89
  {0x61,0x51,0x49,0x45,0x43}, // 'Z' 90
  {0x00,0x7F,0x41,0x41,0x00}, // '[' 91
  {0x02,0x04,0x08,0x10,0x20}, // '\' 92
  {0x00,0x41,0x41,0x7F,0x00}, // ']' 93
  {0x04,0x02,0x01,0x02,0x04}, // '^' 94
  {0x40,0x40,0x40,0x40,0x40}, // '_' 95
  {0x00,0x01,0x02,0x04,0x00}, // '`' 96
  {0x20,0x54,0x54,0x54,0x78}, // 'a' 97
  {0x7F,0x48,0x44,0x44,0x38}, // 'b' 98
  {0x38,0x44,0x44,0x44,0x20}, // 'c' 99
  {0x38,0x44,0x44,0x48,0x7F}, // 'd' 100
  {0x38,0x54,0x54,0x54,0x18}, // 'e' 101
  {0x08,0x7E,0x09,0x01,0x02}, // 'f' 102
  {0x0C,0x52,0x52,0x52,0x3E}, // 'g' 103
  {0x7F,0x08,0x04,0x04,0x78}, // 'h' 104
  {0x00,0x44,0x7D,0x40,0x00}, // 'i' 105
  {0x20,0x40,0x44,0x3D,0x00}, // 'j' 106
  {0x7F,0x10,0x28,0x44,0x00}, // 'k' 107
  {0x00,0x41,0x7F,0x40,0x00}, // 'l' 108
  {0x7C,0x04,0x18,0x04,0x78}, // 'm' 109
  {0x7C,0x08,0x04,0x04,0x78}, // 'n' 110
  {0x38,0x44,0x44,0x44,0x38}, // 'o' 111
  {0x7C,0x14,0x14,0x14,0x08}, // 'p' 112
  {0x08,0x14,0x14,0x18,0x7C}, // 'q' 113
  {0x7C,0x08,0x04,0x04,0x08}, // 'r' 114
  {0x48,0x54,0x54,0x54,0x20}, // 's' 115
  {0x04,0x3F,0x44,0x40,0x20}, // 't' 116
  {0x3C,0x40,0x40,0x40,0x7C}, // 'u' 117
  {0x1C,0x20,0x40,0x20,0x1C}, // 'v' 118
  {0x3C,0x40,0x30,0x40,0x3C}, // 'w' 119
  {0x44,0x28,0x10,0x28,0x44}, // 'x' 120
  {0x0C,0x50,0x50,0x50,0x3C}, // 'y' 121
  {0x44,0x64,0x54,0x4C,0x44}, // 'z' 122
  {0x00,0x08,0x36,0x41,0x00}, // '{' 123
  {0x00,0x00,0x7F,0x00,0x00}, // '|' 124
  {0x00,0x41,0x36,0x08,0x00}, // '}' 125
  {0x08,0x08,0x2A,0x1C,0x08}, // '→' 126 (right arrow)
};

// ─── MAX7219 Registers ──────────────────────────────────────
#define REG_NOOP        0x00
#define REG_DIGIT0      0x01
#define REG_DIGIT7      0x08
#define REG_DECODE_MODE 0x09
#define REG_INTENSITY   0x0A
#define REG_SCAN_LIMIT  0x0B
#define REG_SHUTDOWN    0x0C
#define REG_DISPLAY_TEST 0x0F

// ─── Display frame buffer: 8 rows × DISPLAY_COLS columns ────
uint8_t frameBuffer[8][DISPLAY_COLS];

// ─── Message storage ────────────────────────────────────────
struct Message {
  bool   active;
  uint8_t len;
  char   text[MAX_MSG_LEN + 1];
};

Message messages[MAX_MESSAGES];
uint8_t messageCount = 0;
int8_t  activeIdx    = 0;   // which message is currently displayed

// ─── Scroll state ───────────────────────────────────────────
char    scrollBuf[MAX_MSG_LEN + 32];  // extra padding for clear entry/exit
int16_t scrollPos    = DISPLAY_COLS; // current column offset (starts right of screen)
uint8_t speedValue   = 50;           // 1–100
bool    useComputer  = false;        // false = pot mode, true = computer mode

unsigned long lastScrollTime = 0;

// ─── Button debounce ────────────────────────────────────────
unsigned long lastBtnTime[3] = {0, 0, 0};
bool          btnState[3]    = {HIGH, HIGH, HIGH};
#define BTN_DEBOUNCE_MS 200

// ─── Serial input buffer ────────────────────────────────────
#define CMD_BUF_SIZE 128
char    cmdBuf[CMD_BUF_SIZE];
uint8_t cmdLen = 0;

// ═══════════════════════════════════════════════════════════
//  MAX7219 Low-level SPI helpers
// ═══════════════════════════════════════════════════════════

void maxSendByte(uint8_t b) {
  for (int8_t i = 7; i >= 0; i--) {
    digitalWrite(PIN_CLK, LOW);
    digitalWrite(PIN_DIN, (b >> i) & 1);
    digitalWrite(PIN_CLK, HIGH);
  }
}

// Send (reg, data) to ONE device; all others get no-op
void maxWriteOne(uint8_t device, uint8_t reg, uint8_t data) {
  digitalWrite(PIN_CS, LOW);
  for (uint8_t i = 0; i < NUM_DEVICES; i++) {
    if (i == device) {
      maxSendByte(reg);
      maxSendByte(data);
    } else {
      maxSendByte(REG_NOOP);
      maxSendByte(0x00);
    }
  }
  digitalWrite(PIN_CS, HIGH);
}

// Send (reg, data) to ALL devices simultaneously
void maxWriteAll(uint8_t reg, uint8_t data) {
  digitalWrite(PIN_CS, LOW);
  for (uint8_t i = 0; i < NUM_DEVICES; i++) {
    maxSendByte(reg);
    maxSendByte(data);
  }
  digitalWrite(PIN_CS, HIGH);
}

void maxInit() {
  maxWriteAll(REG_SHUTDOWN,    0x01); // normal operation
  maxWriteAll(REG_DECODE_MODE, 0x00); // no BCD decode (raw bitmap)
  maxWriteAll(REG_SCAN_LIMIT,  0x07); // all 8 rows
  maxWriteAll(REG_INTENSITY,   0x08); // mid brightness
  maxWriteAll(REG_DISPLAY_TEST,0x00); // display test off
  clearDisplay();
}

void clearDisplay() {
  memset(frameBuffer, 0, sizeof(frameBuffer));
  flushDisplay();
}

// Push frameBuffer to the MAX7219 chain
// Column mapping: device 0 = rightmost, device N-1 = leftmost
// Within each device, row reg 1 = top row
void flushDisplay() {
  for (uint8_t row = 0; row < 8; row++) {
    digitalWrite(PIN_CS, LOW);
    for (int8_t d = NUM_DEVICES - 1; d >= 0; d--) {
      maxSendByte(REG_DIGIT0 + row);
      uint8_t colData = 0;
      for (uint8_t c = 0; c < 8; c++) {
        uint8_t col = d * 8 + c;
        if (frameBuffer[row][col]) colData |= (1 << (7 - c));
      }
      maxSendByte(colData);
    }
    digitalWrite(PIN_CS, HIGH);
  }
}

// ═══════════════════════════════════════════════════════════
//  Text → pixel rendering into frameBuffer from scrollPos
// ═══════════════════════════════════════════════════════════

// Returns pixel at (col, row) for the scrolling text.
// scrollPos starts at +DISPLAY_COLS (text fully right of screen)
// and decrements each step toward -textWidth (fully left of screen).
// For each display column `col`, the corresponding text column is:
//   textCol = col - scrollPos
// When scrollPos = DISPLAY_COLS: textCol[0] = 0 - 32 = -32 (off left)
// As scrollPos decreases the text slides right-to-left across the display.
uint8_t getTextPixel(const char* text, int16_t scrollPos, uint8_t col, uint8_t row) {
  int16_t textCol = (int16_t)col - scrollPos;
  if (textCol < 0) return 0;

  uint8_t charIdx = (uint8_t)(textCol / 6); // 5 pixels + 1 gap per char
  uint8_t charCol = (uint8_t)(textCol % 6);

  uint8_t textLen = (uint8_t)strlen(text);
  if (charIdx >= textLen) return 0;
  if (charCol >= 5) return 0;  // inter-character gap column

  uint8_t c = (uint8_t)text[charIdx];
  if (c < 32 || c > 126) return 0;

  uint8_t fontByte = pgm_read_byte(&FONT5x7[c - 32][charCol]);
  return (fontByte >> row) & 1;
}

void renderScroll(const char* text, int16_t offset) {
  memset(frameBuffer, 0, sizeof(frameBuffer));
  for (uint8_t col = 0; col < DISPLAY_COLS; col++) {
    for (uint8_t row = 0; row < 8; row++) {
      frameBuffer[row][col] = getTextPixel(text, offset, col, row);
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  EEPROM helpers
// ═══════════════════════════════════════════════════════════

int getSlotAddr(uint8_t idx) {
  return EEPROM_MSG_START + (int)idx * MSG_SLOT_SIZE;
}

void saveMessage(uint8_t idx) {
  if (idx >= MAX_MESSAGES) return;
  int addr = getSlotAddr(idx);
  EEPROM.update(addr,     messages[idx].active ? 1 : 0);
  EEPROM.update(addr + 1, messages[idx].len);
  for (uint8_t i = 0; i < MAX_MSG_LEN + 1; i++) {
    EEPROM.update(addr + 2 + i, (uint8_t)messages[idx].text[i]);
  }
}

void readMessage(uint8_t idx) {
  if (idx >= MAX_MESSAGES) return;
  int addr = getSlotAddr(idx);
  messages[idx].active = (EEPROM.read(addr) == 1);
  messages[idx].len    = EEPROM.read(addr + 1);
  if (messages[idx].len > MAX_MSG_LEN) messages[idx].len = 0;
  for (uint8_t i = 0; i <= MAX_MSG_LEN; i++) {
    messages[idx].text[i] = (char)EEPROM.read(addr + 2 + i);
  }
  messages[idx].text[MAX_MSG_LEN] = '\0';
}

void loadMessages() {
  uint8_t magic = EEPROM.read(EEPROM_MAGIC_ADDR);
  if (magic != EEPROM_MAGIC) {
    // First run — write defaults
    EEPROM.write(EEPROM_MAGIC_ADDR, EEPROM_MAGIC);
    EEPROM.write(EEPROM_COUNT_ADDR, 0);
    EEPROM.write(EEPROM_SPEED_ADDR, 50);
    EEPROM.write(EEPROM_MODE_ADDR,  0);
    messageCount = 0;
    speedValue   = 50;
    useComputer  = false;
    // Zero all message slots
    for (uint8_t i = 0; i < MAX_MESSAGES; i++) {
      messages[i].active = false;
      messages[i].len    = 0;
      messages[i].text[0] = '\0';
      saveMessage(i);
    }
    return;
  }
  messageCount = EEPROM.read(EEPROM_COUNT_ADDR);
  if (messageCount > MAX_MESSAGES) messageCount = 0;
  speedValue  = EEPROM.read(EEPROM_SPEED_ADDR);
  if (speedValue < SPEED_MIN || speedValue > SPEED_MAX) speedValue = 50;
  useComputer = (EEPROM.read(EEPROM_MODE_ADDR) == 1);
  for (uint8_t i = 0; i < MAX_MESSAGES; i++) {
    readMessage(i);
  }
}

void saveConfig() {
  EEPROM.update(EEPROM_COUNT_ADDR, messageCount);
  EEPROM.update(EEPROM_SPEED_ADDR, speedValue);
  EEPROM.update(EEPROM_MODE_ADDR,  useComputer ? 1 : 0);
}

// Count only active messages
uint8_t countActive() {
  uint8_t n = 0;
  for (uint8_t i = 0; i < MAX_MESSAGES; i++) {
    if (messages[i].active) n++;
  }
  return n;
}

// Find the Nth active message index (1-based)
int8_t findActiveBySeq(uint8_t seq) {
  uint8_t n = 0;
  for (uint8_t i = 0; i < MAX_MESSAGES; i++) {
    if (messages[i].active) {
      n++;
      if (n == seq) return (int8_t)i;
    }
  }
  return -1;
}

// Return the next active index after current (wraps)
int8_t nextActive(int8_t cur) {
  for (uint8_t i = 1; i <= MAX_MESSAGES; i++) {
    int8_t idx = (cur + i) % MAX_MESSAGES;
    if (messages[idx].active) return idx;
  }
  return -1;
}

int8_t prevActive(int8_t cur) {
  for (uint8_t i = 1; i <= MAX_MESSAGES; i++) {
    int8_t idx = (cur - i + MAX_MESSAGES) % MAX_MESSAGES;
    if (messages[idx].active) return idx;
  }
  return -1;
}

// Rebuild scrollBuf from the active message at activeIdx
void rebuildScrollBuf() {
  if (activeIdx < 0 || !messages[activeIdx].active) {
    strcpy(scrollBuf, "  SCROLLVIEW  ");
  } else {
    // Leading spaces so text slides in from the right
    strcpy(scrollBuf, "   ");
    strncat(scrollBuf, messages[activeIdx].text, MAX_MSG_LEN);
    strcat(scrollBuf, "   ");
  }
  scrollPos = DISPLAY_COLS; // reset scroll position
}

// ═══════════════════════════════════════════════════════════
//  Serial command protocol
// ═══════════════════════════════════════════════════════════

void sendBT(const char* str) {
  Serial1.println(str);
  Serial.print("BT> "); Serial.println(str);
}

void handleCommand(char* line) {
  Serial.print("CMD: "); Serial.println(line);

  // Tokenize by '|'
  char* tokens[6];
  uint8_t tokCount = 0;
  char* p = strtok(line, "|");
  while (p && tokCount < 6) {
    tokens[tokCount++] = p;
    p = strtok(NULL, "|");
  }
  if (tokCount == 0) return;

  char* cmd = tokens[0];

  // ── PING ────────────────────────────────────────────────
  if (strcmp(cmd, "PING") == 0) {
    sendBT("OK|PING");
    return;
  }

  // ── STATUS ──────────────────────────────────────────────
  if (strcmp(cmd, "STATUS") == 0) {
    char resp[80];
    uint8_t totalActive = countActive();
    // Compute sequential ID (1-based) of the currently displayed message
    uint8_t activeSeqId = 0;
    if (activeIdx >= 0 && messages[activeIdx].active) {
      uint8_t seq = 0;
      for (uint8_t i = 0; i < MAX_MESSAGES; i++) {
        if (messages[i].active) {
          seq++;
          if ((int8_t)i == activeIdx) { activeSeqId = seq; break; }
        }
      }
    }
    snprintf(resp, sizeof(resp),
      "STATUS|messages=%d|active=%d|speed=%d|mode=%s",
      totalActive, activeSeqId,
      speedValue,
      useComputer ? "computer" : "potentiometer");
    sendBT(resp);
    return;
  }

  // ── LIST ────────────────────────────────────────────────
  if (strcmp(cmd, "LIST") == 0) {
    uint8_t seq = 1;
    for (uint8_t i = 0; i < MAX_MESSAGES; i++) {
      if (messages[i].active) {
        char resp[80];
        snprintf(resp, sizeof(resp), "LIST|%d|%s", seq, messages[i].text);
        sendBT(resp);
        seq++;
      }
    }
    sendBT("END|LIST");
    return;
  }

  // ── ADD|<id>|<text> ─────────────────────────────────────
  if (strcmp(cmd, "ADD") == 0) {
    if (tokCount < 3) { sendBT("ERROR|INVALID_COMMAND"); return; }
    if (countActive() >= MAX_MESSAGES) { sendBT("ERROR|EEPROM_FULL"); return; }
    uint8_t seq = (uint8_t)atoi(tokens[1]);
    char* text  = tokens[2];
    if (strlen(text) == 0) { sendBT("ERROR|EMPTY_MESSAGE"); return; }
    if (strlen(text) > MAX_MSG_LEN) { sendBT("ERROR|MESSAGE_TOO_LONG"); return; }
    // Find first empty slot
    int8_t slot = -1;
    for (uint8_t i = 0; i < MAX_MESSAGES; i++) {
      if (!messages[i].active) { slot = (int8_t)i; break; }
    }
    if (slot < 0) { sendBT("ERROR|EEPROM_FULL"); return; }
    messages[slot].active = true;
    messages[slot].len    = strlen(text);
    strncpy(messages[slot].text, text, MAX_MSG_LEN);
    messages[slot].text[MAX_MSG_LEN] = '\0';
    saveMessage(slot);
    // Update active message if none was displayed
    if (activeIdx < 0 || !messages[activeIdx].active) {
      activeIdx = slot;
      rebuildScrollBuf();
    }
    saveConfig();
    char resp[16];
    snprintf(resp, sizeof(resp), "OK|ADD|%d", seq);
    sendBT(resp);
    return;
  }

  // ── EDIT|<id>|<text> ────────────────────────────────────
  if (strcmp(cmd, "EDIT") == 0) {
    if (tokCount < 3) { sendBT("ERROR|INVALID_COMMAND"); return; }
    uint8_t seq  = (uint8_t)atoi(tokens[1]);
    char*   text = tokens[2];
    if (seq < 1) { sendBT("ERROR|INVALID_ID"); return; }
    int8_t slot  = findActiveBySeq(seq);
    if (slot < 0) { sendBT("ERROR|INVALID_ID"); return; }
    if (strlen(text) == 0) { sendBT("ERROR|EMPTY_MESSAGE"); return; }
    if (strlen(text) > MAX_MSG_LEN) { sendBT("ERROR|MESSAGE_TOO_LONG"); return; }
    messages[slot].len = strlen(text);
    strncpy(messages[slot].text, text, MAX_MSG_LEN);
    messages[slot].text[MAX_MSG_LEN] = '\0';
    saveMessage(slot);
    if (slot == activeIdx) rebuildScrollBuf();
    char resp[16];
    snprintf(resp, sizeof(resp), "OK|EDIT|%d", seq);
    sendBT(resp);
    return;
  }

  // ── DELETE|<id> ─────────────────────────────────────────
  if (strcmp(cmd, "DELETE") == 0) {
    if (tokCount < 2) { sendBT("ERROR|INVALID_COMMAND"); return; }
    uint8_t seq = (uint8_t)atoi(tokens[1]);
    if (seq < 1) { sendBT("ERROR|INVALID_ID"); return; }
    int8_t slot = findActiveBySeq(seq);
    if (slot < 0) { sendBT("ERROR|INVALID_ID"); return; }
    messages[slot].active = false;
    messages[slot].len    = 0;
    messages[slot].text[0] = '\0';
    saveMessage(slot);
    saveConfig();
    if (slot == activeIdx) {
      int8_t next = nextActive(slot);
      activeIdx = next;
      rebuildScrollBuf();
    }
    char resp[16];
    snprintf(resp, sizeof(resp), "OK|DELETE|%d", seq);
    sendBT(resp);
    return;
  }

  // ── SHOW|<id> ───────────────────────────────────────────
  if (strcmp(cmd, "SHOW") == 0) {
    if (tokCount < 2) { sendBT("ERROR|INVALID_COMMAND"); return; }
    uint8_t seq = (uint8_t)atoi(tokens[1]);
    if (seq < 1) { sendBT("ERROR|INVALID_ID"); return; }
    int8_t slot = findActiveBySeq(seq);
    if (slot < 0) { sendBT("ERROR|INVALID_ID"); return; }
    activeIdx = slot;
    rebuildScrollBuf();
    char resp[16];
    snprintf(resp, sizeof(resp), "OK|SHOW|%d", seq);
    sendBT(resp);
    return;
  }

  // ── CLEAR ───────────────────────────────────────────────
  if (strcmp(cmd, "CLEAR") == 0) {
    for (uint8_t i = 0; i < MAX_MESSAGES; i++) {
      messages[i].active  = false;
      messages[i].len     = 0;
      messages[i].text[0] = '\0';
      saveMessage(i);
    }
    messageCount = 0;
    activeIdx    = -1;
    saveConfig();
    rebuildScrollBuf();
    sendBT("OK|CLEAR");
    return;
  }

  // ── SPEED|<value> ───────────────────────────────────────
  if (strcmp(cmd, "SPEED") == 0) {
    if (tokCount < 2) { sendBT("ERROR|INVALID_COMMAND"); return; }
    int v = atoi(tokens[1]);
    if (v < SPEED_MIN || v > SPEED_MAX) { sendBT("ERROR|INVALID_SPEED"); return; }
    speedValue  = (uint8_t)v;
    useComputer = true;
    saveConfig();
    char resp[24];
    snprintf(resp, sizeof(resp), "OK|SPEED|%d", v);
    sendBT(resp);
    return;
  }

  // ── MODE|potentiometer  or  MODE|computer ───────────────
  if (strcmp(cmd, "MODE") == 0) {
    if (tokCount < 2) { sendBT("ERROR|INVALID_COMMAND"); return; }
    if (strcmp(tokens[1], "potentiometer") == 0) {
      useComputer = false;
    } else if (strcmp(tokens[1], "computer") == 0) {
      useComputer = true;
    } else {
      sendBT("ERROR|INVALID_COMMAND"); return;
    }
    saveConfig();
    char resp[32];
    snprintf(resp, sizeof(resp), "OK|MODE|%s", tokens[1]);
    sendBT(resp);
    return;
  }

  sendBT("ERROR|INVALID_COMMAND");
}

// Non-blocking serial line reader
void processSerial() {
  while (Serial1.available()) {
    char c = (char)Serial1.read();
    if (c == '\r') continue;  // skip CR
    if (c == '\n') {
      cmdBuf[cmdLen] = '\0';
      if (cmdLen > 0) {
        handleCommand(cmdBuf);
      }
      cmdLen = 0;
    } else {
      if (cmdLen < CMD_BUF_SIZE - 1) {
        cmdBuf[cmdLen++] = c;
      }
      // Overflow protection: just reset
      if (cmdLen >= CMD_BUF_SIZE - 1) {
        cmdLen = 0;
        sendBT("ERROR|INVALID_COMMAND");
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  Button handling (non-blocking debounce)
// ═══════════════════════════════════════════════════════════

void processButtons() {
  int pins[3] = { BTN_PREV, BTN_NEXT, BTN_MODE };
  unsigned long now = millis();

  for (uint8_t b = 0; b < 3; b++) {
    bool reading = digitalRead(pins[b]);
    if (reading == LOW && btnState[b] == HIGH) {
      if (now - lastBtnTime[b] > BTN_DEBOUNCE_MS) {
        lastBtnTime[b] = now;
        btnState[b] = LOW;

        if (b == 0) { // PREV
          int8_t p = prevActive(activeIdx);
          if (p >= 0) { activeIdx = p; rebuildScrollBuf(); }
        } else if (b == 1) { // NEXT
          int8_t n = nextActive(activeIdx);
          if (n >= 0) { activeIdx = n; rebuildScrollBuf(); }
        } else { // MODE toggle
          useComputer = !useComputer;
          saveConfig();
          Serial.print("Mode: ");
          Serial.println(useComputer ? "computer" : "potentiometer");
        }
      }
    }
    if (reading == HIGH) btnState[b] = HIGH;
  }
}

// ═══════════════════════════════════════════════════════════
//  Speed from potentiometer
// ═══════════════════════════════════════════════════════════

void processPotentiometer() {
  if (useComputer) return;
  uint16_t raw = analogRead(PIN_POT);  // 0–1023
  // Map to SPEED_MIN–SPEED_MAX
  speedValue = map(raw, 0, 1023, SPEED_MIN, SPEED_MAX);
}

// Convert speed (1–100) to scroll interval in ms
// speed=1  → 200 ms/step (very slow)
// speed=100 → 20 ms/step (fast)
unsigned long speedToInterval(uint8_t s) {
  return map(s, SPEED_MIN, SPEED_MAX, 200UL, 20UL);
}

// ═══════════════════════════════════════════════════════════
//  setup / loop
// ═══════════════════════════════════════════════════════════

void setup() {
  Serial.begin(DBG_BAUD);
  Serial1.begin(BT_BAUD);

  pinMode(PIN_DIN, OUTPUT);
  pinMode(PIN_CLK, OUTPUT);
  pinMode(PIN_CS,  OUTPUT);
  digitalWrite(PIN_CS, HIGH);

  pinMode(BTN_PREV, INPUT_PULLUP);
  pinMode(BTN_NEXT, INPUT_PULLUP);
  pinMode(BTN_MODE, INPUT_PULLUP);

  maxInit();
  loadMessages();

  // Pick first active message
  activeIdx = -1;
  for (uint8_t i = 0; i < MAX_MESSAGES; i++) {
    if (messages[i].active) { activeIdx = i; break; }
  }
  rebuildScrollBuf();

  // Send READY over Bluetooth
  delay(1000); // give HC-05 time to settle
  sendBT("READY");
  Serial.println(F("ScrollView started"));
}

void loop() {
  unsigned long now = millis();

  // 1. Read & process Bluetooth commands (non-blocking)
  processSerial();

  // 2. Read buttons
  processButtons();

  // 3. Read potentiometer
  processPotentiometer();

  // 4. Scrolling animation
  unsigned long interval = speedToInterval(speedValue);
  if (now - lastScrollTime >= interval) {
    lastScrollTime = now;

    renderScroll(scrollBuf, scrollPos);
    flushDisplay();

    scrollPos--;

    // Full text width = strlen * 6 columns; when fully off-screen left, reset
    int16_t textWidth = (int16_t)(strlen(scrollBuf) * 6);
    if (scrollPos < -textWidth) {
      scrollPos = DISPLAY_COLS;  // restart scroll
    }
  }
}
