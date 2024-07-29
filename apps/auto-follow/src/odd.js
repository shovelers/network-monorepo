import axios from 'axios';
import _ from 'lodash';
import { programInit, Person, AccountV1 } from 'account-fs';
import { createAppClient, viemConnector } from '@farcaster/auth-client';
import { SiweMessage } from 'siwe';


const farcasterClient = createAppClient({
  relay: 'https://relay.farcaster.xyz',
  ethereum: viemConnector(),
});

const NETWORK = import.meta.env.VITE_NETWORK || "DEVNET"

// TODO - remove passing of App handle, instead infer from IndexDB after join handshake from app agent
const program = await programInit(NETWORK, "auto-follow")
window.shovel = program

const account = new AccountV1(program.agent)
await account.loadRepositories()
const contactRepo = account.repositories.people 
const accountv1 = account
shovel.account = account



const axios_client  = axios.create({
  baseURL: `${window.location.origin}`,
})

async function farcasterSignup(accountDID, siweMessage, siweSignature, profileData, fid) {
  await accountv1.create(accountDID, siweMessage, siweSignature)
  await accountv1.repositories.profile.set(profileData)
  await accountv1.agent.appendName(fid, 'farcaster')
}

async function ethereumSignup(accountDID,siweMessage, siweSignature, profileData,fid) {
  await accountv1.create(accountDID, siweMessage, siweSignature)
  await accountv1.repositories.profile.set(profileData)
  await accountv1.agent.appendName(fid, 'ethereum')
}

async function getFollowingOfAParticularUser(userFid) {
  try {
    const response = await axios_client.get(`/farcaster-following/${userFid}`);
     return response.data;
  } catch (error) {
    console.error('Error fetching followers:', error);
    throw error;
  }
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




async function getNonce() {
  try {
    const response = await axios_client.get('/nonce');
    return response.data;  
  } catch (error) {
    console.error('Error fetching nonce:', error);
    throw error;  
  }
}

async function createSiweMessage(address, nonce, requestId, chainId) {
  const message = new SiweMessage({
      domain: window.location.host,
      address: address,
      statement : 'Sign in via ethereum',
      uri: window.location.origin,
      version: '1',
      chainId: chainId,
      nonce: nonce,
      requestId: requestId
  });
  return message.prepareMessage();
}

async function verifySiweMessage(message,signature,nonce) {
  let SiweObject = new SiweMessage(message)
  try {
    var publicKey, result = await SiweObject.verify({signature: signature, nonce: nonce});
    return result.success;
  }
  catch(e) {
    console.error("SIWE Message verfication failed", e);
  }
}

async function getMembers() {
  if (account.repositories.members) {
    var list = await account.repositories.members.list()
    console.log("all", list)
    return {memberList: list}
  }
  return {memberList: undefined}
}

async function getCommunityMembers(community) {
  return await account.search({personUID: community.UID})
}


async function getProfile(communityDID = null) {
  return account.getProfile(communityDID)
}

async function getContacts() {
  var list = await contactRepo.list()
  console.log("all", list)
  return {contactList: list}
}

async function getContactByUID(uid) {
  return await contactRepo.find(uid)
}


async function getFidFromAccountDID() {
  
  let namesData = await accountv1.agent.getName();
  if (namesData && namesData.names) {
    let namesString = namesData.names;
    let namesArray = namesString.includes(',') ? namesString.split(',') : [namesString];
    for (let name of namesArray) {
      let [fid, platform] = name.split('@');
      if (platform === 'farcaster') {
        return fid; // Return the FID if it's a Farcaster name
      }
    }
  }
  return '';
}

export { 
  account,
  farcasterClient,
  farcasterSignup,
  getProfile, 
  getContacts, 
  getContactByUID,
  createSiweMessage,
  getNonce,
  verifySiweMessage,
  ethereumSignup,
  getMembers,
  getCommunityMembers,
  getFidFromAccountDID,
  getFollowingOfAParticularUser,
  followFarcasterUsersBasedOnFID
  
};
