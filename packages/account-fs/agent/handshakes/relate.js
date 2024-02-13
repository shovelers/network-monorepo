import { Approver, Handshake } from './base/approver.js';
import { Requester } from './base/requester.js';

export class RelateHandshake extends Handshake {
  async confirmData() {
    return { }
  }
}

export class RelateApprover extends Approver {
  newHandshake(id) {
    return new RelateHandshake(this.agent, this.channel, id, this.notification)
  }
}

export class RelateRequester extends Requester {
  async challenge() {
    return { }
  }
}