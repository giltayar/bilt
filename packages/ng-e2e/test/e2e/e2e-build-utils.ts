import path from 'path'
import fs from 'fs'
import {PackageInfo, Directory} from '@bilt/ng-packages'
import {BuildPackageFunction} from '@bilt/ng-build'

export function logFilesDuringBuild(
  rootDirectory: Directory,
  logLines: {[x: string]: string},
): BuildPackageFunction {
  return async function({packageInfo}: {packageInfo: PackageInfo}) {
    const directory = path.join(rootDirectory as string, packageInfo.directory as string)

    const files = await fs.promises.readdir(directory)

    for (const file of files) {
      if (file === 'package.json') continue
      logLines[path.join(packageInfo.directory as string, file)] = await fs.promises.readFile(
        path.join(directory, file),
        'utf-8',
      )
    }

    return 'success'
  }
}
