import { Handshake } from './base/handshake.js';
import { Requester } from './base/requester.js';

export class JoinHandshake extends Handshake {
  async confirmData() {
    return { }
  }
}

export class JoinRequester extends Requester {
  type() {
    return "JOIN"
  }

  async challenge() {
    const handle = await this.agent.handle()
    return { profile: { handle: handle } }
  }
}