import { WnfsBlockstore } from './helia_wnfs_blockstore_adaptor.js'
import { PublicDirectory } from "wnfs";

export class PublicFileExample {
  constructor(node) {
    this.store = new WnfsBlockstore(node)
    this.path = ["pictures", "cats"]
    this.name = "tabby.txt"

    this.file = this.path.concat(this.name)
  }

  async initalise() {
    const dir = new PublicDirectory(new Date());
    var { rootDir } = await dir.mkdir(this.path, new Date(), this.store);

    this.rootDir = rootDir
    const rootCID = await this.rootDir.store(this.store)
  }

  async write(content) {
    if (this.rootDir == null) {
      await this.initalise()
    }

    var { rootDir } = await this.rootDir.write(
      this.file,
      new TextEncoder().encode(content),
      new Date(),
      this.store
    );
    console.log("root after write", rootDir)

    this.rootDir = rootDir
    await this.rootDir.store(this.store)
  }

  async read() {
    var content = await this.rootDir.read(this.file, this.store)
    console.log("Files Content:", content);

    return new TextDecoder().decode(content)
  }
}