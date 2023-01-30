/**
 * WebSocket TicTacToe by Harrison Thorne
 *
 * client.js
 */

// import the socket.io client library for websockets
const { io } = require("socket.io-client");

// get the domain and port we want to connect to from the command line
const DOMAIN = process.argv[2] ?? '127.0.0.1';
const PORT = process.argv[3] ?? 5050;

// connect to the server
const socket = io(`ws://${DOMAIN}:${PORT}`);

// listen to the 'connect' event to inform the user that the socket has
// connected.
socket.on('connect', () => {
    console.log(`connected to ${DOMAIN} ${PORT}`);
})

// if the server rejects our connection, print why and exit.
socket.on('reject', reason => {
    console.error(`rejected. ${reason}`);
    process.exit(1);
});

// if there's a disconneciton, print why and exit
socket.on('disconnect', reason => {
    console.error(`disconnected. ${reason}`);
    process.exit(2);
});

// if there's a connection error, print it and exit
socket.on('connect_error', err => {
    console.error(`connection error. ${err.message}`);
    process.exit(3);
});

// listen for 'board_update' events. if the server sends a board over (in the form of an
// array), display it.
socket.on('board_update', board => {
    // enter a blank line for clarity
    console.log('');
    console.log(`${board[0]} ${board[1]} ${board[2]}`);
    console.log(`${board[3]} ${board[4]} ${board[5]}`);
    console.log(`${board[6]} ${board[7]} ${board[8]}`);
});

// listen for 'game_start' events to let the user know the game has started.
// the server will tell us which player we are: either 'first' or 'second'.
socket.on('game_start', ordinal => {
    console.log(`Game started. You are ${ordinal} player.`); 
    console.log("When it's your turn, enter a number to place a symbol on the board:");
    console.log(`1 2 3`);
    console.log(`4 5 6`);
    console.log(`7 8 9`);
});

// listen for 'turn' events. when a turn event is received, we know that it is
// this player's turn. prompt the user for their next move. if `retryReason` has
// a value, we'll print the value to let the user know they need to enter a
// valid number.
const readcommand = require('readcommand');
socket.on('turn', retryReason => {
    console.log(retryReason || 'your turn.');
    readcommand.read((err, args) => {
        if (err) {
            // if there was an error reading input, let the server know
            socket.emit('turn_error', err);
        } else {
            // emit an event saying we took our turn and would like the server
            // to validate and accept our move
            socket.emit('turn_taken', args[0]);
        }
    });
});

// listen for 'game_over' events. the server will tell us either the winner,
// there was a tie, or there was a resignation. we will disconnect from the
// server.
socket.on('game_over', reason => {
    console.log(`Game ${reason}.`);
    socket.disconnect();
});
