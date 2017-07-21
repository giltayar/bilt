//@flow
const Promise = require('bluebird');
const {describe, it} = require('mocha');
const {expect} = require('chai');
const extractorsCreator = require('../src/artifact-extractors');
const sinon = require('sinon');

describe('extractors', function() {
  describe('npm extractor', function() {
    const basedir = '/foo/bar';
    const filename = `${basedir}/gar/package.json`;

    it('should put relative path correctly in artifact', Promise.coroutine(function*() {
      const fileFetcher = sinon.stub().withArgs(filename).returns(Promise.resolve(JSON.stringify({
        name: 'foozilla'
      })));
      const extractor = extractorsCreator(fileFetcher).npmExtractor;

      expect(yield extractor(filename, basedir)).to.deep.equal({
        artifact: 'foozilla',
        type: 'npm',
        dependencies: [],
        path: 'gar',
        owners: []
      });
    }));

    it('should put correct owners', Promise.coroutine(function*() {
      const fileFetcher = sinon.stub().withArgs(filename).returns(Promise.resolve(JSON.stringify({
        name: 'foozilla',
        contributors: [
          'Foo <foo@bar.com> (http://foo)',
          {name: 'Bar', email: 'bar@foo.com', url: 'http://bar'}
        ]
      })));
      const extractor = extractorsCreator(fileFetcher).npmExtractor;

      expect(yield extractor(filename, basedir)).to.deep.equal({
        artifact: 'foozilla',
        type: 'npm',
        dependencies: [],
        path: 'gar',
        owners: ['foo@bar.com', 'bar@foo.com']
      });
    }));



    it('should add dependencies and dev dependencies', Promise.coroutine(function*() {
      const fileFetcher = sinon.stub().withArgs(filename).returns(Promise.resolve(JSON.stringify({
        name: 'foozilla',
        dependencies: {
          a: '4',
          b: '5'
        },
        devDependencies: {
          c: '6'
        },
        owners: []
      })));
      const extractor = extractorsCreator(fileFetcher).npmExtractor;

      expect(yield extractor(filename, basedir)).to.deep.equal({
        artifact: 'foozilla',
        type: 'npm',
        dependencies: ['a', 'b', 'c'],
        path: 'gar',
        owners: []
      });
    }));

    it('should ignore non-npm packages', Promise.coroutine(function*() {
      const fileFetcher = sinon.stub().withArgs(filename).returns('');
      const extractor = extractorsCreator(fileFetcher).npmExtractor;

      expect(yield extractor(filename + '/zoo.bar', basedir)).to.be.undefined;      
    }));
  });

  describe('docker extractor', function() {
    const basedir = '/foo/bar';
    const filename = `${basedir}/mar/gar/Dockerfile`;

    it('should put relative path correctly in artifact and package name should be according to dir', 
      Promise.coroutine(function*() {
        const fileFetcher = sinon.stub().withArgs(filename).returns('');
        const extractor = extractorsCreator(fileFetcher).dockerExtractor;

        expect(yield extractor(filename, basedir)).to.deep.equal({
          artifact: 'gar',
          type: 'docker',
          path: 'mar/gar'
        });
      }));

    it('should ignore non-docker packages', Promise.coroutine(function*() {
      const fileFetcher = sinon.stub().withArgs(filename).returns('');
      const extractor = extractorsCreator(fileFetcher).dockerExtractor;

      expect(yield extractor(filename + '/zoo.bar', basedir)).to.be.undefined;      
    }));
  });

  describe('artifactrc.yml extractor', function() {
    const basedir = '/foo/bar';
    const filename = `${basedir}/gar/artifactrc.yml`;

    it('should ignore artifactsrc.yml in base dir', Promise.coroutine(function*() {
      const rootCircYml = `${basedir}/artifactsrc.yml`;
      const fileFetcher = sinon.stub().withArgs(rootCircYml).returns(Promise.resolve(JSON.stringify([])));
      const extractor = extractorsCreator(fileFetcher).artifactsRcYmlExtractor;
      
      expect(yield extractor(rootCircYml, basedir)).to.be.undefined;
    }));

    it('should put relative path correctly in artifact and get artifact as-is in yml', Promise.coroutine(function*() {
      const fileFetcher = sinon.stub().withArgs(filename).returns(Promise.resolve(JSON.stringify({
        artifact: 'foozilla',
        type: 'npm',
        dependencies: [],
        owners: ['a@b']
      })));
      const extractor = extractorsCreator(fileFetcher).artifactsRcYmlExtractor;

      expect(yield extractor(filename, basedir)).to.deep.equal({
        artifact: 'foozilla',
        type: 'npm',
        dependencies: [],
        path: 'gar',
        owners: ['a@b']
      });
    }));

    it('should put relative path correctly in artifact even if there is one in yml', Promise.coroutine(function*() {
      const fileFetcher = sinon.stub().withArgs(filename).returns(Promise.resolve(JSON.stringify({
        artifact: 'foozilla',
        type: 'npm',
        dependencies: [],
        path: 'wrong-path',
        owners: []
      })));
      const extractor = extractorsCreator(fileFetcher).artifactsRcYmlExtractor;

      expect(yield extractor(filename, basedir)).to.deep.equal({
        artifact: 'foozilla',
        type: 'npm',
        dependencies: [],
        path: 'gar',
        owners: []
      });
    }));    

    it('should not have a type if its not in the artifactrc.yml', Promise.coroutine(function*() {
      const fileFetcher = sinon.stub().withArgs(filename).returns(Promise.resolve(JSON.stringify({
        artifact: 'foozilla',
        dependencies: [],
        path: 'wrong-path',
        owners: []
      })));
      const extractor = extractorsCreator(fileFetcher).artifactsRcYmlExtractor;

      expect(yield extractor(filename, basedir)).to.deep.equal({
        artifact: 'foozilla',
        dependencies: [],
        path: 'gar',
        owners: []
      });
    }));    
  });
  describe('extractor merger', function() {
    const extractorMerger = extractorsCreator(s => s).extractorMerger;

    it('should returned undefined on an empty list', function() {
      expect(extractorMerger([])).to.be.undefined;
    })

    it('should return a docker-npm project on a list containing both docker and npm', function() {
      const merged = extractorMerger([
        {type: 'npm', artifact: 'n', dependencies: ['a']},
        {type: 'docker', artifact: 'd'},
      ]);

      expect(merged).to.deep.equal({type: 'docker-npm', artifact: 'n', dependencies: ['a']})
    });

    it('should use the name in artifactrc.yml for a docker-npm project', function() {
      const merged = extractorMerger([
        {type: 'npm', artifact: 'n', dependencies: ['a']},
        {artifact: 'c', dependencies: ['a']},
        {type: 'docker', artifact: 'd'},
      ]);

      expect(merged).to.deep.equal({type: 'docker-npm', artifact: 'c', dependencies: ['a']})
    });

    it('should use the name in artifactrc.yml for a docker project', function() {
      const merged = extractorMerger([
        {artifact: 'c', dependencies: ['a']},
        {type: 'docker', artifact: 'd'},
      ]);

      expect(merged).to.deep.equal({type: 'docker', artifact: 'c', dependencies: ['a']})
    });

    it('merge dependencies from npm and artifactrc', function() {
      const merged = extractorMerger([
        {type: 'npm', artifact: 'n', dependencies: ['a']},
        {artifact: 'c', dependencies: ['b', 'a']}
      ]);

      expect(merged).to.deep.equal({type: 'npm', artifact: 'c', dependencies: ['a', 'b']})
    });
  })
});
