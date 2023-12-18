import * as odd from "@oddjs/odd";
import { retrieve } from '@oddjs/odd/common/root-key';
import { sha256 } from '@oddjs/odd/components/crypto/implementation/browser'
import * as uint8arrays from 'uint8arrays';
import { publicKeyToDid } from '@oddjs/odd/did/transformers';
import axios from 'axios';
import _ from 'lodash';
import { ContactTable } from "./contact_table";
import {vCardParser} from './vcard_parser.js';
import { os } from './odd_session.js';
import { Contact, ContactRepository } from "./contacts.js";

const cr = new ContactRepository(os)

customElements.define('contact-table', ContactTable);

const axios_client  = axios.create({
  baseURL: `${window.location.origin}`,
})

let program = null
const USERNAME_STORAGE_KEY = "fullUsername"

async function getProgram() {
  if (!program) {
    const appInfo = { creator: "Shovel", name: "Rolod" }
    program = await odd.program({ namespace: appInfo, debug: true })
      .catch(error => {
        switch (error) {
          case odd.ProgramError.InsecureContext:
            // ODD requires HTTPS
            break;
          case odd.ProgramError.UnsupportedBrowser:
            // Browsers must support IndexedDB
            break;
        }
      })
  }
  console.log("program: ", program)
  return program;
}

async function getSession(program) {
  let session
  if (program.session) {
    session = program.session
  }

  return session;
}
async function fissionUsernames(username) {
  let fullUsername = await program.components.storage.getItem(USERNAME_STORAGE_KEY)
  if (!fullUsername) {
    const did = await createDID(program.components.crypto)
    fullUsername = `${username}#${did}`
    await program.components.storage.setItem(USERNAME_STORAGE_KEY, fullUsername)
  }

  var hashedUsername = await prepareUsername(fullUsername);
  return {full: fullUsername, hashed: hashedUsername} 
}

async function signup(username) {
  var program = await getProgram();
  var session = await getSession(program);
 
  var fissionusername = await fissionUsernames(username)
  var hashedUsername = fissionusername.hashed

  const valid = await program.auth.isUsernameValid(hashedUsername)
  const available = await program.auth.isUsernameAvailable(hashedUsername)
  console.log("username valid", valid)
  console.log("username available", available)

  if (valid && available) {
    // Register the user
    const { success } = await program.auth.register({ username: hashedUsername })
    console.log("success: ", success)
    // Create a session on success
    session = success ? await program.auth.session() : null
  } else if (!valid) {
    alert("username is not valid")
  } else if (!available) {
    alert("username is not available")
  }

  //create fs
  console.log("newly created session: ", session)
  const fs = session.fs
  console.log(fs)
  const profileData = JSON.stringify({ "handle": username, "name": "John Doe", tags: [], text: '' })
  const contactData = JSON.stringify({ contactList: {}, appleContacts: [], googleContacts: {} })

  const { RootBranch } = odd.path
  const profileFilePath = odd.path.file(RootBranch.Private, "profile.json")
  const contactFilePath = odd.path.file(RootBranch.Private, "contacts.json")

  await fs.write(profileFilePath, new TextEncoder().encode(profileData))
  await fs.write(contactFilePath, new TextEncoder().encode(contactData))
  await fs.publish()

  const content = new TextDecoder().decode(await fs.read(profileFilePath))
  console.log("profile data :", content)

  const timeout = setTimeout(() => {
    clearTimeout(timeout)
    window.location.href = "/app";
  }, 5000)
}

async function getProfile() {
  return os.readPrivateFile("profile.json")
}

async function getContacts() {
  return cr.list()
}

async function filterContacts(filter) {
  var contacts = await getContacts()
  var filteredContacts = { "contactList": {}, "appleContacts": []}
  for (var id in contacts.contactList) {
    var contact = contacts.contactList[id]
    if (contact.name.toLowerCase().includes(filter.toLowerCase()) || contact.tags.filter(tag => tag.toLowerCase().includes(filter.toLowerCase())).length > 0) {
      filteredContacts.contactList[id] = contact
    }
    if (contact.text && contact.text.toLowerCase().includes(filter.toLowerCase())) {
      filteredContacts.contactList[id] = contact
    }
    if (contact.links && contact.links.filter(link => link.toLowerCase().includes(filter.toLowerCase())).length > 0) {
      filteredContacts.contactList[id] = contact
    }
  }
  console.log("filtered contacts", filteredContacts)
  return filteredContacts
}

async function updateProfile(name, tags, text) {
  await updateFile("profile.json", (content) => {
    content.name = name
    content.tags = tags || []
    content.text = text || ''
    return content
  })
}

async function addContact(newContact, tags = [], text = "", links = []) {
  let contact = new Contact({name: newContact, tags: tags, text: text, links: links})
  return cr.create(contact)
}

async function editContact(id, name, tags = [], text='', links = []) {
  await updateFile("contacts.json", (content) => {
    var contactList = content.contactList
    contactList[id].name = name
    contactList[id].tags = tags
    contactList[id].text = text
    contactList[id].links = links
    return content
  })
}

async function deleteContact(id) {
  await updateFile("contacts.json", (content) => {
    content.contactList[id].archived = true
    console.log("archived contact", content.contactList[id])
    return content
  })
}

async function updateFile(file, mutationFunction) {
  var program = await getProgram();
  var session = await getSession(program);

  const fs = session.fs;
  const { RootBranch } = odd.path
  const contactFilePath = odd.path.file(RootBranch.Private, file)

  const content = new TextDecoder().decode(await fs.read(contactFilePath))
  console.log("content in file:", content)
  const newContent = mutationFunction(JSON.parse(content))

  await fs.write(contactFilePath, new TextEncoder().encode(JSON.stringify(newContent)))
  await fs.publish()

  const readContent = new TextDecoder().decode(await fs.read(contactFilePath))
  console.log("contacts :", readContent)
  return readContent;
}

async function signout() {
  var program = await getProgram();
  var session = await getSession(program);
  await session.destroy()
}

async function producerChallengeProcessor(challenge, userInput) {
  console.log("challenge pin", challenge.pin)
  console.log("userinput", userInput)

  // Either show `challenge.pin` or have the user input a PIN and see if they're equal.
  if (userInput === challenge.pin.join("")) {
    challenge.confirmPin(); alert("Correct PIN.... Wait for the other device to load account data")
  } else {
    challenge.rejectPin(); alert("Wrong PIN")
  }
}

async function downloadContactsDataLocally() {
  const content = await getContacts()
  console.log("content: ", content)
  const data = new Blob([JSON.stringify(content, null, 4)], { type: 'application/json' })
  var fileURL = window.URL.createObjectURL(data);
  var tempLink = document.createElement('a');
  tempLink.href = fileURL;
  tempLink.setAttribute('download', 'contacts.json');
  tempLink.click();
  window.URL.revokeObjectURL(fileURL);
}

async function generateRecoveryKit(username){
  var program = await getProgram();
  var fissionnames = await fissionUsernames(username)

  var accountDID = await program.accountDID(fissionnames.hashed);
  
  var crypto = program.components.crypto;
  var readKey  = await retrieve({ crypto, accountDID });
  const encodedReadKey = uint8arrays.toString(readKey, 'base64pad');
  console.log(encodedReadKey);
  const content = `
  # This is your recovery kit. (It's a yaml text file)
  # Store this somewhere safe.
  # Anyone with this file will have read access to your private files.
  # Losing it means you won't be able to recover your account
  # in case you lose access to all your linked devices.
  
  # To use this file, go to ${window.location.origin}/recover/
  
  username: ${fissionnames.full}
  key: ${encodedReadKey}
  `;
  
  const data = new Blob([content], { type: 'text/plain' })
  var fileURL = window.URL.createObjectURL(data);
  var tempLink = document.createElement('a');
  tempLink.href = fileURL;
  tempLink.setAttribute('download', `rolodex-${username}-recovery-kit.yaml`);
  tempLink.click();
  window.URL.revokeObjectURL(fileURL);
  alert('your file has been downloaded!'); 
}

async function recover(kit) {
  var kitText = await kit.text()
  var oldFullUsername = kitText.toString().split("username: ")[1].split("\n")[0]
  var oldHashedUsername = await prepareUsername(oldFullUsername)
  console.log("old username: ...", oldFullUsername)
  console.log("hashed old username: ", oldHashedUsername)
  var readKey = kitText.toString().split("key: ")[1].split("\n")[0]
  readKey = uint8arrays.fromString(readKey, 'base64pad');
  console.log("readKey: ...", readKey)
  
  var program = await getProgram();
  await program.components.storage.removeItem(USERNAME_STORAGE_KEY)
  var fissionnames = await fissionUsernames(oldFullUsername.split("#")[0])
  var newhashedUsername = fissionnames.hashed;
  
  const valid = await program.auth.isUsernameValid(`${newhashedUsername}`)
  const available = await program.auth.isUsernameAvailable(`${newhashedUsername}`)
  console.log("username available", available)
  console.log("username valid", valid)
  
  if (valid && available) {
    const success = await program.fileSystem.recover({
      newUsername: newhashedUsername,
      oldUsername: oldHashedUsername,
      readKey
    })
    
    console.log("success: ", success);
    var session = await program.auth.session()
    await waitForDataRoot(newhashedUsername)
    console.log("session: ", session)
    
    const timeout = setTimeout(() => {
      clearTimeout(timeout)
      window.location.href = "/app";
    }, 5000)
  }
}

async function prepareUsername(username){
  const normalizedUsername = username.normalize('NFD')
  const hashedUsername = await sha256(
    new TextEncoder().encode(normalizedUsername)
  )

  return uint8arrays
    .toString(hashedUsername, 'base32')
    .slice(0, 32)
}

async function waitForDataRoot(username) {
  const program = await getProgram()
  const reference = program?.components.reference
  const EMPTY_CID = "Qmc5m94Gu7z62RC8waSKkZUrCCBJPyHbkpmGzEePxy2oXJ"

  if (!reference)
    throw new Error("Program must be initialized to check for data root")

  let dataRoot = await reference.dataRoot.lookup(username)

  if (dataRoot.toString() !== EMPTY_CID) return

  return new Promise((resolve) => {
    const maxRetries = 50
    let attempt = 0

    const dataRootInterval = setInterval(async () => {
      dataRoot = await reference.dataRoot.lookup(username)

      if (dataRoot.toString() === EMPTY_CID && attempt < maxRetries) {
        attempt++
        return
      }

      clearInterval(dataRootInterval)
      resolve()
    }, 500)
  })
}

async function createDID(crypto){
  if (await program.agentDID()){
    return program.agentDID()
  } else {
    const pubKey = await crypto.keystore.publicExchangeKey()
    const ksAlg = await crypto.keystore.getAlgorithm()

    return publicKeyToDid(crypto, pubKey, ksAlg)
  }
}

async function importContacts(username, password){
  //fetch creds from store if already present
  console.log("import triggered")
  var credsPresence = await appleCredsPresent()
  if (credsPresence.response) {
    var user = credsPresence.value.username
    var pass = credsPresence.value.password
  } else {
    await updateFile("profile.json", (content) => {
      content.appleCreds = {username: username, password: password} 
      return content
    })
    var user = username
    var pass = password
  }

  const response = await axios_client.get('/apple_contacts', { params: { username: user, password: pass } })
  .then(function (response) {
    return response;
  });

  await updateFile("contacts.json", (content) => {
    content.appleContacts = response.data
    return content
  })

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
  var contacts = await getContacts()
  var existingAppleContactIDs = Object.values(contacts.contactList).map(contact => contact.appleContactID)
  var newContacts = {}
  for (var i = 0; i < appleContacts.length; i++) {
    var appleContact = appleContacts[i]
    try {
      var parsedAppleContact = vCardParser.parse(appleContact.data)[0]
    } catch (error) {
      console.log("error for contact: ", appleContact, "error: ", error)
      continue
    }
    var id = crypto.randomUUID()
    var name = parsedAppleContact.displayName
    var uid = parsedAppleContact.UID
    if (!existingAppleContactIDs.includes(uid)) {
      newContacts[id] = {name: name, appleContactID: uid, tags: []} 
    }
  }

  await updateFile("contacts.json", (content) => {
    content.contactList = {...content.contactList, ...newContacts}
    return content
  })  
}

async function importGoogleContacts(refresh) {
  google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.email',
    callback: async (tokenResponse) => {
      const profile = await axios_client.get('https://www.googleapis.com/oauth2/v2/userinfo', {headers: { Authorization: `Bearer ${tokenResponse.access_token}`}})
      const response = await axios_client.get('https://people.googleapis.com/v1/people/me/connections',
        {params: { personFields: 'names', sortOrder: 'LAST_MODIFIED_DESCENDING', pageSize: 200 }, headers: { Authorization: `Bearer ${tokenResponse.access_token}` }}
      )

      console.log("google contacts ", response.data);
      await updateFile("contacts.json", (content) => {
        if (content.googleContacts === undefined){ content.googleContacts = {}}

        content.googleContacts[profile.data.email] = response.data.connections
        return content
      })

      await addGoogleContactsToContactList(response.data.connections)
      console.log("import done")

      refresh()
    },
  }).requestAccessToken();
}

async function addGoogleContactsToContactList(googleContacts){
  var contacts = await getContacts()
  var existingGoogleContactIDs = Object.values(contacts.contactList).map(contact => contact.googleContactID)

  var newContacts = {}
  for (var i = 0; i < googleContacts.length; i++) {
    var googleContact = googleContacts[i]

    var id = crypto.randomUUID()
    try {
      var name = googleContact.names[0].displayName
    } catch (error) {
      console.log("error for contact: ", googleContact, "error: ", error)
      continue
    }
    var uid = googleContact.resourceName
    if (!existingGoogleContactIDs.includes(uid)) {
      newContacts[id] = {name: name, googleContactID: uid, tags: []} 
    }
  }

  await updateFile("contacts.json", (content) => {
    content.contactList = {...content.contactList, ...newContacts}
    return content
  })
  console.log("Imported Contacts Count: ", googleContacts.length)
  console.log("New Contacts Count: ", Object.keys(newContacts).length)
}

export { 
  getSession, 
  getProgram, 
  producerChallengeProcessor, 
  waitForDataRoot,
  signup, 
  signout, 
  generateRecoveryKit, 
  recover,
  getProfile, 
  updateProfile, 
  getContacts, 
  addContact, 
  editContact, 
  deleteContact, 
  filterContacts, 
  importContacts,
  importGoogleContacts,
  appleCredsPresent,
  downloadContactsDataLocally
};
