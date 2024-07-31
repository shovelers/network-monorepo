import axios from 'axios';
import _ from 'lodash';
import { programInit, AccountV1 } from 'account-fs';
import { createAppClient, viemConnector } from '@farcaster/auth-client';

const farcasterClient = createAppClient({
  relay: 'https://relay.farcaster.xyz',
  ethereum: viemConnector(),
});

const NETWORK = import.meta.env.VITE_NETWORK || "DEVNET"

const program = await programInit(NETWORK)
window.shovel = program

const account = new AccountV1(program.agent)
await account.loadRepositories()

shovel.account = account

const axios_client  = axios.create({
  baseURL: `${window.location.origin}`,
})

async function farcasterSignup(accountDID, siweMessage, siweSignature, profileData, fid) {
  await account.create(accountDID, siweMessage, siweSignature)
  await account.repositories.profile.set(profileData)
  await account.agent.appendName(fid, 'farcaster')
}

async function followFarcasterUsersBasedOnFID(signerUuid, targetFids) {
  try {
    const data = {
      signerUuid: signerUuid,
      targetFids: targetFids
    };
    const response = await axios_client.post('/farcaster-follow-users/',data);
    return response.data;
  } catch (error) {
    console.error('Error following Farcaster users:', error);
    throw error;
  }
}

async function getCommunityMembers(community) {
  return await account.search({personUID: community.UID})
}

async function getProfile(communityDID = null) {
  return account.getProfile(communityDID)
}

async function getContacts() {
  var list = await account.repositories.people.list()
  console.log("all", list)
  return {contactList: list}
}

async function getContactByUID(uid) {
  return await account.repositories.people.find(uid)
}

export { 
  account,
  farcasterClient,
  farcasterSignup,
  getProfile, 
  getContacts, 
  getContactByUID,
  getCommunityMembers,
  followFarcasterUsersBasedOnFID
};