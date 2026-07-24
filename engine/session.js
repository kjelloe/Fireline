// engine/session.js
// Ties a WebSocket connection to a game operator.
// Tracks authentication (in v1, just operatorId claim) and team.

export class Session {
    constructor(socket, operatorId) {
        this.socket = socket;
        this.operatorId = operatorId;
        this.team = -1;
        this.authenticated = false;
        this.connectedAt = Date.now();
    }

    send(type, payload) {
        if (this.socket.readyState === 1) { // OPEN
            this.socket.send(JSON.stringify({ type, ...payload }));
        }
    }
}
