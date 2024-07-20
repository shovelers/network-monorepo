import { Notification } from './common.js';
import { Handshake } from './handshake.js';

export class Approver {
  constructor(agent, channel) {
    this.agent = agent
    this.channel = channel
    this.notification = new Notification()
    this.handshakes = []
  }

  async handler(message) {
    const request = JSON.parse(message)
    let handshake = this.handshakes.find((h) => h.id == request.id)

    if (!handshake) {
      handshake = this.newHandshake(request)
      this.handshakes.push(handshake)
    } 
    await handshake.handle(message)
  }

  newHandshake(request) {
    switch (request.type) {
    case "JOIN":
    case "RELATE":
      return new Handshake(this.agent, this.channel, request.id, this.notification)
    default:
      throw "Unknown Handshake Type"
    }
  }
}