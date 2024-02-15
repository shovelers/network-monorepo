import { Handshake } from './base/handshake.js';
import { Requester } from './base/requester.js';

export class RelateHandshake extends Handshake {
  async confirmData() {
    return { }
  }
}

export class RelateRequester extends Requester {
  type() {
    return "RELATE"
  }
  
  async challenge() {
    return { }
  }
}