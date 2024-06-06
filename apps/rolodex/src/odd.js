import axios from 'axios';
import _ from 'lodash';
import {vCardParser} from './vcard_parser.js';
import { ContactTable } from "./contact_table";
import { MemberTable } from "./member_table";
import { programInit, Account, Person, PeopleRepository, AccountV1, MembersRepository } from 'account-fs';
import * as uint8arrays from 'uint8arrays';
import { createAppClient, viemConnector } from '@farcaster/auth-client';
import { save } from '@tauri-apps/api/dialog';
import { writeTextFile } from '@tauri-apps/api/fs';
import { SiweMessage } from 'siwe';

const farcasterClient = createAppClient({
  relay: 'https://relay.farcaster.xyz',
  ethereum: viemConnector(),
});

const NETWORK = import.meta.env.VITE_NETWORK || "DEVNET"

// TODO - remove passing of App handle, instead infer from IndexDB after join handshake from app agent
const program = await programInit(NETWORK, "rolodex")
window.shovel = program

const contactRepo = new PeopleRepository(program.agent)
const membersRepo = new MembersRepository(program.agent)
const account = new Account(program.agent)
const accountv1 = new AccountV1(program.agent, ["PEOPLE"])
shovel.accountv1 = accountv1

customElements.define('contact-table', ContactTable);
customElements.define('member-table', MemberTable);

const axios_client  = axios.create({
  baseURL: `${window.location.origin}`,
})

async function signup(username, requester) {
  requester.notification.addEventListener("challengeGenerated", (challengeEvent) => {
    console.log(challengeEvent.detail)
  })
  
  const success = await account.create(
    username,
    [{name: "contacts.json", initialData: { contactList: {} }}]
  );

  if (success == true) {
    await requester.initiate()

    const timeout = setTimeout(() => {
      clearTimeout(timeout)
      window.location.href = "/app";
    }, 5000)
  }

  return success
}

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

async function addCommunityToContacts(community){
  let communityEntry = new Person({FN: community.FN, PRODID: community.PRODID, UID: community.UID, XML: community.XML, CATEGORIES: 'community'})
  return await contactRepo.create(communityEntry)
}

async function getMembers() {
  var list = await membersRepo.list()
  console.log("all", list)
  return {memberList: list}
}

async function getCommunityMembers(community) {
  return await program.agent.fetchMemberProfilesForCommunity(community)
}

async function filterMembers(filter, profiles) {
  return await program.agent.searchMembers(filter, profiles)
}

async function contactToJoinCommunity() {
  let accountDID = await accountv1.agent.accountDID()
  let profile = await getProfile()
  let profileAccessKey = await program.agent.getAccessKeyForPrivateFile('profile.json')
  let encodedProfileAccessKey = uint8arrays.toString(profileAccessKey.toBytes(), 'base64');

  return {
    FN: profile.name,
    UID: `DCN:${accountDID}`,
    PRODID: "DCN:rolodex",
    XML: `profile.json:${profile.handle}.${encodedProfileAccessKey}`
  }
}

async function getProfile() {
  return account.getProfile()
}

async function getContacts() {
  var list = await contactRepo.list()
  console.log("all", list)
  return {contactList: list}
}

async function getContactForRelate() {
  let profile = await getProfile()
  //XML = {filename:handle.accesskey}
    //handle to fetch latest forestCID from hub using the /forestCID/:handle API & load the forest
    //access key to read the file content
  let contactsAccessKey = await program.agent.getAccessKeyForPrivateFile(contactRepo.filename)
  let encodedContactsAccessKey = uint8arrays.toString(contactsAccessKey.toBytes(), 'base64');
 
  return {
    FN: profile.name,
    UID: `DCN:${profile.handle}`,
    PRODID: "DCN:rolodex", // TODO figure how to get app handle
    XML: `${contactRepo.filename}:${profile.handle}.${encodedContactsAccessKey}`
  }
}

async function getContactByUID(uid) {
  return await contactRepo.find(uid)
}

async function filterContacts(filter) {
  return { contactList: await program.agent.search(filter) }
}


async function updateProfile(handle, name, tags = [], text = '') {
  await account.editProfile({handle: handle, name: name, tags: tags, text: text})
}

//updates given params with new values while keeping rest of the keys in Profile Object the same
async function v1UpdateProfile(params) {
  return await accountv1.repositories.profile.set(params)
}

async function addContact(name, email='', tags = [], text = "", links = []) {
  
  let person = new Person({FN: name, EMAIL: convertEmailStringToEmailArray(email), CATEGORIES: tags.join(), NOTE: text, URL: links.join(), PRODID: "DCN:rolodex", UID: crypto.randomUUID()})
  return contactRepo.create(person)
}

/*
  TODOs based on S04 -
  create a new connection file - needs requester's (accountDID, profileFile, connectionFile) and sharedContacts (Assuming all)

  Filename - connections/accountDID.json - assuming not limit to length of file name.
  {
    connection:  {
      DID: accountDID //accountDID of the receiver
      Profile: `${accessKeyToFile}` //accessKey to the received profile object
      recievedConnectionFile: `${accessKeyToFile}` //accessKey to the received connection file 
    }
    sharedContacts: [Person] //only with Public attributes
    state: "PRESENT/REMOVED"
  }

  connect handshake steps -
    requester creates connections/approverDID.json and send handshake data
      File content - { connection: { DID: approverDID, profile: "", receivedConnectionFile: "" }, sharedContacts: "ALLContacts", state: "REQUESTED" }
      Handshake Data - { DID: requesterDID, profile:, `${accessKeyToFile}`, receivedConnectionFile: `${accessKeyToFile}` }
    apporover confirms the handshake, creates connection/requesterDID.json and send something back
      File content - { connection: { DID: requesterDID, profile:, `${accessKeyToFile}`, receivedConnectionFile: `${accessKeyToFile}` }, sharedContacts: "ALLContacts", state: "CONFIRMED" }
      Handshake Data - { DID: approverDID, profile:, `${accessKeyToFile}`, receivedConnectionFile: `${accessKeyToFile}` } 
    requester reads something and update connections/approverDID.json with new data
      File content - { connection: { DID: approverDID, profile:, `${accessKeyToFile}`, receivedConnectionFile: `${accessKeyToFile}` }, sharedContacts: "ALLContacts", state: "CONFIRMED" }

*/

// TODO - handle duplicate connections
async function addConnection(person) {
  let connection = new Person({FN: person.FN, PRODID: person.PRODID, UID: person.UID, XML: person.XML})
  return contactRepo.create(connection) 
}

function convertEmailStringToEmailArray(emailString) {
  if (typeof emailString === 'string' && emailString.trim() !== '') {
    return emailString.split(',').map(email => email.trim());
  }
  return [];
}

// TODO - fix bug where contact edit clears PRODID etc.
async function editContact(id, name, email='', tags = [], text='', links = []) {
  let person = new Person({FN: name,  EMAIL:convertEmailStringToEmailArray(email), CATEGORIES: tags.join(), NOTE: text, URL: links.join(), PRODID: "DCN:rolodex", UID: id})
  return contactRepo.edit(person)
}

async function deleteContact(id) {
  return contactRepo.delete(id)
}

async function signout() {
  if(window.ethereum) {
    await window.ethereum.request({
          method: "wallet_revokePermissions",
          params: [
            {
              eth_accounts: {},
            },
          ],
        });

  }
  await account.signout()

}

async function downloadContactsDataLocally() {
  let filename = "contacts.json"
  const content = await getContacts()
  console.log("content: ", content)
  
  if (window.__TAURI__) {
    const filePath = await save({ defaultPath: filename });
    await writeTextFile(filePath, JSON.stringify(content));
  } else {
    const data = new Blob([JSON.stringify(content, null, 4)], { type: 'application/json' })
    var fileURL = window.URL.createObjectURL(data);
    var tempLink = document.createElement('a');
    tempLink.href = fileURL;
    tempLink.setAttribute('download', `${filename}`);
    tempLink.click();
    window.URL.revokeObjectURL(fileURL);
  }
}

async function generateRecoveryKit(username){
  const content = await account.recoveryKitContent()
  const filename = `rolodex-${username}-recovery-kit.yaml`
  
  if (window.__TAURI__) {
    const filePath = await save({ defaultPath: filename });
    await writeTextFile(filePath, content);
    alert('your file has been downloaded!');
  } else {
    const data = new Blob([content], { type: 'text/plain' })
    var fileURL = window.URL.createObjectURL(data);
    var tempLink = document.createElement('a');
    tempLink.href = fileURL;
    tempLink.setAttribute('download', `${filename}`);
    tempLink.click();
    window.URL.revokeObjectURL(fileURL);
    alert('your file has been downloaded!');
  } 
}

async function recover(kit) {
  var kitText = await kit.text()
  await account.recover(kitText)
  const timeout = setTimeout(() => {
    clearTimeout(timeout)
    window.location.href = "/app";
  }, 5000)
}

async function importContacts(username, password){
  //fetch creds from store if already present
  console.log("import triggered")
  var credsPresence = await appleCredsPresent()
  if (credsPresence.response) {
    var user = credsPresence.value.username
    var pass = credsPresence.value.password
  } else {
    account.editProfile({appleCreds: {username: username, password: password}});
    var user = username
    var pass = password
  }

  const response = await axios_client.get('/apple_contacts', { params: { username: user, password: pass } })
  .then(function (response) {
    return response;
  });

  //insert appleContacts to contactList
  await addAppleContactsToContactList(response.data)
  console.log("import done")
}

async function appleCredsPresent(){
  var profileData = await getProfile()
  var credsPresent =  !(_.isEmpty(profileData.appleCreds) || profileData.appleCreds.username === "")
  console.log("creds present: ", credsPresent)
  return {response: credsPresent, value: profileData.appleCreds} 
}

async function addAppleContactsToContactList(appleContacts){
  //check if the uid to appleContacts[i] is == to any of the appleContactIDs in contactList
  //if not, add it to contactList
  var contacts = await contactRepo.list()
  var existingAppleContactIDs = Object.values(contacts).filter((contact) => !contact.archived).map(contact => contact.UID)
  var contactList = []
  for (var i = 0; i < appleContacts.length; i++) {
    var appleContact = appleContacts[i]
    try {
      var parsedAppleContact = vCardParser.parse(appleContact.data)[0]
    } catch (error) {
      console.log("error for contact: ", appleContact, "error: ", error)
      continue
    }
    var name = parsedAppleContact.displayName
    var uid = parsedAppleContact.UID
    var TEL = parsedAppleContact.telephone ? parsedAppleContact.telephone[0].value : undefined
    var EMAIL = parsedAppleContact.email ? parsedAppleContact.email[0].value : undefined
    if (!existingAppleContactIDs.includes(uid)) {
      // TODO set PROPID from vcard parsing
      contactList.push(new Person({FN: name, PRODID: "APPLE", UID: uid, EMAIL: convertEmailStringToEmailArray(EMAIL), TEL: TEL}))
    }
  }
  await contactRepo.bulkCreate(contactList)
  console.log("Imported Contacts Count: ", contactList.length)
}

async function importGoogleContacts(refresh) {
  google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.email',
    callback: async (tokenResponse) => {
      const profile = await axios_client.get('https://www.googleapis.com/oauth2/v2/userinfo', {headers: { Authorization: `Bearer ${tokenResponse.access_token}`}})
      const response = await axios_client.get('https://people.googleapis.com/v1/people/me/connections',
        {params: { personFields: 'names,emailAddresses,phoneNumbers', sortOrder: 'LAST_MODIFIED_DESCENDING', pageSize: 200 }, headers: { Authorization: `Bearer ${tokenResponse.access_token}` }}
      )
      console.log("google contacts ", response.data);

      await addGoogleContactsToContactList(response.data.connections)
      console.log("import done")

      refresh()
    },
  }).requestAccessToken();
}

async function addGoogleContactsToContactList(googleContacts){
  var contacts = await contactRepo.list()
  var existingGoogleContactIDs = Object.values(contacts).filter((contact) => !contact.archived).map(contact => contact.UID)

  var contactList = []
  for (var i = 0; i < googleContacts.length; i++) {
    var googleContact = googleContacts[i]

    try {
      var name = googleContact.names[0].displayName
    } catch (error) {
      console.log("error for contact: ", googleContact, "error: ", error)
      continue
    }
    // TODO search for primary fields
    var EMAIL = googleContact.emailAddresses ? googleContact.emailAddresses[0].value : undefined
    var TEL = googleContact.phoneNumbers ? googleContact.phoneNumbers[0].canonicalForm : undefined
    var uid = googleContact.resourceName
    if (!existingGoogleContactIDs.includes(uid)) {
      contactList.push(new Person({FN: name, PRODID: "GOOGLE", UID: uid, EMAIL: convertEmailStringToEmailArray(EMAIL), TEL: TEL}))
    }
  }

  await contactRepo.bulkCreate(contactList)
  console.log("Imported Contacts Count: ", contactList.length)
}

async function portOldContacts(contacts){
  list = []
  Object.values(contacts.contactList).forEach(async (value) =>
    list.push(new Person({FN: value.name, CATEGORIES: value.tags.join(), NOTE: value.text, URL: value.links.join(), PRODID: "DCN:rolodex", UID: crypto.randomUUID()}))
  )
  await contactRepo.bulkCreate(list)
}

export { 
  account,
  farcasterClient,
  farcasterSignup,
  signup, 
  signout, 
  generateRecoveryKit, 
  recover,
  getProfile, 
  updateProfile, 
  getContacts, 
  getContactByUID,
  addContact, 
  addConnection,
  editContact, 
  deleteContact, 
  filterContacts, 
  importContacts,
  importGoogleContacts,
  appleCredsPresent,
  getContactForRelate,
  downloadContactsDataLocally,
  portOldContacts,
  createSiweMessage,
  getNonce,
  verifySiweMessage,
  ethereumSignup,
  v1UpdateProfile,
  addCommunityToContacts,
  contactToJoinCommunity,
  getMembers,
  getCommunityMembers,
  filterMembers
};
