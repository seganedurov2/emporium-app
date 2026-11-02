import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 5175);

const server = createServer();
const wss = new WebSocketServer({ server, path: '/ws' });

const rooms = new Map(); // roomId -> Set<ws>

wss.on('connection', (ws, req) => {
  let currentRoom = null;

  ws.on('message', raw => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', error: 'invalid_json' }));
      return;
    }

    switch (msg.type) {
      case 'join': {
        const room = msg.room ?? 'default';
        if (currentRoom && rooms.has(currentRoom)) {
          rooms.get(currentRoom).delete(ws);
        }
        currentRoom = room;
        if (!rooms.has(room)) rooms.set(room, new Set());
        rooms.get(room).add(ws);
        ws.send(JSON.stringify({ type: 'joined', room }));
        broadcast(room, { type: 'presence', room, count: rooms.get(room).size }, ws);
        break;
      }

      case 'state_update': {
        const room = msg.room ?? 'default';
        if (!currentRoom) currentRoom = room;
        broadcast(room, { type: 'state_sync', payload: msg.payload, updatedBy: 'peer' }, ws);
        break;
      }

      case 'leave': {
        if (currentRoom && rooms.has(currentRoom)) {
          rooms.get(currentRoom).delete(ws);
          broadcast(currentRoom, { type: 'presence', room: currentRoom, count: rooms.get(currentRoom).size }, ws);
        }
        currentRoom = null;
        break;
      }

      default:
        ws.send(JSON.stringify({ type: 'error', error: 'unknown_type' }));
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(ws);
      broadcast(currentRoom, { type: 'presence', room: currentRoom, count: rooms.get(currentRoom).size }, ws);
    }
  });
});

function broadcast(room, message, excludeWs) {
  const members = rooms.get(room);
  if (!members) return;
  const data = JSON.stringify(message);
  for (const ws of members) {
    if (ws !== excludeWs && ws.readyState === 1) {
      ws.send(data);
    }
  }
}

server.listen(PORT, () => {
  console.log(`WebSocket server listening on ws://localhost:${PORT}/ws`);
});
