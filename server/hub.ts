import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { parse } from 'url';

export type ClientId = string;
export type RoomId = string;

interface HubClient {
  ws: WebSocket;
  id: ClientId;
  room: RoomId | null;
  lastSeen: number;
}

interface RoomState {
  id: RoomId;
  createdAt: number;
  clients: Map<ClientId, HubClient>;
  gameState: unknown;
  version: number;
}

interface ClientMessage {
  type: string;
  room?: RoomId;
  payload?: unknown;
  id?: number;
}

interface ServerMessage {
  type: string;
  room?: RoomId | null;
  payload?: unknown;
  id?: number;
  ts: number;
}

export class WorkstationHub {
  private wss: WebSocketServer;
  private clients = new Map<ClientId, HubClient>();
  private rooms = new Map<RoomId, RoomState>();
  private nextClientId = 1;
  private nextMessageId = 1;

  constructor(port: number) {
    const httpServer = createServer((_req, _res) => {
      _res.writeHead(204);
      _res.end();
    });

    this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      const url = parse(req.url ?? '', true);
      const roomId = (url.query.room as string) || 'lobby';
      const clientId = `client_${this.nextClientId++}`;

      const client: HubClient = {
        ws,
        id: clientId,
        room: null,
        lastSeen: Date.now()
      };
      this.clients.set(clientId, client);

      ws.on('message', (raw) => {
        this.handleMessage(client, raw as Buffer);
      });

      ws.on('close', () => {
        this.leaveRoom(client);
        this.clients.delete(clientId);
        this.broadcast({
          type: 'client_left',
          room: client.room,
          payload: { clientId },
          id: this.nextMessageId++,
          ts: Date.now()
        });
      });

      ws.on('error', (err) => {
        console.error(`WebSocket error for client ${clientId}:`, err.message);
      });

      this.joinRoom(client, roomId);

      this.send(client, {
        type: 'hello',
        room: client.room,
        payload: { clientId, room: client.room },
        id: this.nextMessageId++,
        ts: Date.now()
      });
    });

    httpServer.listen(port, () => {
      console.log(`WorkstationHub listening on ws://localhost:${port}/ws`);
    });
  }

  private joinRoom(client: HubClient, roomId: RoomId) {
    if (client.room) {
      this.leaveRoom(client);
    }

    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        createdAt: Date.now(),
        clients: new Map(),
        gameState: null,
        version: 0
      };
      this.rooms.set(roomId, room);
    }

    client.room = roomId;
    room.clients.set(client.id, client);

    this.broadcastToRoom(roomId, {
      type: 'client_joined',
      room: roomId,
      payload: { clientId: client.id, room: roomId },
      id: this.nextMessageId++,
      ts: Date.now()
    });

    this.send(client, {
      type: 'room_state',
      room: roomId,
      payload: {
        room: room.id,
        clients: Array.from(room.clients.keys()),
        gameState: room.gameState,
        version: room.version
      },
      id: this.nextMessageId++,
      ts: Date.now()
    });
  }

  private leaveRoom(client: HubClient) {
    if (!client.room) return;
    const room = this.rooms.get(client.room);
    if (room) {
      room.clients.delete(client.id);
      if (room.clients.size === 0) {
        this.rooms.delete(client.room);
      } else {
        this.broadcastToRoom(client.room, {
          type: 'client_left',
          room: client.room,
          payload: { clientId: client.id },
          id: this.nextMessageId++,
          ts: Date.now()
        });
      }
    }
    client.room = null;
  }

  private handleMessage(client: HubClient, raw: Buffer) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString('utf-8'));
    } catch {
      this.send(client, {
        type: 'error',
        room: client.room,
        payload: { message: 'Invalid JSON' },
        id: this.nextMessageId++,
        ts: Date.now()
      });
      return;
    }

    client.lastSeen = Date.now();

    switch (msg.type) {
      case 'join':
        if (typeof msg.room === 'string') {
          this.joinRoom(client, msg.room);
        }
        break;
      case 'leave':
        this.leaveRoom(client);
        break;
      case 'state_update':
        this.handleStateUpdate(client, msg);
        break;
      case 'state_request':
        this.handleStateRequest(client, msg);
        break;
      case 'chat':
        this.broadcastToRoom(client.room ?? 'lobby', {
          type: 'chat',
          room: client.room,
          payload: { clientId: client.id, ...(msg.payload as object) },
          id: msg.id,
          ts: Date.now()
        });
        break;
      case 'ping':
        this.send(client, {
          type: 'pong',
          room: client.room,
          payload: { ts: msg.payload },
          id: msg.id,
          ts: Date.now()
        });
        break;
      default:
        this.send(client, {
          type: 'error',
          room: client.room,
          payload: { message: `Unknown message type: ${msg.type}` },
          id: msg.id,
          ts: Date.now()
        });
    }
  }

  private handleStateUpdate(client: HubClient, msg: ClientMessage) {
    const roomId = client.room;
    if (!roomId) {
      this.send(client, {
        type: 'error',
        room: null,
        payload: { message: 'Not in a room' },
        id: msg.id,
        ts: Date.now()
      });
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) return;

    room.gameState = msg.payload;
    room.version += 1;

    this.broadcastToRoom(roomId, {
      type: 'state_sync',
      room: roomId,
      payload: { gameState: room.gameState, version: room.version, updatedBy: client.id },
      id: msg.id,
      ts: Date.now()
    });
  }

  private handleStateRequest(client: HubClient, msg: ClientMessage) {
    const roomId = client.room;
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;

    this.send(client, {
      type: 'state_sync',
      room: roomId,
      payload: { gameState: room.gameState, version: room.version, updatedBy: null },
      id: msg.id,
      ts: Date.now()
    });
  }

  private send(client: HubClient, msg: ServerMessage) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: ServerMessage) {
    for (const client of this.clients.values()) {
      this.send(client, msg);
    }
  }

  private broadcastToRoom(roomId: RoomId | null, msg: ServerMessage) {
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const client of room.clients.values()) {
      this.send(client, msg);
    }
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

// Entry point: start the hub when run directly
if (import.meta.main) {
  const port = Number(process.env.WS_PORT) || 5175;
  new WorkstationHub(port);
}
