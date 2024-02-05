import { Approver, Handshake } from '../base/approver.js';

export class JoinHandshake extends Handshake {
  async confirmData() {
    return { }
  }
}

export class JoinApprover extends Approver {
  newHandshake(id) {
    return new JoinHandshake(this.agent, this.channel, id, this.notification, this.onComplete)
  }
}