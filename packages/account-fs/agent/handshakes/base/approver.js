import { Handshake } from './handshake.js';
import { Channel } from './channel.js';

export class Approver {
  constructor(agent) {
    this.agent = agent
    this.handshakes = []
    this.channel = null
    this.router = {}
  }

  async start() {
    const channelName = `${await this.agent.accountDID()}-approver`
    this.channel = new Channel(this.agent.helia, channelName)
    //TODO remove circular dependency
    await this.channel.subscribe(this)
  }

  ongoing() {
    return this.handshakes.filter(handshake => handshake.state === "NEGOTIATED");
  }

  register(type, handshakeApprover){
    this.router[type] = handshakeApprover
  }

  async handler(message) {
    const request = JSON.parse(message)
    let handshake = this.handshakes.find((h) => h.id == request.id)

    if (!handshake) {
      handshake = this.newHandshake(request)
      this.handshakes.push(handshake)
    }
    await handshake.handle(message)
    
    if (handshake.state === "INITIATED") {
      await this.router[request.type].challenge(handshake)
    } else if (handshake.state === "NEGOTIATED") {
      await this.router[request.type].approve(handshake)
    }
  }

  newHandshake(request) {
    if (this.router[request.type]) {
      console.log("receive handshake")
      return new Handshake(this.agent, this.channel, request.id)
    } else {
      throw `Unregistered Handshake Type: ${request.type}`
    }
  }
}