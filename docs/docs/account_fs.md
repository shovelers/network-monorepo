---
sidebar_position: 5
---

# Accounts
A user is represented on the network as an account. An account is uniquely identified by a Decentralised Identifier(DID). 

The account is user-controlled via holding of the Private Keys with which they can generate a SIWE message for authn/authz.

Each account gets an account-fs to store data privately. The reads and writes to the fs is managed by this account.

Account is registered on the Hub of the network. Hub provides a custody service to store and transfer encryption keys to each signed-in session of an account.

Hub tracks the current known state of the filesystem as it’s head (CID). Any valid agent can perform writes on behalf of an account and move the head forward. A valid agent requires  SIWE message for the agentDID from the account DID to be submitted to Hub

### Registering an account on the network using Farcaster via Rolodex

In Rolodex, Farcaster is used as a user-controlled identity provider. Each Farcaster account is controlled via a user’s Ethereum key(custody address). 

`Sign-in with Farcaster` is used to generate SIWE messages required by the account registration API on the Hub. This connects the custody address to an instance of account-fs. This fs is retrieved deterministically on signin-in with the same Farcaster account across apps, ensuring the portability of data.