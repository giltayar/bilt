import {PackageInfo} from '@bilt/types'

export interface PackageInfoWithBuildTimes extends PackageInfo {
  lastBuildTime: number | undefined // undefined means that it is dirty
}

export interface PackageInfosWithBuildTimes {
  [packageDirectory: string]: PackageInfoWithBuildTimes
}
