# TODO

1. Deal with no `-m` by having it input if not found
1. Deal with circular deps by cutting one of them (assuming there is a higher one, then cutting the
   lower to higher dep)
1. Move commit/add to be part of common logic and not a build step, with a default
   for the commit/add run (so `deploy` can override the commit message).

1. Output as github actions workflow
