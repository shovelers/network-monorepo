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
  PRODID;
  UID;
  FN;
  CATEGORIES;
  URL;
  NOTE;
  TEL;
  EMAIL;
  // TODO: Define how to use XML for profile
  // XML;

  constructor(fields) {
    this.PRODID = fields.PRODID  //required
    this.UID = fields.UID        //required
    this.FN = fields.FN          //required
    this.CATEGORIES = fields.CATEGORIES || ""
    this.URL = fields.URL || ""
    this.NOTE = fields.NOTE || ""
    this.TEL = fields.TEL
    this.EMAIL = fields.EMAIL
    this.VERSION = "4.0"
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
    }
  }
}