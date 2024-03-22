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