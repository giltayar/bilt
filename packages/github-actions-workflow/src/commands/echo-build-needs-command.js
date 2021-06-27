import {readStream} from './read-stream.js'
import {normalizeToGithubActionsId} from './normalize-to-github-actions-id.js'

export async function echoBuildNeedCommands() {
  const biltPackageInfosOutput = JSON.parse((await readStream(process.stdin)).toString('utf-8'))

  for (const pkg of biltPackageInfosOutput.packages) {
    const normalizedPackageName = normalizeToGithubActionsId(pkg.name)

    console.log(`::set-output name=needs-build-${normalizedPackageName}::true`)
  }
}
