export class Channel {
  constructor(helia, channelName, forwardingChannel) {
    this.helia = helia
    this.name = channelName
    this.forwardingChannel = forwardingChannel
  }

  async subscribe(actor) {
    console.log("Subscribing to channel:", this.name)
    this.helia.libp2p.services.pubsub.addEventListener('message', (message) => {
      // console.log(`${message.detail.topic}`, new TextDecoder().decode(message.detail.data))
      if (message.detail.topic == this.name) {
        actor.handler(new TextDecoder().decode(message.detail.data))
      }
    })

    this.helia.libp2p.services.pubsub.subscribe(this.name)
  }

  async publish(message, attempt=0) {
    try {
      await this.helia.libp2p.services.pubsub.publish(this.name, new TextEncoder().encode(message))
      console.log(message)
    } catch (e) {
      // TODO - the error name has changed in gossipsub 13.x, we are on 11.x - fix on upgrade
      if (e.message == "PublishError.InsufficientPeers") {
        console.log(`Publish failed to ${this.name}. Error ${e.message}. Retrying`)
        if (attempt < 5) {
          await new Promise(resolve => setTimeout(resolve, 20))
          await this.publish(message, attempt + 1)
        } else throw e
      } else {
        throw e
      }
    }
  }

  async publishViaForwarder(message) {
    if (this.forwardingChannel) {
      const packet = JSON.stringify({topic: this.name, message: JSON.parse(message)})
      this.helia.libp2p.services.pubsub.publish(this.forwardingChannel, new TextEncoder().encode(packet))
      console.log(packet)
    } else {
      await this.publish(message)
    }
  }
}