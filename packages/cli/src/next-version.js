import {promises} from 'fs'
import {join} from 'path'
import {npmNextVersion} from '@bilt/npm-next-version'

/**
 *
 * @param {{packageDir: string}} options
 */
async function nextVersion({packageDir}) {
  const packageJson = JSON.parse(await promises.readFile(join(packageDir, 'package.json'), 'utf8'))

  const nextVersion = await npmNextVersion({...packageJson, packageDirectory: packageDir})

  return nextVersion
}

export default nextVersion
