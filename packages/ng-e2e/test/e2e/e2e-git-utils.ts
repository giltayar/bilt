import {promisify} from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {exec} from 'child_process'

const execAsync = promisify(exec)

export async function gitMakeTemporaryDirectory() {
  return await fs.promises.mkdtemp(os.tmpdir() + '/')
}

export async function gitInit(gitDir: string) {
  await execAsync('git init', {cwd: gitDir})
}

export async function gitWrite(gitDir: string, filePath: string, content: string | Buffer) {
  await fs.promises.writeFile(path.join(gitDir, filePath), content)
}

export async function gitWritePackageJson(
  gitDir: string,
  filePath: string,
  name: string,
  ...dependencies: string[]
) {
  await fs.promises.mkdir(path.dirname(path.join(gitDir, filePath)), {recursive: true})
  await fs.promises.writeFile(
    path.join(gitDir, filePath),
    JSON.stringify({
      name,
      version: '1.0.0',
      dependencies: Object.fromEntries(dependencies.map(dep => [dep, '^1.0.0'])),
    }),
  )
}

export async function gitCommitAll(gitDir: string, message?: string) {
  await execAsync('git add .', {cwd: gitDir})
  await execAsync(`git commit -m "${message ?? 'message'}"`, {cwd: gitDir})
}
