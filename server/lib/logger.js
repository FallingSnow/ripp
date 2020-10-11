const Tracer = require('nmmes-tracer');
const chalk = require('chalk');

const logger = new Tracer.Logger({
    levels: ['trace', 'debug', 'log', 'info', 'warn', 'error', 'fatal'],
    level: 'debug',
    dateformat: 'llll',
    format: ["<{{=it.title}}>{{?it.context}} {{=it.context}}{{?}} {{=it.message}}",
        {
            debug: "<{{=it.title}}> {{=it.timestamp}} [{{=it.file}}:{{=it.line}}] {{=it.message}}",
            trace: "<{{=it.title}}> {{=it.timestamp}} ({{=it.method}}) [{{=it.file}}:{{=it.line}}] {{=it.message}}"
        }
    ],
    transports: [
        new Tracer.transports.Console({
            format: {
                warn: "WARNING: {{=it.message}}"
            },
            filters: {
                warn: chalk.yellow,
                fatal: chalk.red
            }
        })
    ],
});

export default logger;
