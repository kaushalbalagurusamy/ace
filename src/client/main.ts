const app = document.getElementById('app')!;
app.textContent = 'Golf Race: connecting...';
const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
ws.onmessage = e => { app.textContent = `Server says: ${e.data}`; };
ws.onclose = () => { app.textContent = 'Disconnected from server'; };
