import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { envConfig } from '../../../config/env.config';
import { logger } from '../../../utils/logger.util';
import { cpuMemLivePollerService } from './monitoring/cpuMemLivePoller.service';

let io: SocketServer | null = null;

export const socketService = {
  initialize(server: HttpServer) {
    io = new SocketServer(server, {
      cors: {
        origin: envConfig.allowedOrigins,
        credentials: true,
      },
    });

    io.on('connection', (socket) => {
      // Track which servers this socket subscribed to for live metrics so we
      // can clean up the poller ref-count if the client disconnects silently.
      const liveServers = new Set<string>();

      socket.on('joinServer', (serverId: string) => {
        if (serverId) {
          socket.join(`server:${serverId}`);
        }
      });

      socket.on('leaveServer', (serverId: string) => {
        if (serverId) {
          socket.leave(`server:${serverId}`);
        }
      });

      socket.on('startLiveMetrics', (serverId: string) => {
        if (serverId && !liveServers.has(serverId)) {
          liveServers.add(serverId);
          cpuMemLivePollerService.startClient(serverId);
        }
      });

      socket.on('stopLiveMetrics', (serverId: string) => {
        if (serverId && liveServers.has(serverId)) {
          liveServers.delete(serverId);
          cpuMemLivePollerService.stopClient(serverId);
        }
      });

      socket.on('disconnect', () => {
        for (const serverId of liveServers) {
          cpuMemLivePollerService.stopClient(serverId);
        }
        liveServers.clear();
      });
    });

    logger.info('Socket.IO initialized for server management updates');
  },

  emitToServer(serverId: string, event: string, payload: unknown) {
    io?.to(`server:${serverId}`).emit(event, payload);
  },

  emit(event: string, payload: unknown) {
    io?.emit(event, payload);
  },
};
