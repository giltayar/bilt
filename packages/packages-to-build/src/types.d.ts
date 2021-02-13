import {PackageInfo} from '@bilt/types'

export interface PackageInfoWithBuildTime extends PackageInfo {
  lastBuildTime: number | undefined // undefined means that it is dirty
}

export interface PackageInfosWithBuildTime {
  [packageDirectory: string]: PackageInfoWithBuildTime
}
