import { Approver, Handshake } from '../base/approver.js';

export class JoinHandshake extends Handshake {
  async confirmData() {
    return { }
  }
}

export class JoinApprover extends Approver {
  async handler(message) {
    if (this.handshake == null) {
      const request = JSON.parse(message)
      this.handshake = new JoinHandshake(this.agent, this.channel, request.id, this.notification, this.onComplete)
      await this.handshake.initiate(message)
    } else {
      await this.handshake.handler(message)
    }
  }
}