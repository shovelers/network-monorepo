import { Notification } from './common.js';
import { Handshake } from './handshake.js';

export class Approver {
  constructor(agent) {
    this.agent = agent
    this.notification = new Notification()
    this.handshakes = []
    this.channels = {}
  }

  async register(type, channel) {
    this.channels[type] = channel
    //TODO remove circular dependency, rather take the handler function or controller 
    await this.channels[type].subscribe(this)
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
    if (this.channels[request.type]) {
      console.log("receive handshake")
      return new Handshake(this.agent, this.channels[request.type], request.id, this.notification)
    } else {
      throw `Unregistered Handshake Type: ${request.type}`
    }
  }
}