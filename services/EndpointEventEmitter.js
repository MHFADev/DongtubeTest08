import { EventEmitter } from 'events';

class EndpointEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
  }

  addClient(res) {
    this.clients.add(res);
    console.log(`📡 Endpoint SSE client connected. Total clients: ${this.clients.size}`);
  }

  removeClient(res) {
    this.clients.delete(res);
    console.log(`📡 Endpoint SSE client disconnected. Total clients: ${this.clients.size}`);
  }

  notifyEndpointChange(action, endpoint) {
    const event = {
      type: 'endpoint_change',
      action,
      timestamp: new Date().toISOString(),
      data: endpoint
    };

    console.log(`📢 Broadcasting endpoint ${action}:`, endpoint.path);

    this.clients.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (error) {
        console.error('Failed to send SSE to client:', error.message);
        this.clients.delete(client);
      }
    });

    this.emit('endpoint_changed', event);
  }

  notifyBulkChange(action, count) {
    const event = {
      type: 'endpoint_bulk_change',
      action,
      count,
      timestamp: new Date().toISOString()
    };

    console.log(`📢 Broadcasting bulk endpoint ${action}: ${count} endpoints`);

    this.clients.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (error) {
        console.error('Failed to send SSE to client:', error.message);
        this.clients.delete(client);
      }
    });

    this.emit('endpoint_bulk_changed', event);
  }

  notifySyncComplete(stats) {
    const event = {
      type: 'endpoint_sync_complete',
      timestamp: new Date().toISOString(),
      stats
    };

    console.log(`📢 Broadcasting sync complete:`, stats);

    this.clients.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (error) {
        console.error('Failed to send SSE to client:', error.message);
        this.clients.delete(client);
      }
    });

    this.emit('sync_complete', event);
  }

  sendHeartbeat() {
    this.clients.forEach(client => {
      try {
        client.write(': heartbeat\n\n');
      } catch (error) {
        this.clients.delete(client);
      }
    });
  }
}

const endpointEventEmitter = new EndpointEventEmitter();

// Send heartbeat every 30 seconds to keep connections alive
setInterval(() => {
  if (endpointEventEmitter.clients.size > 0) {
    endpointEventEmitter.sendHeartbeat();
  }
}, 30000);

export default endpointEventEmitter;
