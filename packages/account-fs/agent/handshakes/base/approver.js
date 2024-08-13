import { Handshake } from './handshake.js';
import { Channel } from './channel.js';
import { Notification } from './common.js';

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

  async register(type, notification){
    this.router[type] = notification
  }

  registerV2(type, handshakeApprover){
    let notification = new Notification()
    notification.addEventListener("challengeRecieved", async (challengeEvent) => { await handshakeApprover.handleChallenge(challengeEvent) })
    this.router[type] = notification
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
    if (this.router[request.type]) {
      console.log("receive handshake")
      return new Handshake(this.agent, this.channel, request.id, this.router[request.type])
    } else {
      throw `Unregistered Handshake Type: ${request.type}`
    }
  }
}