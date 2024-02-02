import { Requester } from '../base/requester.js';

export class JoinRequester extends Requester {
  async negotiate(sessionKeyMessage) {
    throw "ImplementInSpecificHandshake"
  }

  async complete(envelope) {
    throw "ImplementInSpecificHandshake"
  }
}