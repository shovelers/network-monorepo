import { createBrowserNode, dial } from './helia_node.js';
import { PrivateFile } from './private_file.js';

async function fs() {
  const node = await createBrowserNode();
  const fs = new PrivateFile(node);
  return fs;
}

export { fs }

// const fileExists = await fs.exists(filePath)

// await fs.write(filePath, new TextEncoder().encode(JSON.stringify(newContent)));

// await fs.publish();

// await fs.read(filePath)