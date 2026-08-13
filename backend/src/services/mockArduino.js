/**
 * mockSerial.js
 * 
 * A mock virtual serial port server that emulates the Arduino Mega 2560 behavior.
 * Uses the Node.js 'ws' package or can be run as a virtual TCP port.
 * However, the simplest way is to integrate a "MOCK" port in the backend's
 * listPorts() and serialService.js so that selecting "MOCK_PORT" runs an emulated board.
 */
class MockArduino {
  constructor() {
    this.speed = 50;
    this.mode = 'computer';
    this.messages = [
      { id: 1, text: "MOCK: Welcome to ScrollView" },
      { id: 2, text: "MOCK: Arduino mega emulator active" }
    ];
    this.activeId = 1;
  }

  handleCommand(line) {
    const parts = line.trim().split('|');
    const cmd = parts[0];

    switch (cmd) {
      case 'PING':
        return 'OK|PING';
      
      case 'STATUS':
        return `STATUS|messages=${this.messages.length}|active=${this.activeId}|speed=${this.speed}|mode=${this.mode}`;
      
      case 'LIST':
        let lines = [];
        this.messages.forEach(m => {
          lines.push(`LIST|${m.id}|${m.text}`);
        });
        lines.push('END|LIST');
        return lines;

      case 'ADD': {
        const id = parseInt(parts[1], 10);
        const text = parts[2];
        this.messages.push({ id, text });
        return `OK|ADD|${id}`;
      }

      case 'EDIT': {
        const id = parseInt(parts[1], 10);
        const text = parts[2];
        const msg = this.messages.find(m => m.id === id);
        if (msg) msg.text = text;
        return `OK|EDIT|${id}`;
      }

      case 'DELETE': {
        const id = parseInt(parts[1], 10);
        this.messages = this.messages.filter(m => m.id !== id);
        if (this.activeId === id) {
          this.activeId = this.messages.length > 0 ? this.messages[0].id : 0;
        }
        return `OK|DELETE|${id}`;
      }

      case 'SHOW': {
        const id = parseInt(parts[1], 10);
        this.activeId = id;
        return `OK|SHOW|${id}`;
      }

      case 'SPEED': {
        this.speed = parseInt(parts[1], 10);
        return `OK|SPEED|${this.speed}`;
      }

      case 'MODE': {
        this.mode = parts[1];
        return `OK|MODE|${this.mode}`;
      }

      case 'CLEAR':
        this.messages = [];
        this.activeId = 0;
        return 'OK|CLEAR';

      default:
        return 'ERROR|INVALID_COMMAND';
    }
  }
}

module.exports = MockArduino;
