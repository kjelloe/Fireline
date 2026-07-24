#!/bin/bash
node --version                          # confirm 20+ 
# run suites
# node --test test/milestone0.test.js test/milestone0i.test.js
node --test test/milestone0.test.js test/milestone0i.test.js test/milestone1a.test.js
node test/headless/runner.js            # generate sfc32 pin values

