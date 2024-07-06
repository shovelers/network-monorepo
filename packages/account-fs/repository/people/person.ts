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

  accountDID(){
    return this.UID.split(':').splice(1).join(':')
  }

  sharedFiles(){
    return Object.fromEntries(this.XML.split('|').map(pair => {
      const [key, value] = pair.split(':');
      return [key, value.split('.')[1] || ''];
    }))
  }

  isCommunity(): boolean{
    return this.sharedFiles().hasOwnProperty('members.json')
  }

  async getMembers(agent){
    if (this.isCommunity() != true ) { return [] }
    const data = await agent.readSharedFile(this.accountDID(), this.sharedFiles()['members.json'])
    console.log("members.json", data)

    let profilePromises = Object.entries(data.memberList).map(async ([key, value]) => {
      const v = value as PersonData
      const p = new Person({PRODID: v.PRODID, UID: v.UID, FN: v.FN, XML: v.XML})
      return await Promise.race([
        p.getProfile(agent),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), 10000);
        })
      ])
    });

    let profileResults = await Promise.all(profilePromises);
    let fetchedProfiles = profileResults.flat();
    return fetchedProfiles
  }

  async getProfile(agent) {
    if (this.sharedFiles().hasOwnProperty('profile.json') != true ) { return {} } 
    if (this.cache.profile) { return this.cache.profile }

    this.cache.profile = await agent.readSharedFile(this.accountDID(), this.sharedFiles()['profile.json'])
    console.log("profile.json", this.cache.profile)
    return this.cache.profile
  }
}

interface PersonData {
  PRODID: string;
  UID: string;
  FN: string;
  CATEGORIES?: string;
  URL?: string;
  NOTE?: string;
  TEL?: string[];
  EMAIL?: string[];
  XML?: string;
}