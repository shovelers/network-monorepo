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
    const privateFilePath = this.odd.path.file(RootBranch.Private, filename)
    const pathExists = await fs.exists(privateFilePath)
    
    if (pathExists) {
      const content = new TextDecoder().decode(await fs.read(privateFilePath))
      return JSON.parse(content)
    } 
  }
}

export const os = new OddSession(odd);