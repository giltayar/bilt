export declare class Tagged<N extends string> {
  protected _nominal_: N
}
export type Nominal<T, N extends string> = T & Tagged<N>

export type Directory = Nominal<string, 'Directory'>
export type RelativeDirectoryPath = Nominal<string, 'RelativeDirectoryPath'>
export type RelativeFilePath = Nominal<string, 'RelativeFilePath'>
export type Commitish = Nominal<string, 'Commitish'>

export interface Package {
  directory: RelativeDirectoryPath
}

export interface PackageInfo extends Package {
  name: string
  dependencies: Package[]
}

export interface PackageInfos {
  [packageDirectory: string]: PackageInfo
}

export interface LastSuccesfulBuildOfPackage {
  package: Package
  lastSuccesfulBuild: Commitish
}
