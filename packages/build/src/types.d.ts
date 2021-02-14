import {Package, PackageInfo, RelativeDirectoryPath} from '@bilt/types'

export type BuildPackageSuccessResult = 'success' | 'failure'

export interface BuildPackageResult {
  package: Package
  buildResult: BuildPackageSuccessResult | 'not-built'
  error?: any
}

export interface Build {
  packageToBuild: Package
  buildOrderAfter: BuildOrder
}

export type BuildOrder = Build[]

export type BuildPackageFunction = ({
  packageInfo,
}: {
  packageInfo: PackageInfo
}) => Promise<BuildPackageSuccessResult>

type BuildsAlreadyAdded = Map<RelativeDirectoryPath, Build>
