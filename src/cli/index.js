#!/usr/bin/env ts-node
"use strict";
// import { Command } from 'commander';
// import { handlePrompt } from '../src/cli-api';
const { Command } = require('commander');
const { handlePrompt } = require('../src/cli-api');
const program = new Command();
program
    .name('myext')
    .description('CLI for your VS Code LLM extension')
    .version('0.1.0');
program
    .command('gen')
    .description('Generate code from a prompt')
    .requiredOption('-p, --prompt <prompt>', 'Prompt text')
    .action(async (opts) => {
    const result = await handlePrompt(opts.prompt);
    console.log(result);
});
program.parseAsync(process.argv);
//# sourceMappingURL=index.js.map