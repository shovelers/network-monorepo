# Network

DCN (Decentralised Contact Network) is a peer-to-peer network, on which each participant gets a ‘Personal Information Store’ through which their ‘agents’ can exchange contact information via handshakes such as ‘join, ‘follow’, etc. DCN provides seamless people search to the participants across the network and also provides a low-code stack to developers for building user-centric social utility apps. 

## Architecture

The fundamental unit of DCN is **Account**, whose actions are executed through their **Agents**. Each device of an Account is represented on the network as an Agent.
- These agents manage the “**account-fs**” of the **account** across devices and apps. It is designed to store personal information such as 
    > **Profile, Contacts, Groups, Graphs, Calendar, Credentials and Notes**
- **Handshakes** are protocols for exchanging personal information amongst agents. Social interactions such as ‘**join** a community’, ‘**connect** with a member’, ‘**invite** a friend’ etc. are modelled as **Handshakes**, through which agents exchange personal information over an encrypted messaging layer.
- **People Search API** is a special-purpose search engine for agents to query contacts & graphs stored in account-fs and in turn enable search, similarity, and recommendations.

![Layers](./docs/public/layers.png)

## MonoRepo overview

.
├── apps                    # Sample Applications built on the network
│   ├── rolodex/            # Implenetation of a [CRM app](https://rolodex.shovel.company/) running live on testnet
│   └── ...
├── docs                    # Source repo for [hosted Documentation](https://network.shovel.company/)
├── hub                     # Source repo for Decentralised Hub of the network
├── packages                # Packages to be used in building Hub and Apps
├── scripts                 # Scripts for admin activities
└── README.md

.
├── ...
├── packages/account-fs     # Core package to be used by every participant of the network
│   ├── agent               # Implentation of Agent of the network
│   │   ├── fs/             # Implenetation of Account-fs storage (layer 1 from diagram)
│   │   ├── handshakes/     # Implenetation of Handshake (layer 2 from diagram)
│   │   └── ...
│   ├── people/             # Implenetation of People Search API (layer 3 from diagram)
│   ├── app.js              # Bootstrapping agent on an App server hosted in cloud
│   ├── browser.js          # Bootstrapping an Account's Agent embedded in the browser
│   ├── hub.js              # Boostrapping network and storage for the Hub
│   └── ...                 # etc.
└── ...

## Start Building

* Read our [Whitepaper](https://shovelco.notion.site/Decentralised-Contact-Network-Summary-v0-4-6d8885c11cc9415d90f21a16fd007b93?pvs=4)
* Come join us on our [Discord](https://discord.gg/PmzsJeembE)