export class Channel {
  constructor(helia, channelName, forwardingChannel) {
    this.helia = helia
    this.name = channelName
    this.forwardingChannel = forwardingChannel
  }

  async subscribe(actor) {
    this.helia.libp2p.services.pubsub.addEventListener('message', (message) => {
      console.log(`${message.detail.topic}`, new TextDecoder().decode(message.detail.data))
      if (message.detail.topic == this.name) {
        actor.handler(new TextDecoder().decode(message.detail.data))
      }
    })

    this.helia.libp2p.services.pubsub.subscribe(this.name)
  }

  async publish(message) {
    this.helia.libp2p.services.pubsub.publish(this.name, new TextEncoder().encode(message))
    console.log(message)
  }

  async publishViaForwarder(message) {
    if (this.forwardingChannel) {
      const packet = JSON.stringify({topic: this.name, message: JSON.parse(message)})
      this.helia.libp2p.services.pubsub.publish(this.forwardingChannel, new TextEncoder().encode(packet))
      console.log(packet)
    } else {
      this.publish(message)
    }
  }
}