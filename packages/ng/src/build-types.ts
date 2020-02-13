import {PackageInfo} from './package-types'

export type BuildPackageSuccessResult = 'success' | 'failure'

export interface BuildPackageResult {
  package: PackageInfo
  buildResult: BuildPackageSuccessResult | 'not-built'
}
