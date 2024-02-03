import { Requester } from '../base/requester.js';

export class JoinRequester extends Requester {
  async challenge() {
    throw "ImplementInSpecificHandshake"
  }

  async complete(envelope) {
    throw "ImplementInSpecificHandshake"
  }
}