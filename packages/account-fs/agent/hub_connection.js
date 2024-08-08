import { dial } from './helia_node.js'

export class HubConnection {
  constructor(helia, axios_client, prefix) {
    this.peerId = null;
    this.axios_client = axios_client
    this.helia = helia
    this.prefix = prefix
  }

  updateEventListeners(newPeerId) {
    if (this.peerId) {
      this.removeEventListeners();
    }

    this.peerId = newPeerId;

    console.log("setting event listeners")
    this.connectListener = (e) => {
      if (this.peerId === e.detail.string) {
        console.log(`Connection established with Hub: ${this.peerId}.`);
      }
    };

    this.disconnectListener = (e) => {
      if (this.peerId === e.detail.string) {
        console.log(`Connection broken with Hub: ${this.peerId}. Redialing`);
        setTimeout(() => {
          this.bootstrap();
        }, 100);
      }
    };

    this.helia.libp2p.addEventListener('peer:connect', this.connectListener);
    this.helia.libp2p.addEventListener('peer:disconnect', this.disconnectListener);
  }

  removeEventListeners() {
    if (this.connectListener) {
      this.helia.libp2p.removeEventListener('peer:connect', this.connectListener);
    }

    if (this.disconnectListener) {
      this.helia.libp2p.removeEventListener('peer:disconnect', this.disconnectListener);
    }
  }

  async bootstrap() {
    await this.axios_client.get('/bootstrap').then(async (response) => {
      const newPeerId = response.data.peerId

      if (newPeerId !== this.peerId) {
        this.updateEventListeners(newPeerId);
      }

      const connection = await dial(this.helia, this.prefix + this.peerId)
      console.log("connection status with hub: ", response.data.peerId, connection.status)
    }).catch((e) => {
      console.log("/bootsrap API call failed, retrying in 10 seconds.", e.name)
      setTimeout(() => {
        this.bootstrap()
      }, 10000)
      return e
    })
  }
}