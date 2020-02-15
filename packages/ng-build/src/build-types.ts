import {Package} from '@bilt/ng-packages'

export type BuildPackageSuccessResult = 'success' | 'failure'

export interface BuildPackageResult {
  package: Package
  buildResult: BuildPackageSuccessResult | 'not-built'
  error?: any
}
