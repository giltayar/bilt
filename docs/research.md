# Research on how to build bildit

## Plugin Repositories

* [easeway](https://github.com/easeway/js-plugins): It looks exactly like what I need. Very simple too.

## Message Queue

* [automattic/queue](https://github.com/Automattic/kue): based on redis
* [substack/dbbatch](https://github.com/substack/batchdb): based on leveldb. Very simple.
* [antirez/disque](https://github.com/antirez/disque): memory based but has persistence.
* [avinoamr/duty](https://www.npmjs.com/package/duty): based on file system. Very simple.
* [queuelite](https://www.npmjs.com/package/queuelite): based on file system. very new. Message only, not job.
* [level-q](https://www.npmjs.com/package/level-q): based on leveldb. Looks promising. Not sure how I can find
  whether there are no more jobs.
* [queue-light](https://github.com/rackfx/queue-light): based on sqlite. Simple and nice.

## Saas version of bildit

* [external load balancer](https://traefik.io/): looks interesting. alternative to builtin kubernetes one
* [deployment](https://www.npmjs.com/package/exoframe): simple deployment of projects
* [Digital Ocean](https://www.digitalocean.com/): alternative to AWS? In the end, all that matters is price.
