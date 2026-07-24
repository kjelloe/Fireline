#!/bin/bash
node --version                          # confirm 20+
node --test test/milestone0.test.js     # run parity suite
node test/headless/runner.js            # generate sfc32 pin values

