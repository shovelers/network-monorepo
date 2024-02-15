import { Approver, Handshake } from './base/approver.js';
import { Requester } from './base/requester.js';

export class JoinHandshake extends Handshake {
  async confirmData() {
    return { }
  }
}

export class JoinApprover extends Approver {
  newHandshake(id) {
    return new JoinHandshake(this.agent, this.channel, id, this.notification)
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