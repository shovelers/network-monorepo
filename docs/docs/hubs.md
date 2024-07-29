---
sidebar_position: 6
---

# Hubs
Creole Network is formed via a network of Hubs. It performs three functions:

1. Storage and Sync Layer for encrypted blocks in account-fs
2. Account & Identity Management Service for users of account-fs
3. WebSocket & WebRTC based Networking Infrastructure for `Hub<>Acoount`, `Account<>Account` & `Hub<>Hub` communication

## Components & Responsibilities

### Storage Service
    - Blockstore to Pin and Serve CIDs for any account
    - Filesystem state tracking via the head cid for an account
    - Enforces write-privileges on the filesystem for an account
### Account Service
    - Account Registration and management
### Network Service
    - Bootstrap API for `agent<>Hub` & `Hub<>Hub` peering
    - WebSocket layer for handshakes
### Naming Service
    - `did<>handle` registry, to provide names to Creole registered accountDIDs
### Custody Service
    - Currently Hubs also a custodial service to help ease the Key Management & transport for the Encryption Keys. The goal of this service is to help manage the rollout.

    When we move to a fully permissionless & non-custodial version of the network, this service is expected to go away.
### Connect Inbox
    
    Other agents drop Handshake messages into User’s Inbox, which can be processed asynchronously by any of the User’s agent when they come live.
    
    The agent reads the message and processes & manages the state of the respective Handshake