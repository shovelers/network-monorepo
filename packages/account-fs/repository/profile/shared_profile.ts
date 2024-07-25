import * as uint8arrays from 'uint8arrays';
import Ajv, { JSONSchemaType } from 'ajv';

// Define an interface for the profile
interface Profile {
  name?: string;
  handle?: string;
  [key: string]: any; // Allow for additional properties
}

export class SharedProfileRepository {
  private agent: any;
  private filename: string;
  private schema: JSONSchemaType<Profile>;
  private validator: Ajv;

  constructor(agent: any, schema: JSONSchemaType<Profile>, contactDID: string) {
    this.agent = agent;
    this.filename = `${contactDID}.json`;
    this.schema = schema;
    this.validator = new Ajv();
  }

  async initialise(): Promise<void> {
    const exists = await this.agent.fileExists(this.filename);
    if (!exists) {
      await this.agent.updatePrivateFile(this.filename, () => ({}));
    }
  }

  async get(): Promise<Profile> {
    return await this.agent.readPrivateFile(this.filename);
  }

  async set(params: Partial<Profile>): Promise<void> {
    const profile = {} //await this.get();
    const updatedProfile = { ...profile, ...params };

    // Validate the updated profile against the schema
    const validate = this.validator.compile(this.schema);
    if (!validate(updatedProfile)) {
      throw new Error(`Invalid profile data: ${this.validator.errorsText(validate.errors)}`);
    }

    console.log("updated profilev2 after validation :", updatedProfile)
    //await this.agent.updatePrivateFile(this.filename, () => updatedProfile);
  }

  async contactForHandshake(): Promise<{
    FN: string;
    UID: string;
    PRODID: string;
    XML: string;
  }> {
    const accountDID = await this.agent.accountDID();
    const profile = await this.get();
    const profileAccessKey = await this.agent.getAccessKeyForPrivateFile(this.filename);
    const encodedProfileAccessKey = uint8arrays.toString(profileAccessKey.toBytes(), 'base64');

    return {
      FN: profile.name || '',
      UID: `DCN:${accountDID}`,
      PRODID: "DCN:rolodex",
      XML: `profile.json:${profile.handle}.${encodedProfileAccessKey}`
    };
  }
}