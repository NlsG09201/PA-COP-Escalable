import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  namespace: '/medical-ai',
  cors: { origin: true, credentials: true },
})
export class MedicalAiGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MedicalAiGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const raw =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string) ||
        '';
      const token = String(raw).replace(/^Bearer\s+/i, '');
      const payload = this.jwt.verify(token, {
        secret: process.env.JWT_SECRET,
      }) as { organization_id?: string; sub?: string };
      const orgId = payload.organization_id ? String(payload.organization_id) : '';
      if (!orgId) {
        client.disconnect(true);
        return;
      }
      client.join(`org:${orgId}`);
      client.data.organizationId = orgId;
      client.data.userId = payload.sub;
      this.logger.log(`WS connected org=${orgId}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS disconnected ${client.id}`);
  }

  broadcastAlert(organizationId: string, alert: Record<string, unknown>) {
    if (!this.server) return;
    this.server.to(`org:${organizationId}`).emit('medical-alert', alert);
  }

  broadcastInsight(organizationId: string, insight: Record<string, unknown>) {
    if (!this.server) return;
    this.server.to(`org:${organizationId}`).emit('medical-insight', insight);
  }
}
