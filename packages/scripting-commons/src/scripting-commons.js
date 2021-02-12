import {promisify} from 'util'
import {promises as fs} from 'fs'
import {tmpdir} from 'os'
import {join, dirname} from 'path'
import {once} from 'events'
import {spawn, exec} from 'child_process'

/**
 * @param {string} command
 * @param {{
 * cwd: string
 * env?: Record<string, string>
 * }} params
 */
export async function sh(command, {cwd, env}) {
  const childProcess = spawn(command, {cwd, stdio: 'inherit', shell: true, env})
  const [result] = await Promise.race([once(childProcess, 'error'), once(childProcess, 'exit')])
  if (typeof result === 'number') {
    if (result !== 0) {
      const error = new Error(`Command failed: ${command} ${result === 127 ? '(not found)' : ''}\n`)
      //@ts-ignore
      error.code = result

      throw error
    } else {
      return
    }
  } else {
    throw result
  }
}

/**
 * @param {string} command
 * @param {{
 * cwd: string
 * env?: Record<string, string>
 * }} params
 */
export async function shWithOutput(command, {cwd, env}) {
  const {stdout} = await promisify(exec)(command, {cwd, env})

  return stdout
}

/**
 * @param {string | string[]} file
 * @param {Buffer|string|object} content
 * @param {{cwd: string}} options
 * @returns {Promise<void>}
 */
export async function writeFile(file, content, {cwd}) {
  if (Array.isArray(file)) {
    file = file.reduce((fileUpTillNow, segment) => join(fileUpTillNow, segment))
  }
  file = join(cwd, file)

  await fs.mkdir(dirname(file), {recursive: true})
  await fs.writeFile(file, typeof content === 'object' ? JSON.stringify(content) : content)
}

/**
 * @param {string | string[]} file
 * @param {{cwd: string}} options
 * @returns {Promise<string>}
 */
export async function readFileAsString(file, {cwd}) {
  if (Array.isArray(file)) {
    file = file.reduce((fileUpTillNow, segment) => join(fileUpTillNow, segment))
  }
  file = join(cwd, file)

  return await fs.readFile(file, 'utf-8')
}

/**
 * @param {string | string[]} file
 * @param {{cwd: string}} options
 * @returns {Promise<object>}
 */
export async function readFileAsJson(file, {cwd}) {
  if (Array.isArray(file)) {
    file = file.reduce((fileUpTillNow, segment) => join(fileUpTillNow, segment))
  }
  return JSON.parse(await fs.readFile(join(cwd, file), 'utf-8'))
}

/**
 * @returns {Promise<string>}
 */
export async function makeTemporaryDirectory() {
  return await fs.mkdtemp(tmpdir() + '/')
}
