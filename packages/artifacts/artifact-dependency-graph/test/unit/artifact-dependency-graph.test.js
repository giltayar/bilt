'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')

const {
  dependencyGraphSubsetToBuild: dependencyGraphSubsetToBuildOriginal,
  buildsThatCanBeBuilt,
} = require('../..')

const dependencyGraphSubsetToBuild = (
  dependencyGraph,
  {changedArtifacts, fromArtifacts, uptoArtifacts, justBuildArtifacts, artifactBuildTimestamps},
) =>
  dependencyGraphSubsetToBuildOriginal({
    dependencyGraph,
    changedArtifacts,
    fromArtifacts,
    uptoArtifacts,
    justBuildArtifacts,
    artifactBuildTimestamps,
  })

describe('artifact-dependency-graph', function() {
  describe('dependencyGraphSubsetToBuild', () => {
    describe('changedFiles', () => {
      it('should return nothing if it"s only that', () => {
        const diamond = {a: [], b: ['a'], c: ['a'], d: ['b', 'c']}

        expect(dependencyGraphSubsetToBuild(diamond, {changedArtifacts: ['a']})).to.eql({})
      })

      it('should still return nothing even if an artifacts dependency has changed', () => {
        const diamond = {a: [], b: ['a'], c: ['a'], d: ['b', 'c']}

        expect(
          dependencyGraphSubsetToBuild(diamond, {
            changedArtifacts: ['a'],
            artifactBuildTimestamps: {a: new Date(2018, 1, 1), c: new Date(2017, 1, 1)},
          }),
        ).to.eql({})
      })
    })

    describe('fromArtifacts', () => {
      it('should work with diamond graphs', () => {
        const diamond = {a: [], b: ['a'], c: ['a'], d: ['b', 'c']}

        expect(dependencyGraphSubsetToBuild(diamond, {fromArtifacts: ['a']})).to.eql(diamond)
        expect(
          dependencyGraphSubsetToBuild(diamond, {
            fromArtifacts: ['c'],
          }),
        ).to.eql({c: [], d: ['c']})
      })

      it('should put in the from artifact if only its dependents changed', () => {
        const diamond = {a: [], b: ['a'], c: ['a'], d: ['b', 'c']}

        expect(
          dependencyGraphSubsetToBuild(diamond, {
            changedArtifacts: ['d'],
            fromArtifacts: ['c'],
            artifactBuildTimestamps: {a: new Date(2018, 1, 1), c: new Date(2017, 1, 1)},
          }),
        ).to.eql({c: [], d: ['c']})
      })

      it('should only build the subtree that changed', () => {
        const diamond = {a: [], b: ['a'], c: ['a'], d: ['b', 'c'], e: ['d']}

        expect(
          dependencyGraphSubsetToBuild(diamond, {
            changedArtifacts: ['d'],
            fromArtifacts: ['c'],
          }),
        ).to.eql({d: [], e: ['d']})
      })

      it('should work with forests', () => {
        const forest = {a: [], b: ['a'], c: ['a'], d: ['b', 'c'], e: [], f: ['e']}

        expect(
          dependencyGraphSubsetToBuild(forest, {
            fromArtifacts: ['a'],
          }),
        ).to.eql({a: [], b: ['a'], c: ['a'], d: ['b', 'c']})
        expect(
          dependencyGraphSubsetToBuild(forest, {
            fromArtifacts: ['e'],
          }),
        ).to.eql({e: [], f: ['e']})
        expect(dependencyGraphSubsetToBuild(forest, {fromArtifacts: ['e', 'a']})).to.eql(forest)
      })

      it('should work with connected forests', () => {
        const forest = {a: [], b: ['a'], c: ['a'], d: ['b', 'c'], e: [], f: ['e', 'd']}

        expect(
          dependencyGraphSubsetToBuild(forest, {
            fromArtifacts: ['a'],
          }),
        ).to.eql({a: [], b: ['a'], c: ['a'], d: ['b', 'c'], f: ['d']})
        expect(
          dependencyGraphSubsetToBuild(forest, {
            fromArtifacts: ['e'],
          }),
        ).to.eql({e: [], f: ['e']})
        expect(
          dependencyGraphSubsetToBuild(forest, {
            fromArtifacts: ['c', 'd'],
          }),
        ).to.eql({c: [], d: ['c'], f: ['d']})
      })

      it('should work with multi-level graphs', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}

        expect(dependencyGraphSubsetToBuild(forest, {fromArtifacts: ['a']})).to.eql(forest)
        expect(
          dependencyGraphSubsetToBuild(forest, {
            fromArtifacts: ['c'],
          }),
        ).to.eql({c: [], d: ['c'], f: ['c']})
      })

      it('should only return a graph with only the builds that changed', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}

        expect(
          dependencyGraphSubsetToBuild(forest, {
            changedArtifacts: ['c'],
            fromArtifacts: ['c', 'e'],
          }),
        ).to.eql({c: [], d: ['c'], f: ['c']})
      })
    })

    describe('justBuild', () => {
      it('should only return the nodes that are justBuild', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}

        expect(
          dependencyGraphSubsetToBuild(forest, {
            justBuildArtifacts: ['c', 'e'],
          }),
        ).to.eql({c: [], e: []})
      })

      it('should return the nodes that have dependencies changed, even if they are not in changedArtifacts', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}

        expect(
          dependencyGraphSubsetToBuild(forest, {
            justBuildArtifacts: ['b'],
            artifactBuildTimestamps: {a: new Date(2018, 1, 1), b: new Date(2017, 1, 1)},
          }),
        ).to.eql({b: []})
      })

      it('should only return the nodes that are justBuild, but the dependencies should be there', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}

        expect(
          dependencyGraphSubsetToBuild(forest, {
            justBuildArtifacts: ['f', 'e', 'a'],
            // the 'a' build in the result is a little problematic, because in terms of build order
            // nothing here tells it to be earlier than e and f which depend on it.
            // It's definitely a bug, but since justBuild is usually used for one focus artifact,
            // that shouldn't be too problematic a bug
          }),
        ).to.eql({f: ['e'], e: [], a: []})
      })

      it('should not ignore changedArtifacts', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}

        expect(
          dependencyGraphSubsetToBuild(forest, {
            justBuildArtifacts: ['f', 'e'],
            changedArtifacts: ['f'],
          }),
        ).to.eql({f: []})
      })
    })

    describe('uptoArtifacts', () => {
      it('should work with multi-level graphs', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}

        expect(
          dependencyGraphSubsetToBuild(forest, {
            changedArtifacts: ['a'],
            uptoArtifacts: ['c'],
          }),
        ).to.eql({c: ['b'], b: ['a'], a: []})
        expect(
          dependencyGraphSubsetToBuild(forest, {
            uptoArtifacts: ['c', 'd'],
          }),
        ).to.eql({c: ['b'], b: ['a'], a: [], d: ['c', 'a']})
      })

      it('should deal correctly with changed files', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}

        expect(
          dependencyGraphSubsetToBuild(forest, {
            uptoArtifacts: ['c', 'd'],
            changedArtifacts: ['b'],
          }),
        ).to.eql({c: ['b'], b: [], d: ['c']})
        expect(
          dependencyGraphSubsetToBuild(forest, {
            uptoArtifacts: ['c'],
            changedArtifacts: ['b'],
          }),
        ).to.eql({c: ['b'], b: []})
      })

      it('should deal correctly with timestamp', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}

        expect(
          dependencyGraphSubsetToBuild(forest, {
            uptoArtifacts: ['c', 'd'],
            changedArtifacts: ['f'],
            artifactBuildTimestamps: {a: new Date(2018, 1, 1), b: new Date(2017, 1, 1)},
          }),
        ).to.eql({c: ['b'], b: [], d: ['c']})
        expect(
          dependencyGraphSubsetToBuild(forest, {
            uptoArtifacts: ['c'],
            changedArtifacts: ['b'],
          }),
        ).to.eql({c: ['b'], b: []})
      })
    })

    describe('all together now!', () => {
      it('should support upto and from for "root" support', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}
        const forestX = {...forest, x: []}

        expect(
          dependencyGraphSubsetToBuild(forestX, {
            uptoArtifacts: ['c'],
            fromArtifacts: ['c'],
          }),
        ).to.eql(forest)
        expect(
          dependencyGraphSubsetToBuild(forestX, {
            uptoArtifacts: ['e'],
            fromArtifacts: ['e'],
          }),
        ).to.eql(forest)
        expect(
          dependencyGraphSubsetToBuild(forestX, {
            uptoArtifacts: ['b'],
            fromArtifacts: ['d'],
          }),
        ).to.eql(forest)
      })

      it('should support upto and from and justBuild for "root" support', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}
        const forestX = {...forest, x: []}

        expect(
          dependencyGraphSubsetToBuild(forestX, {
            uptoArtifacts: ['b'],
            fromArtifacts: ['d'],
            justBuildArtifacts: ['x'],
          }),
        ).to.eql(forestX)
      })

      it('should support everything with changedArtifacts', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}
        const forestX = {...forest, x: []}

        expect(
          dependencyGraphSubsetToBuild(forestX, {
            uptoArtifacts: ['b'],
            fromArtifacts: ['d'],
            justBuildArtifacts: ['x'],
            changedArtifacts: ['x'],
          }),
        ).to.eql({x: []})
        expect(
          dependencyGraphSubsetToBuild(forestX, {
            uptoArtifacts: ['e'],
            fromArtifacts: ['e'],
            justBuildArtifacts: ['x'],
            changedArtifacts: ['e'],
          }),
        ).to.eql({e: [], f: ['e']})
      })
    })
  })

  describe('artifactsThaCanBeBuilt', () => {
    it('it works', () => {
      const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: [], f: ['e', 'c']}

      expect(buildsThatCanBeBuilt(forest, [])).to.eql(['a', 'e'])
      expect(buildsThatCanBeBuilt(forest, ['a', 'e'])).to.eql(['b'])
      expect(buildsThatCanBeBuilt(forest, ['a', 'e', 'c'])).to.eql(['b', 'd', 'f'])
    })
  })
})
