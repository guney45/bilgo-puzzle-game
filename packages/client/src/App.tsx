import { useState } from 'react';
import type { Room } from '@colyseus/sdk';
import Home from './screens/Home';
import RoomView from './screens/RoomView';

export default function App() {
  const [room, setRoom] = useState<Room | null>(null);

  if (room) return <RoomView room={room} />;
  return <Home onRoomReady={setRoom} />;
}
