export interface Directory extends String {}
export interface RelativeDirectoryPath extends String {}
export interface RelativeFilePath extends String {}
export interface Commitish extends String {}

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
