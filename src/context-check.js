#!/usr/bin/env node
'use strict';

const { main } = require('./cli');

// never crash the statusline
main().catch(() => process.exit(0));
