import Ajv, { JSONSchemaType } from 'ajv';
import { Profile } from '../profiles/profile';

const PRODIDs = {
  "APPLE": "APPLE",
  "GOOGLE": "GOOGLE",
  "DCN": "DCN"
}
/*
  "PRODID": "GOOGLE",
  "UID": contact.resourceName,

  "PRODID": "DCN",
  "UID": `DCN:${contact.handle}`, || `DCN:${contact.fullname}` 

  "PRODID": "FARCASTER",
  "UID": `FARCASTER:${contact.fid}`, || `DCN:${contact.handle}` 

  "PRODID": "APPLE",
  "UID": contact.UID,
*/

export class Person {
  PRODID: string;
  UID: string;
  FN: string;
  CATEGORIES: string;
  URL: string;
  NOTE: string;
  TEL: string[];
  EMAIL: string[];
  XML: string;
  VERSION: string;
  private cache: any;
  private parents: Person[];

  constructor(fields: PersonData) {
    this.PRODID = fields.PRODID; //required
    this.UID = fields.UID; //required
    this.FN = fields.FN; //required
    this.CATEGORIES = fields.CATEGORIES || "";
    this.URL = fields.URL || "";
    this.NOTE = fields.NOTE || "";
    this.TEL = fields.TEL || [];
    this.EMAIL = fields.EMAIL || [];
    this.XML = fields.XML || "";
     // TODO: Define how to use XML for profile
    this.VERSION = "4.0";
    this.cache = {}
    this.parents = fields.parents || []
  }

  asJSON() {
    return {
      PRODID: this.PRODID,
      UID: this.UID,
      TEL: this.TEL,
      EMAIL: this.EMAIL,
      FN: this.FN,
      CATEGORIES: this.CATEGORIES,
      URL: this.URL,
      NOTE: this.NOTE,
      XML: this.XML,
    };
  }

  getParents() {
    return this.parents
  }

  mergeParents(otherPerson: Person): void {
    this.parents = [...new Set([...this.parents, ...otherPerson.parents])];
  }

  accountDID(){
    return this.UID.split(':').splice(1).join(':')
  }

  sharedFiles(){
    if (this.XML) {
      return Object.fromEntries(this.XML.split('|').map(pair => {
        const lastColonIndex = pair.lastIndexOf(':');
        if (lastColonIndex === -1) {
          // If there's no colon, return the whole pair as key with empty value
          return [pair, ''];
        }
        const filename = pair.slice(0, lastColonIndex);
        const value = pair.slice(lastColonIndex + 1).split('.').pop();
        return [filename, value]
      }))
    } else { return {} }
  }

  isCommunity(): boolean{
    return this.sharedFiles().hasOwnProperty('members.json')
  }

  async validateProfileForCommunity(agent: any, schema: JSONSchemaType<any>, head: string): Promise<boolean>{
    const validator = new Ajv();
    const validate = validator.compile(schema);

    const communityDID = await agent.accountDID()

    if (this.sharedFiles().hasOwnProperty(`${communityDID}.json`)) {
      const profile = await agent.readPrivateFileByPointer(head, this.sharedFiles()[`${communityDID}.json`], 'base64url')
      const valid = validate(profile)
      if (!valid) { console.log(validate.errors) }
      return valid
    }

    return false
  }

  async getMembers(agent): Promise<Person[]> {
    if (this.isCommunity() != true ) { return [] }
    if (this.cache.people) { return this.cache.people.filter(p => p.readFetchedProfile() instanceof Profile) }

    const data = await agent.readSharedFile(this.accountDID(), this.sharedFiles()['members.json'], 'base64url')
    console.log("members.json", data)

    this.cache.people = Object.entries(data.memberList).map(([key, value]) => {
      const v = value as PersonData
      return new Person({PRODID: v.PRODID, UID: v.UID, FN: v.FN, XML: v.XML, parents: [this]})
    })

    let results = await this.fetchProfilesWithPool(this.cache.people, agent);
    results = results.flat().filter(i => i)
    console.log(`fetching ${this.cache.people.length} members, got ${results.length}`, this)

    return this.cache.people.filter(p => p.readFetchedProfile() instanceof Profile)
  }

  async fetchProfilesWithPool(people: Person[], agent: any, poolSize: number = 10): Promise<any[]> {
    const results: any[] = [];
    let index = 0;
    const communityDID = this.accountDID()

    async function fetchProfile(person: Person): Promise<any> {
      if (index >= people.length) return null;

      const p = people[index++];
      const result = await Promise.race([
        p.getProfile(agent, communityDID),
        new Promise((resolve) => setTimeout(() => resolve(undefined), 10000))
      ]);

      results.push(result);
      return fetchProfile(person);
    }

    const pool = new Array(poolSize).fill(null).map(() => fetchProfile(people[index]));
    await Promise.all(pool);

    return results;
  }

  readFetchedProfile() { return (this.cache.profile || {}) }

  async getProfile(agent, communityDID): Promise<Profile | undefined> {
    if (this.cache.profile) { return this.cache.profile }

    if (this.sharedFiles().hasOwnProperty(`${communityDID}.json`) == true ) {
      this.cache.profile = await agent.readSharedFile(this.accountDID(), this.sharedFiles()[`${communityDID}.json`], 'base64url')
      if (Object.keys(this.cache.profile).length == 0) {
        console.log("unable to getProfile - ", communityDID, this)
        this.cache.profile = {}
        return
      }

      this.cache.profile = new Profile(this.cache.profile)
      return this.cache.profile
    }

    if (this.sharedFiles().hasOwnProperty('profile.json') != true ) {
      console.log("skip getProfile - no profile.json", this)
      this.cache.profile = {}
      return
    }

    this.cache.profile = await agent.readSharedFile(this.accountDID(), this.sharedFiles()['profile.json'], 'base64')
    if (Object.keys(this.cache.profile).length == 0) {
      console.log("unable to getProfile", this)
      this.cache.profile = {}
      return
    }

    this.cache.profile = Profile.createFromOldProfileJson(this.cache.profile)
    return this.cache.profile
  }
}

export interface PersonData {
  PRODID: string;
  UID: string;
  FN: string;
  CATEGORIES?: string;
  URL?: string;
  NOTE?: string;
  TEL?: string[];
  EMAIL?: string[];
  XML?: string;
  parents?: Person[]
}