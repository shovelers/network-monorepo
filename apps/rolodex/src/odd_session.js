import * as odd from "@oddjs/odd";

class OddSession {
  constructor(odd) {
    this.odd = odd
    this.program = null
  }

  async getProgram() {
    if (!this.program) {
      const appInfo = { creator: "Shovel", name: "Rolod" }
      this.program = await this.odd.program({ namespace: appInfo, debug: true })
        .catch(error => {
          switch (error) {
            case this.odd.ProgramError.InsecureContext:
              // ODD requires HTTPS
              break;
            case this.odd.ProgramError.UnsupportedBrowser:
              // Browsers must support IndexedDB
              break;
          }
        })
    }
    console.log("program: ", this.program)
    return this.program;
  }

  async getSession() {
    var p = await this.getProgram()
    if (p.session) {
      return p.session
    }
    return
  }

  async readPrivateFile(filename) {
    const session = await this.getSession();
    const fs = session.fs
    const { RootBranch } = this.odd.path
    const filePath = this.odd.path.file(RootBranch.Private, filename)
    const pathExists = await fs.exists(filePath)
    
    if (pathExists) {
      const content = new TextDecoder().decode(await fs.read(filePath))
      return JSON.parse(content)
    } 
  }

  async updatePrivateFile(filename, mutationFunction) {
    var session = await this.getSession();
  
    const fs = session.fs;
    const { RootBranch } = this.odd.path
    const filePath = this.odd.path.file(RootBranch.Private, filename)
  
    const content = new TextDecoder().decode(await fs.read(filePath))
    console.log("content in file:", content)
    const newContent = mutationFunction(JSON.parse(content))
  
    await fs.write(filePath, new TextEncoder().encode(JSON.stringify(newContent)))
    await fs.publish()
  
    const readContent = new TextDecoder().decode(await fs.read(filePath))
    console.log(filename, " :", readContent)
    return readContent;
  }
}

export const os = new OddSession(odd);