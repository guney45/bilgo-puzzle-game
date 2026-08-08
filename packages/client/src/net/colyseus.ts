import { Client, Room } from '@colyseus/sdk';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:2567';

export const client = new Client(SERVER_URL);

export function connectToGameRoom(): Promise<Room> {
  return client.joinOrCreate('game');
}
