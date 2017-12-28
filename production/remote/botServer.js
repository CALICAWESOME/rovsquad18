// Bobby Martin
// 2017

// native dependencies
const net = require('net');
const EventEmitter = require('events');

// package dependancies
const clp = require('clp');

// local package dependancies
const { tokenTypes, responseToken } = require('botprotocol');

// make process.send do nothing if botServer was not spawned as a child process
process.send = process.send || function() {};
// exit on any message from parent process
process.on('message', process.exit);

/*
 * if -d or --debug is specified as a command line argument
 * run server on 127.0.0.1 (localhost)
 * return all sensor calls with random data
 */
const argv = clp(process.argv);
const debug = argv['d'] || argv['debug'];
if (debug) console.log('running in debug mode');

// global constants
// TODO: figure out a more efficient way to get the pi's address
const piHost = '0.0.0.0';   // this will eventually be the address of the pi we want to host this on
const port = 8080;
const emitter = new EventEmitter();
const magFrequency = 1000;

// global constants that rely on ohter things
const address = debug ? '127.0.0.1' : piHost;

// global not-constants
let _client;
let _magInterval;

//////////////////////////////////
// server logic & listener shit //
//////////////////////////////////

const server = net.createServer();
server.listen({
    host: address,
    port: port,
    exclusive: true
});

// listening listener (heh)
server.on('listening', () => {
    console.log(`server is listening at ${address}:${port}`);
    process.send('listening');
});

// error listener
server.on('error', error => {
    console.error(error);
});

// connection logic
server.on('connection', client => {
    console.log('client connected');
    _client = client;

    client.on('data', data => {
        console.log(`Hey I got this: ${data}`);
        data = JSON.parse(data);
        emitter.emit(data.type, data);
    });

    client.on('close', () => {
        console.log('client disconnected');
        _client = undefined;
    });

    client.on('error', error => {
        console.error(error);
    })
});

/*
 * EMITTER LOGIC
 *
 * Instead of having a big disgusting switch statement to handle commands
 * like last year, we're using an event emitter now.
 *
 * When this server gets data from the client, it will presumably be in
 * the form of a stringified botProtocol token. botProtocol tokenTypes have
 * 'type' and 'body' keys. When the server gets one of these tokenTypes, the
 * 'emitter' will emit an event with the token's 'type' as the event name
 * and with the token's body as the callback parameter.
 *
 * example:
 * TODO: update me pls I'm out of date
 * The server recieves the following token:
 * {
 *   type: "echo",
 *   body: "hello from the client"
 * }
 * It will then use the 'emitter' object to emit an 'echo' event with
 * "hello from the client" as the callback parameter
 */
emitter.on(tokenTypes.ECHO, echo);
emitter.on(tokenTypes.READMAG, readMag);
// TODO: https://trello.com/c/kP2tI6ZV
// emitter.on(tokenTypes.STARTMAGSTREAM, startMagStream);
// emitter.on(tokenTypes.STOPMAGSTREAM, stopMagStream);

// respond with the same body as the request
function echo(data) {
    const response = new responseToken(data.body, data.headers.transactionID);
    _client.write(response.stringify());
}

function readMag(data) {
    // if we're in debug mode, send back random values from [-pi - pi) radians
    if (debug) {
        const response = new responseToken({
            heading: Math.random() * 2 * Math.PI - Math.PI,
            pitch: Math.random() * 2 * Math.PI - Math.PI,
            roll: Math.random() * 2 * Math.PI - Math.PI
        }, data.headers.transactionID);
        _client.write(response.stringify());
        return;
    }
    // Chris' sensor library call would go here
}

// this is incomplete and hadn't been tested
// function startMagStream(data) {
//     _magInterval = setInterval(readMag, magFrequency);
// }
//
// function stopMagStream(data) {
//     clearInterval(_magInterval);
// }