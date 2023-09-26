import * as odd from "@oddjs/odd";
import { retrieve } from '@oddjs/odd/common/root-key';
import { sha256 } from '@oddjs/odd/components/crypto/implementation/browser'
import * as uint8arrays from 'uint8arrays';
import { publicKeyToDid } from '@oddjs/odd/did/transformers';

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
  
  var hashedUsername = await fissionUsernames(username).hashed 
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
  }

  //create fs
  console.log("newly created session: ", session)
  const fs = session.fs
  console.log(fs)
  const profileData = JSON.stringify({ "handle": username, "name": "John Doe" })
  const contactData = JSON.stringify({ contactList: {} })

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
  var program = await getProgram();
  var session = await getSession(program);

  const fs = session.fs;
  const { RootBranch } = odd.path
  const privateFilePath = odd.path.file(RootBranch.Private, "profile.json")
  const pathExists = await fs.exists(privateFilePath)

  if (pathExists) {
    const content = new TextDecoder().decode(await fs.read(privateFilePath))
    return JSON.parse(content)
  }
}

async function getContacts() {
  var program = await getProgram();
  var session = await getSession(program);
  const fs = session.fs;
  const { RootBranch } = odd.path
  const privateFilePath = odd.path.file(RootBranch.Private, "contacts.json")
  const pathExists = await fs.exists(privateFilePath)
  
  if (pathExists) {
    const content = new TextDecoder().decode(await fs.read(privateFilePath))
    return JSON.parse(content)
  }
}

async function filterContacts(filter) {
  var contacts = await getContacts()
  var filteredContacts = { "contactList": {} }
  for (var id in contacts.contactList) {
    var contact = contacts.contactList[id]
    if (contact.toLowerCase().includes(filter.toLowerCase())) {
      filteredContacts.contactList[id] = contact
    }
  }
  console.log("filtered contacts", filteredContacts)
  return filteredContacts
}

async function updateProfile(name) {
  await updateFile("profile.json", (content) => {
    content.name = name
    return content
  })
}
async function addContact(newContact) {
  await updateFile("contacts.json", (content) => {
    var id = crypto.randomUUID()
    content.contactList[id] = newContact
    return content
  })
}

async function editContact(id, contact) {
  await updateFile("contacts.json", (content) => {
    var contactList = content.contactList
    contactList[id] = contact
    return content
  })
}

async function deleteContact(id) {
  await updateFile("contacts.json", (content) => {
    delete content.contactList[id]
    console.log("delete", id)
    console.log("delete", content.contactList)
    return content
  })
}

function renderTable(contacts) {
  let table = document.createElement('table');
  table.classList.add("table")
  var tbody = table.createTBody();
  for (let [key, value] of Object.entries(contacts.contactList)) {
    let row = tbody.insertRow();
    let cell = row.insertCell(0);
    cell.textContent = value;
    let editcell = row.insertCell(1);
    editcell.style.cssText = 'text-align: right';
    editcell.innerHTML = `
      <button class="btn btn-ghost btn-xs" onclick="contact_edit_modal.showModal(); setContactEditForm('${key}', '${value}');">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="currentColor" d="m13.498.795l.149-.149a1.207 1.207 0 1 1 1.707 1.708l-.149.148a1.5 1.5 0 0 1-.059 2.059L4.854 14.854a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l9.642-9.642a.5.5 0 0 0-.642.056L6.854 4.854a.5.5 0 1 1-.708-.708L9.44.854A1.5 1.5 0 0 1 11.5.796a1.5 1.5 0 0 1 1.998-.001zm-.644.766a.5.5 0 0 0-.707 0L1.95 11.756l-.764 3.057l3.057-.764L14.44 3.854a.5.5 0 0 0 0-.708l-1.585-1.585z"/></svg>
      </button>`
  }
  return tbody;
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
  console.log("i am here")
  console.log("challenge pin", challenge.pin)
  console.log("userinput", userInput)

  // Either show `challenge.pin` or have the user input a PIN and see if they're equal.
  if (userInput === challenge.pin.join("")) {
    challenge.confirmPin(); alert("success")
  } else {
    challenge.rejectPin(); alert("wrong pin")
  }
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
  alert('your file has downloaded!'); 
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

export { 
  signup, 
  getProfile, 
  updateProfile, 
  getContacts, 
  addContact, 
  editContact, 
  deleteContact, 
  signout, 
  getSession, 
  getProgram, 
  producerChallengeProcessor, 
  filterContacts, 
  renderTable, 
  generateRecoveryKit, 
  recover,
  waitForDataRoot
};
