import _ from 'lodash';
import { Membership, Directory, DirectoryPOJO, DirectoryReposistory } from "./directory.js";
import { Account , os  } from 'account-session';
import { createBrowserNode, AccountFS, PrivateFile } from 'account-fs'
import { DirectoryTable } from './directory_table.js';
import * as uint8arrays from 'uint8arrays';

customElements.define('directory-table', DirectoryTable);

const SHOVEL_FS_SYNC_HOST = import.meta.env.VITE_SHOVEL_FS_SYNC_HOST || "http://localhost:3000"
const NETWORK = import.meta.env.VITE_NETWORK || "DEVNET"

const helia = await createBrowserNode()

let program = await os.getProgram()
const accountfs = new AccountFS(helia, program.components.storage, NETWORK, SHOVEL_FS_SYNC_HOST)
await accountfs.load()

window.shovel = {
  helia: helia,
  fs: accountfs,
  odd: program
}

const account = new Account(os, accountfs)
const directory = new Directory(accountfs, "test")
const directoryRepo =  new DirectoryReposistory(accountfs)

async function validSession() {
  let session = await os.getSession()
  return (session !== undefined)
}

async function signup(username) {
  await account.create(username, [
      {name: "directories.json", initialData: { directoryList: {} }}
    ]
  );

  const timeout = setTimeout(() => {
    clearTimeout(timeout)
    window.location.href = "/app";
  }, 5000)
}

async function updateProfile(handle, name, tags = [], text = '') {
  account.editProfile({handle: handle, name: name, tags: tags, text: text})
}

async function createDirectory(name) {
  return await directoryRepo.create(new DirectoryPOJO({name: name}))
}

async function getDirectories() {
  return await directoryRepo.list()
}

async function getDirectory(cid, key) {
  const decodedAccessKey = uint8arrays.fromString(key, 'base64url');
  const decodedForestCID = uint8arrays.fromString(cid, 'base64url')

  const directory = new PrivateFile(helia)
  const content = await directory.read(decodedAccessKey, decodedForestCID)
  
  return {content: content}
}

async function addMembership() {
  //get self profileCid and access key
  let membership = new Membership()
  return await directory.create(membership)
}

async function getMemberships() {
  return await directory.list()
}

async function shareDirectory() {
  return directory.share()
}

async function signout() {
  await account.signout()
}

async function generateRecoveryKit(username){
  const content = await account.recoveryKitContent()
  
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
  await account.recover(kitText)
  const timeout = setTimeout(() => {
    clearTimeout(timeout)
    window.location.href = "/app";
  }, 5000)
}

export { 
  account,
  directoryRepo,
  validSession,
  signup, 
  signout, 
  generateRecoveryKit, 
  recover,
  updateProfile,
  createDirectory, 
  getDirectory,
  getDirectories,
  addMembership,
  getMemberships,
  shareDirectory 
};
