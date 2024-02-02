import { Approver } from '../base/approver.js';

export class JoinApprover extends Approver {
  async negotiate(challenge) {
    throw "ImplementInSpecificHandshake"
  }

  async confirm(message) {
    throw "ImplementInSpecificHandshake"
  }

  async reject() {
    throw "ImplementInSpecificHandshake"
  }
}