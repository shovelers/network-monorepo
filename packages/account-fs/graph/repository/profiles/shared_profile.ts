import Ajv, { JSONSchemaType } from 'ajv';
import { Profile } from './profile';

export class SharedProfileRepository {
  private agent: any;
  private filename: string;
  private schema: JSONSchemaType<Profile>;
  private validator: Ajv;

  constructor(agent: any, contactDID: string) {
    this.agent = agent;
    this.filename = `${contactDID}.json`;
  }

  async isInitialised() {
    return await this.agent.fileExists(this.filename) 
  }

  async initialise(): Promise<void> {}

  async get(): Promise<Profile> {
    const data = await this.agent.readPrivateFile(this.filename);
    return new Profile(data)
  }

  async set(profile: Partial<Profile>, schema: JSONSchemaType<Profile>): Promise<void> {
    this.schema = schema;
    this.validator = new Ajv();

    const validate = this.validator.compile(this.schema);
    if (!validate(profile)) {
      throw new Error(`Invalid profile data: ${this.validator.errorsText(validate.errors)}`);
    }

    await this.agent.updatePrivateFile(this.filename, () => profile);
  }
}