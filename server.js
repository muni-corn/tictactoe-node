/**
 * WebSocket TicTacToe by Harrison Thorne
 *
 * server.js
 */

// http library
const http = require('http');

// create a server
const server = http.createServer();

// socket.io library for websockets. create a websockets server
const { Server } = require("socket.io");
const io = new Server(server);

// define two null sockets. as clients connect, we'll initialize these
let firstPlayerSocket = null;
let secondPlayerSocket = null;

// initialize board; 9 dots.
let board = ['.', '.', '.', '.', '.', '.', '.', '.', '.'];

// emits an event with data to both players
function emitToAll(event, data = undefined) {
    if (firstPlayerSocket)
        firstPlayerSocket.emit(event, data);

    if (secondPlayerSocket)
        secondPlayerSocket.emit(event, data);
}

// disconnects both players and sets both sockets to null,
// and clears the board for the next game
function cleanUp() {
    if (firstPlayerSocket) {
        firstPlayerSocket.disconnect();
        firstPlayerSocket = null;
    }

    if (secondPlayerSocket) {
        secondPlayerSocket.disconnect();
        secondPlayerSocket = null;
    }

    // reset board for the next game
    board = ['.', '.', '.', '.', '.', '.', '.', '.', '.'];
}

// announces a winner and ends the game.
function announceWinner(who) {
    emitToAll('game_over', `won by ${who} player`);
    cleanUp();
}

// announces a winner because the other player disconnected and ends the game.
function announceWinnerByDisconnection(winner) {
    let other = winner == 'first' ? 'second' : 'first';
    emitToAll('game_over', `won by ${winner} player since ${other} player disconnected`);
    cleanUp();
}

// announces a winner because the other player resigned and ends the game.
function announceWinnerByResignation(winner) {
    emitToAll('game_over', `won by ${winner} player due to resignation`);
    cleanUp();
}

// announces a tie.
function announceTie() {
    emitToAll('game_over', 'is tied');
    cleanUp();
}

// determines if there was a winner based on the sum. if so, the winner is
// announced. if this function returns true1, there was a winner. if it returns
// false, there is no winner yet.
//
// wins are checked by assigning points to symbols. `x` is 1, `o` is -1, `.`
// is 0. if the sum of a row, column, or diagonal is 3, `x` (first player)
// wins. if the sum is -3, `o` (second player) wins.
function determineWinnerFromSum(sum) {
    if (sum == 3) {
        announceWinner('first');
        return true;
    } else if (sum == -3) {
        announceWinner('second');
        return true;
    }

    return false;
}

// returns the score of three spaces.
function symbolToScore(symbol) {
    if (symbol == 'x') return 1;
    else if (symbol == 'o') return -1;
}

// checks if the game is over. returns true if it is, and false if not.
function checkForGameOver() {
    // check rows
    for (let row = 0; row < 3; row++) {
        let sum = 0;
        for (let col = 0; col < 3; col++) {
            let symbol = board[row * 3 + col]
            sum += symbolToScore(symbol);
        }

        if (determineWinnerFromSum(sum)) return true;
    }

    // check columns
    for (let col = 0; col < 3; col++) {
        let sum = 0;
        for (let row = 0; row < 3; row++) {
            let symbol = board[row * 3 + col]
            sum += symbolToScore(symbol);
        }

        if (determineWinnerFromSum(sum)) return true;
    }

    // maybe diagonals?
    let diagonal1Sum = symbolToScore(board[0]) + symbolToScore(board[4]) + symbolToScore(board[8]);
    if (determineWinnerFromSum(diagonal1Sum)) return true;
    let diagonal2Sum = symbolToScore(board[2]) + symbolToScore(board[4]) + symbolToScore(board[6]);
    if (determineWinnerFromSum(diagonal2Sum)) return true;

    // or is it a tie?
    for (let i = 0; i < board.length; i++) {
        // if there's still an unoccupied space left, the game isn't over
        if (board[i] == '.') {
            return false;
        }
    }

    // if we make it to this point, we probably have a tie.
    announceTie();
    return true;
}

// sets up sockets with common events to listen to.
function setupSocket(socket, symbol) {
    // convenience variable to de-dupe some code. is the ordinal ('first' or
    // 'second') of the *other* player, or the opponent of whoever owns
    // `symbol`
    let otherPlayerOrdinal = symbol == 'x' ? 'second' : 'first';

    // give the win to the other player if one disconnects...
    socket.on('disconnect', () => {
        announceWinnerByDisconnection(otherPlayerOrdinal);
    });

    // ...or resigns.
    socket.on('resign', () => {
        announceWinnerByResignation(otherPlayerOrdinal);
    });

    // listen for events emitted by the client when they've taken their turn.
    socket.on('turn_taken', (position, next) => {
        // try to parse position as a number and decrememt for zero-based goodness.
        position = Number(position) - 1;
        if (isNaN(position)) {
            // if the number can't be parsed, let the user know to try again.
            socket.emit('turn', "couldn't parse position. enter a number from 1-9.");
        } else if (position < 0 || position >= board.length) {
            // if the position is out of bounds, prompt the user to try again.
            socket.emit('turn', 'that position is out of bounds. enter a number from 1-9.');
        } else if (board[position] != '.') {
            // if the position on the board is already taken, prompt the user to try
            // again
            socket.emit('turn', 'that position is occupied. try again.');
        } else {
            // otherwise, we should be good to put the symbol on the board!
            board[position] = symbol;

            // update the clients with the new board
            emitToAll('board_update', board);

            // also check for game over
            if (!checkForGameOver()) {
                // if no game over, switch turns to the next player
                if (symbol == 'x') {
                    secondPlayerSocket.emit('turn', null);
                } else {
                    firstPlayerSocket.emit('turn', null);
                }
            }
        }

        // let the client know it can submit input again
        next();
    });

    // listen for `turn_error` events from the client. this is emitted when
    // `readcommand` is unable to read input from the user. if we can't get
    // input from the user, we'll just (be brutal and) assume they disconnected.
    socket.on('turn_error', err => {
        const ordinal = symbol == 'x' ? 'first' : 'second';
        console.error(`${ordinal} player had an error with input (${err}). assuming disconnection.`);
        announceWinnerByDisconnection(otherPlayerOrdinal);
    });
}

// listen for connections. if a client connects, assign it to either the first
// or second player's socket.
io.on('connection', socket => {
    if (!firstPlayerSocket) {
        // set the first socket
        firstPlayerSocket = socket;
    } else if (!secondPlayerSocket) {
        // set the second socket
        secondPlayerSocket = socket;
    } else {
        // if both sockets are in use, deny any extra players that try to
        // connect. TODO: allow spectators
        socket.emit('reject', "you can't connect now! there are already two players connected.");
    }

    // if we have both clients connected, we can start the game if it hasn't
    // been started already.
    if (firstPlayerSocket && secondPlayerSocket) {
        setupSocket(firstPlayerSocket, 'x');
        setupSocket(secondPlayerSocket, 'o');

        // let the games begin!
        firstPlayerSocket.emit('game_start', 'first');
        secondPlayerSocket.emit('game_start', 'second');

        // let the first player go first
        firstPlayerSocket.emit('turn', null);
    }
});

// start listening for connections
const PORT = process.argv[2];
server.listen(PORT, () => {
    console.log(`listening on port ${PORT}`);
});
