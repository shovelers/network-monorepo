import { Approver } from '../base/approver.js';

export class JoinApprover extends Approver {
  async confirmData() {
    throw "ImplementInSpecificHandshake"
  }
}