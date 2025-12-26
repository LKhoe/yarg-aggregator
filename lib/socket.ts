import { Server as NetServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { NextApiResponse } from 'next';

export type NextApiResponseWithSocket = NextApiResponse & {
  socket: {
    server: any & {
      io?: SocketIOServer;
    };
  };
};

declare global {
  var io: SocketIOServer | undefined;
}

// Store connected devices
const connectedDevices: Map<string, { deviceId: string; deviceName: string; lastSeen: Date; socketId: string }> = new Map();

export const initSocket = (res: NextApiResponseWithSocket) => {
  if (res.socket.server.io) {
    globalThis.io = res.socket.server.io;
    return res.socket.server.io;
  }

  const httpServer = res.socket.server as unknown as NetServer;
  const io = new SocketIOServer(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
  });

  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // Handle device registration
    socket.on('register', (data: { deviceId: string; deviceName: string }) => {
      const { deviceId, deviceName } = data;
      connectedDevices.set(deviceId, {
        deviceId,
        deviceName,
        lastSeen: new Date(),
        socketId: socket.id, // Store socket ID for direct messaging
      });

      // Broadcast updated device list to all clients
      io.emit('devices:update', Array.from(connectedDevices.values()));
      console.log(`Device registered: ${deviceName} (${deviceId})`);
    });

    // Handle sending songs to another user
    socket.on('songs:send', (payload: { toDeviceId: string; songs: any[] }) => {
      const { toDeviceId, songs } = payload;
      const targetDevice = connectedDevices.get(toDeviceId);

      // Find the sender's info using the socket ID (or we could pass it in payload)
      // Ideally we trust the socket association
      const senderDevice = Array.from(connectedDevices.values()).find(d => d.socketId === socket.id);
      const fromDeviceName = senderDevice ? senderDevice.deviceName : 'Unknown User';

      if (targetDevice) {
        console.log(`Sending ${songs.length} songs from ${fromDeviceName} to ${targetDevice.deviceName}`);
        io.to(targetDevice.socketId).emit('songs:receive', {
          fromDeviceName,
          songs,
        });
      } else {
        console.warn(`Target device ${toDeviceId} not found`);
      }
    });

    // Handle device disconnection
    socket.on('disconnect', () => {
      // Find and remove the disconnected device
      for (const [deviceId, device] of connectedDevices.entries()) {
        if (device.deviceId === socket.id || device.socketId === socket.id) { // Check both just in case
          connectedDevices.delete(deviceId);
          // Broadcast updated device list to all clients
          io.emit('devices:update', Array.from(connectedDevices.values()));
          console.log(`Device disconnected: ${device.deviceName} (${deviceId})`);
          break;
        }
      }
    });

    // Handle device heartbeat/ping
    socket.on('heartbeat', (deviceId: string) => {
      const device = connectedDevices.get(deviceId);
      if (device) {
        device.lastSeen = new Date();
        device.socketId = socket.id; // Update socket ID just in case of reconnect
        connectedDevices.set(deviceId, device);
      }
    });
  });

  // Clean up disconnected devices periodically
  setInterval(() => {
    const now = new Date();
    let updated = false;

    for (const [deviceId, device] of connectedDevices.entries()) {
      // If device hasn't sent a heartbeat in the last 30 seconds, consider it disconnected
      if (now.getTime() - device.lastSeen.getTime() > 30000) {
        connectedDevices.delete(deviceId);
        updated = true;
        console.log(`Device timed out: ${device.deviceName} (${deviceId})`);
      }
    }

    if (updated) {
      io.emit('devices:update', Array.from(connectedDevices.values()));
    }
  }, 10000); // Check every 10 seconds

  res.socket.server.io = io;
  globalThis.io = io;
  return io;
};

export const getIO = () => {
  if (globalThis.io) return globalThis.io;
  return null;
};

// Get all connected devices
export const getConnectedDevices = () => {
  return Array.from(connectedDevices.values());
};
