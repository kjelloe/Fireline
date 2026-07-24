#!/bin/bash
node --version                          # confirm 20+ 


npm install

node --test test/*.test.js

node test/headless/sim1d.js

# run suites
# node --test test/milestone0.test.js test/milestone0i.test.js
#node --test \
#  test/milestone0.test.js \
#  test/milestone0i.test.js \
#  test/milestone1a.test.js \
#  test/milestone1b.test.js
#
#node test/headless/sim1b.js
#node test/headless/runner.js            # generate sfc32 pin values

