import express from 'express';
import { roleChangeEmitter } from '../services/EventEmitter.js';
import endpointEventEmitter from '../services/EndpointEventEmitter.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/sse/role-updates', authenticate, (req, res) => {
  const userId = req.user.id;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write('data: {"type":"connected","message":"Connected to role update stream"}\n\n');

  console.log(`🔌 SSE: User ${userId} connected to role update stream`);

  const roleChangeHandler = (data) => {
    const eventData = {
      type: data.type,
      newRole: data.role || data.newRole,
      vipExpiresAt: data.vipExpiresAt,
      timestamp: data.timestamp,
      requiresTokenRefresh: true
    };

    console.log(`📤 SSE: Sending role change notification to user ${userId}:`, eventData);
    
    res.write(`event: role-change\n`);
    res.write(`data: ${JSON.stringify(eventData)}\n\n`);
  };

  roleChangeEmitter.on(`role-change:${userId}`, roleChangeHandler);

  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    console.log(`🔌 SSE: User ${userId} disconnected from role update stream`);
    roleChangeEmitter.removeListener(`role-change:${userId}`, roleChangeHandler);
    clearInterval(heartbeatInterval);
    res.end();
  });
});

// SSE endpoint for endpoint updates (public - no auth required)
router.get('/sse/endpoint-updates', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write('data: {"type":"connected","message":"Connected to endpoint update stream"}\n\n');

  endpointEventEmitter.addClient(res);

  req.on('close', () => {
    endpointEventEmitter.removeClient(res);
    res.end();
  });
});

export default router;
