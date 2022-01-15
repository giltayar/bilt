import {promises} from 'fs'
import {join} from 'path'
import {npmNextVersion} from '@bilt/npm-next-version'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)

/**
 *
 * @param {string} packageDirectory
 * @returns {Promise<string>}
 */
async function nextVersion(packageDirectory) {
  const packageJson = JSON.parse(
    await promises.readFile(join(packageDirectory, 'package.json'), 'utf8'),
  )

  const nextVersion = await npmNextVersion({...packageJson, packageDirectory})

  return nextVersion
}

export default {
  npm: {
    nextVersion,
    checkUpdatesPath: require.resolve('npm-check-updates'),
  },
}
