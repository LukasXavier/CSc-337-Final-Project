/**
 * Author: Eric Mendoza (ericmendoza@email.arizona.edu)
 * Author: Luke Ramirez (lucasxavier@email.arizona.edu)
 * File: server.js
 * Assignment: Final Project
 * Course: CSc 337; Fall 21
 * Purpose: Handles requests and socket messages for the Login page, Lobby page, 
 *          and an Uno game. Also handles hashing and salting user passwords as 
 *          well as authenticating session cookies
 */

// necessary packages
const mongoose = require('mongoose');
const express = require('express');
const cookieParser = require('cookie-parser');
const socketio = require('socket.io');
const ioCookieParser = require('socket.io-cookie-parser');
const crypto = require('crypto');

// sets up express and the multer image path
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// socket.io setup
const http = require('http');
const { boolean } = require('webidl-conversions');
const server = http.createServer(app);
const io = socketio(server);
io.use(ioCookieParser());

// Schemas for the Database and initialization for mongoose
const db  = mongoose.connection;
const mongoDBURL = 'mongodb://127.0.0.1/Uno';

var UserSchema = new mongoose.Schema({
    username: String,
    salt: String,
    hash: String,
    stats: {type: mongoose.Schema.Types.ObjectId, ref: 'Stat'}
});
var User = mongoose.model("Users", UserSchema);

var StatSchema = new mongoose.Schema({
    wins: Number,
    losses: Number,
    streak: Number 
});
var Stat = mongoose.model("Stats", StatSchema);

var LobbySchema = new mongoose.Schema({
    player0 : [String],
    player1 : [String],
    player2 : [String],
    player3 : [String],
    deck: {played: [String], remaining: [String]},
    turn: Number,
    direction: Number,
    gameStarted: Boolean
});
var Lobby = mongoose.model("Lobbies", LobbySchema);

mongoose.connect(mongoDBURL, { useNewUrlParser: true });
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Stores lobby socket information
// Key: Database Lobby ID, Value: An array of the sockets for each player in that lobby
lobbies = {}

// HashMap for client side lobby code
// Key: Client Side Lobby Code, Value: Database Lobby ID
lobbyCodes = {}

/**
 * @param {*} array an array
 * @returns the size of an array excluding null elements
 */
function size(array) {
    var size = 0;
    array.forEach(element => {
        if (element != null) {
            size++;
        }
    });
    return size;
}

// Listens for client side socket messages
io.on('connection', socket => {

    // When a player connects to a lobby they will send this message 
    // to check the state of the lobby and update it accordingly
    socket.on("getGame", () =>{
        var curCookie = socket.request.cookies;   
        // when the host connects this saves their socket in the lobbies hashmap
        if (lobbies[curCookie.lobby.id] == null) {
            lobbies[curCookie.lobby.id] = [socket.id, null, null, null];
        }
        // when a non-client player connects this saves their socket in the lobbies hashmap
        else if (size(lobbies[curCookie.lobby.id]) != 4) {
            for (let index = 0; index < 4; index++) {
                if (lobbies[curCookie.lobby.id][index] == null) {
                    lobbies[curCookie.lobby.id][index] = socket.id;
                    break;
                }
            }
        }
        // if the lobby is full the user cannot join it and will be taken back to the 
        // lobby page
        else {
            socket.emit("lobbyFull");
            return;
        }
        // updates all players in the lobby with the state of the game
        for (let index = 0; index < 4; index++) {
            getState(index, curCookie.lobby.id);
        }
        // if the player is a host they are given a "Start Game" button
        Lobby.findOne({_id: curCookie.lobby.id}).exec( (err, result) => {
            if (err || !result) {
                return;
            } else if (!result.gameStarted) {
                if (curCookie.lobby.isHost) {
                    socket.emit("startGameButton");
                }
            }
        });
    })

    // Makes the given player draw four cards
    socket.on("makeDrawFour", (player) => {
        var curCookie = socket.request.cookies; 
        io.to(lobbies[curCookie.lobby.id][player]).emit("drawFour");
    })

    // Makes the given player draw two cards
    socket.on("makeDrawTwo", (player) => {
        var curCookie = socket.request.cookies; 
        io.to(lobbies[curCookie.lobby.id][player]).emit("drawTwo");
    })

    // handles when a player disconnects from the game 
    socket.on("disconnect", () => {
        var c = socket.request.cookies;  
        // if the player is on the lobby page and disconnects then nothing happens
        if (c.lobby == null) {
            return;
        }
        // if the player cookie still has a lobby id, but that 
        // lobby is empty and they disconnect then nothing happens
        if (lobbies[c.lobby.id] == null) {
            return;
        }
        // finds the lobby that the player was in when they disconnected
        Lobby.findOne({_id: c.lobby.id}).exec( (err, result) => {
            if (err || !result) {
                console.log("COULD NOT FIND LOBBY");
            } else {
                // clears the lobby portion of the player's cookie so they no longer 
                // have a player number or a lobby
                socket.to(socket.id).emit("clearCookie");
                // removes the player from the array of player sockets in the lobbies hashmap
                lobbies[c.lobby.id] = remove(lobbies[c.lobby.id], socket.id);

                var curPlayer = c.lobby.player;
                // sets the state of the player's cards to null in the Database
                // for the lobby they left
                if (curPlayer == 0) {
                    result.player0 = [null];
                }
                if (curPlayer == 1) {
                    result.player1 = [null];
                }
                else if (curPlayer == 2) {
                    result.player2 = [null];
                }
                else if (curPlayer == 3) {
                    result.player3 = [null];
                }

                // Sets the turn to the next player if the current turn was the player that
                // disconnected
                if (result.turn == curPlayer) {
                    var i = 0;
                    while (lobbies[c.lobby.id][result.turn] == null) {
                        if (i == 4) {
                            lobbies[c.lobby.id] = null;
                            return;
                        }
                        result.turn = (result.turn + result.direction + 4) % 4;
                        i++;
                    }
                }

                // saves changes made to the lobby
                result.save( (err) => {
                    if (err) {
                        console.log("COULD NOT SAVE LOBBY");
                    } else {
                        // assigns a new host if the game was not started yet
                        // updates all players still in the lobby with the state of
                        // the game after the player disconnected
                        var newHostFound = false;
                        for (let i = 0; i < lobbies[c.lobby.id].length; i++) {
                            if (lobbies[c.lobby.id][i] == null) {
                                continue;
                            }
                            else if (!newHostFound && !result.gameStarted) {
                                socket.to(lobbies[c.lobby.id][i]).emit("makeNewHost");
                                socket.to(lobbies[c.lobby.id][i]).emit("startGameButton");
                                newHostFound = true;
                            }
                            else {
                                socket.to(lobbies[c.lobby.id][i]).emit("playerDisconnected");
                            }
                        }
                    }
                });
            }
        });
    })
})

/**
 * removes a given element from 
 * a given array
 * @param {*} array an array
 * @param {*} rem the element to be removed
 * @returns a new array without the removed element
 */
function remove(array, rem) {
    var newArray = [];
    for (let i = 0; i < 4; i++) {
        if (array[i] == null) {
            newArray[i] = null;
        }
        else if (array[i] == rem) {
            newArray[i] == null;
        }
        else {
            newArray[i] = array[i];
        }
    }
    return newArray;
}

/**
 * Handles when a player draws a card
 */
app.post('/app/draw', (req, res) => {
    var c = req.cookies;
    if (c && c.lobby) {
        Lobby.findOne({_id: c.lobby.id}).exec( (err, result) => {
            if (err || !result) {
                res.end(JSON.stringify(-1));
            // makes sure the game has started before a move can be made
            } else if (result.gameStarted && result.turn == c.lobby.player) {
                var cards = []
                // gets new cards from the deck as many times as
                // specified by the request body
                for (let i = 0; i < req.body.amount; i++) {
                    if (result.deck.remaining.length == 0) {
                        result.deck.remaining = shuffleDeck();
                        var lastCard = result.deck.played.pop();
                        result.deck.played = [lastCard];
                    }
                    cards.push(result.deck.remaining.pop());  
                }
                // puts the cards taken from the deck into the player's hand
                for (let i = 0; i < cards.length; i++) {
                    getPlayers(result, c.lobby.player)[0].push(cards[i]);
                }
                result.save( (err) => {
                    if (err) {
                        res.end(JSON.stringify(-1));
                    } else {
                        // updates all players with the state of the game after 
                        // the player drew their card/cards
                        getState(0, c.lobby.id);
                        getState(1, c.lobby.id);
                        getState(2, c.lobby.id);
                        getState(3, c.lobby.id);
                        res.end("Draw");
                    }
                });
            }
            else {
                res.end();
            }
        });
    } else {
        res.end(JSON.stringify(-1));
    }
});

/**
 * @param {*} result A lobby object from the database
 * @param {*} playerNum a given player number
 * @returns an array with the given player at index 0 and other 
 *          players following
 */
function getPlayers(result, playerNum) {
    if (playerNum == 0) {
        return [result.player0, result.player1, result.player2, result.player3];
    }
    else if (playerNum == 1) {
        return [result.player1, result.player2, result.player3, result.player0];
    }
    else if (playerNum == 2) {
        return [result.player2, result.player3, result.player0, result.player1];
    }
    else if (playerNum == 3) {
        return [result.player3, result.player0, result.player1, result.player2];
    }
}

/**
 * Displays the state of the game for a player in the lobby
 * @param {*} playerNum the player that is being given the state of the game
 * @param {*} lobbyID the lobby id in the database
 */
function getState(playerNum, lobbyID) {
    Lobby.findOne({_id: lobbyID}).exec( (err, result) => {
        if (err || !result) {
            console.log("COULD NOT FIND LOBBY");
        } else {
            var players = getPlayers(result, playerNum);
            // gets the player's hand and the length of the other
            // players' hands and puts it in an array to send back to the 
            // client
            state = [
                generateHand(players[0]),
                playedCard(result.deck.played.pop()),
                players[1],
                players[2],
                players[3],
                result.gameStarted,
                (((result.turn - playerNum) + 4) % 4), 
            ];
            io.to(lobbies[lobbyID][playerNum]).emit("receiveGame", state);
        }
    });
}

/**
 * Makes a card html for each card in the given card
 * array then adds them to a return array
 * @param {*} cards an array of cards as Strings
 * @returns the array of card htmls
 */
function generateHand(cards) {
    res = [];
    cards.forEach(card => {
        res.push(generateCard(card));
    });
    return res;
}

/**
 * Turns a given card string into a displayable card html
 * @param {*} card a card string in the form "color value cardID"
 * @returns the card html of the given card
 */
function generateCard(card) {
    if (!card) { return ""; }
    [color, value, id] = card.split(' ');
    var cardID = "card" + id;
    var newCard = "";
    newCard += '<div class="card" style="background-color:' + color + ';" id="' + cardID +
               '" onmouseover="followMouse(\'on\', this);" ' +
               'onmouseout="followMouse(\'off\', this);" ' + 
               'onclick="makeMove(this);"' + '>' + '<div class="topLeftText"><b>' +
               value + '</b></div>' + '<div class="loop" style="background-color:' +
               color +  ';"><div class="cardText"><b>' + value + '</b></div></div>' + 
               '<div class="bottomRightText"><b>' + value + '</b></div></div>'
    return newCard;
}

// handles when a player makes a move
app.post('/app/playedCard', (req, res) => {
    var c = req.cookies;
    if (c && c.lobby) {
        Lobby.findOne({_id: c.lobby.id}).exec( (err, result) => {
            if (err || !result) {
                res.end(JSON.stringify(-1));
            // makes sure the game has started before a move can be made
            } else if (result.gameStarted) {
                // if it is requesting player's turn then they can make a move
                if (result.turn == c.lobby.player) {
                    // gets the played card information from the request body
                    var color = req.body.color;
                    var value = req.body.value;
                    var cardID = req.body.id.substring(4);

                    var curPlayer = "player" + c.lobby.player;

                    // makes the card color black if a wildcard or +4 was played so that the 
                    // database can find the card
                    var curCard = "" + color + " " + value + " " + cardID;
                    if (value == "$" || value == "?") {
                        var curCard = "black " + value + " " + cardID;
                    }

                    Lobby.findOneAndUpdate({_id: c.lobby.id}, {$pull: {[curPlayer] : curCard}}).exec( (err) => {
                        if (err) {
                            res.end(JSON.stringify(-1));
                        } else {
                            // reverses the turn direction if a reverse card is played
                            if (value == '%') {
                                result.direction == 1 ? result.direction = -1 : result.direction = 1;
                            }
                            // puts the played card in the played cards container
                            result.deck.played.push("" + color + " " + value + " " + cardID);

                            
                            var count = 0;
                            var nextPlayer = 1;
                            // the next player is the second next player if a skip card was played
                            if (value == '#') { 
                                var nextPlayer = 2; 
                            }
                            // finds the player who will be able to make a move next
                            result.turn = (result.turn + result.direction + 4) % 4;
                            while (count != nextPlayer) {
                                if (lobbies[c.lobby.id][result.turn] == null) {
                                    result.turn = (result.turn + result.direction + 4) % 4;
                                } else { 
                                    count++; 
                                    // skips the found player if a skip turn card was played
                                    if (value == '#' && count == 1) {
                                        result.turn = (result.turn + result.direction + 4) % 4;
                                    }
                                }
                            }
                            
                            result.save((err) => {
                                if (err) {
                                    res.end(JSON.stringify(-1));
                                } else {
                                    // updates the players in the lobby with the 
                                    // state of the game after the card was played
                                    getState(0, c.lobby.id);
                                    getState(1, c.lobby.id);
                                    getState(2, c.lobby.id);
                                    getState(3, c.lobby.id);
                                    // makes the next player draw 2 cards if the played card was +
                                    if (value == '+') { 
                                        res.end("DrawTwo " + result.turn);
                                     }
                                     // makes the next player draw 4 cards if the played card was $
                                    else if (value == '$') { 
                                        res.end("DrawFour " + result.turn);
                                     }
                                    else {
                                        res.end("Make Move");
                                    }
                                }
                            });
                        }
                    });
                } else {
                    res.end(JSON.stringify(["Keep"]));
                }
            }
            else {
                res.end();
            }
        });
    }
});

/**
 * gets the state of the game after a player leaves
 */
app.get('/app/playerLeft', (req, res) => {
    var c = req.cookies;
    getState(c.lobby.player, c.lobby.id);
    res.end();
});

/**
 * clears the lobby part of the cookie of a player that left a game
 */
app.get('/app/clearCookie', (req, res) => {
    var c = req.cookies;
    res.cookie("lobby", {id: null, player: null, isHost: null});
    res.end();
});

// Updates the player stats in the database after a game ends
app.post('/app/gameOver', (req, res) => {
    var c = req.cookies;
    var won = req.body.won;
    User.findOne({username: c.username}).populate('stats').exec( (err, result) => {
        if (err || !result) {
            res.end(JSON.stringify(-1));
        } else {
            if (won) {
                result.stats.wins += 1;
                result.stats.streak += 1;
            } else {
                result.stats.losses += 1;
                result.stats.streak = 0;
            }
            result.save((err) => {
                err ? res.end(JSON.stringify(-1)) : res.end();
            });
        }
    });
});

// creates the html for a played card
function playedCard(card) {
    if (!card) { return ""; }
    [color, value] = card.split(' ');
    var newCard = "";
    newCard += '<div class="card" style="background-color:' + color + ';">' + 
               '<div class="topLeftText"><b>' + value + '</b></div>' +
               '<div class="loop" style="background-color:' + color + 
               ';"><div class="cardText"><b>' + value + '</b></div></div>' + 
               '<div class="bottomRightText"><b>' + value + '</b></div></div>'
    return newCard;
}

// handles when a user creates a new lobby
app.post('/app/createLobby', (req, res) => {
    // if the lobby already exists notify the requester
    if (lobbyCodes[req.body.lobbyCode] != null) {
        if (lobbies[lobbyCodes[req.body.lobbyCode]] != null) {
            return res.end("Lobby Invalid");
        }
    }
    // make a new deck for the lobby, initializes the current player's hand, and sets the 
    // opposing players to null
    var newDeck = shuffleDeck();
    var newLobby = new Lobby({
        deck : {
            played : [],
            remaining : newDeck
        },
        player0 : drawCard(7, newDeck),
        player1 : [null],
        player2 : [null],
        player3 : [null],
        turn : 0,
        direction : 1,
        gameStarted: false
    });
    newLobby.save( (err) => {
        if (err) {
            res.end(JSON.stringify(-1))
        }
        else {
            lobbyCodes[req.body.lobbyCode] = newLobby._id;
            // sets the lobby part of the player's cookie so that they are the first player and a host
            // also sets their lobby to the ID of the lobby created in the database
            res.cookie("lobby", {id: newLobby._id, player: 0, isHost: true});
            res.end("Lobby Created");
        }
    })
});

// handles when a user joins an existing lobby
app.post('/app/joinLobby', (req, res) => {
    // if the lobby was created before but is empty then notify
    // the requester that the lobby has no players
    if (lobbyCodes[req.body.lobbyCode] != null) {
        if (lobbies[lobbyCodes[req.body.lobbyCode]] == null) {
            return res.end("Lobby Invalid");
        }
    }
    Lobby.findOne({_id: lobbyCodes[req.body.lobbyCode]}).exec( (err, result) => {
        if (err) {
            res.end(JSON.stringify(-1));
        }
        // if the lobby could not be found notify the requester
        else if (!result) {
            res.end("Lobby Invalid");
        }
        // if the game has not started yet then allow the requester to join the lobby
        else if (!result.gameStarted) {
            
            // counts the number of players in the lobby
            var playerCount = 0;
            if (lobbies[result._id] == null) {
                playerCount = 0;
            }
            else {
                // finds a player number that is available
                for (let index = 0; index < 4; index++) {
                    if (lobbies[result._id][index] == null) {
                        break;
                    }
                    else {
                        playerCount++;
                    }
                }
            }

            // if 4 players were found in the lobby then notify 
            // the requester that they cannot join it
            if (playerCount >= 4) {
                res.end("Lobby Full");
            }

            // set the requester's cookie to have the lobby they are joining and their player number
            res.cookie("lobby", {id: lobbyCodes[req.body.lobbyCode], player: playerCount, isHost: false});
            // fill the joining player's hand with 7 cards
            if (playerCount == 0) {
                result.player0 = drawCard(7, result.deck.remaining);
            }
            else if (playerCount == 1) {
                result.player1 = drawCard(7, result.deck.remaining);
            }
            else if (playerCount == 2) {
                result.player2 = drawCard(7, result.deck.remaining);
            }
            else if (playerCount == 3) {
                result.player3 = drawCard(7, result.deck.remaining);
            }
            result.save( (err) => {
                if (err) { res.end(JSON.stringify(-1)); }
                else {
                    res.end("Lobby Joined");
                }
            })
        }
        else {
            res.end("Game Started");
        }
    })
});

// handles when a user refreshes the page while in a lobby 
app.get('/app/rejoinLobby', (req, res) => {
    var c = req.cookies;
    Lobby.findOne({_id: c.lobby.id}).exec( (err, result) => {
        if (err || !result) {
            res.end(JSON.stringify(-1));
        }
        // if the game has not started yet then allow the requester to rejoin the lobby
        else if (!result.gameStarted) {

            // counts the number of players in the lobby
            var playerCount = 0;
            if (lobbies[result._id] == null) {
                res.cookie("lobby", {id: result._id, player: 0, isHost: true});
            }
            else {
                // finds a player number that is available
                for (let index = 0; index < 4; index++) {
                    if (lobbies[result._id][index] == null) {
                        break;
                    }
                    else {
                        playerCount++;
                    }
                }
                res.cookie("lobby", {id: result._id, player: playerCount, isHost: false});
            }

            // set the requester's cookie to have the lobby they are joining and their player number
            
            // fill the joining player's hand with 7 cards
            if (playerCount == 0) {
                result.player0 = drawCard(7, result.deck.remaining);
            }
            else if (playerCount == 1) {
                result.player1 = drawCard(7, result.deck.remaining);
            }
            else if (playerCount == 2) {
                result.player2 = drawCard(7, result.deck.remaining);
            }
            else if (playerCount == 3) {
                result.player3 = drawCard(7, result.deck.remaining);
            }
            else {
                res.end("Lobby Full");
            }
            result.save( (err) => {
                if (err) console.log('ERROR FINDING LOBBY');
                else {
                    res.end("Lobby Joined");
                }
            })
        }
        else {
            res.end("Game Started");
        }
    })
});

// make the requesting player the host of the lobby they are in
app.get('/app/makeHost', (req, res) => {
    var c = req.cookies;
    res.cookie("lobby", {id: c.lobby.id, player: c.lobby.player, isHost: true});
    getState(c.lobby.player, c.lobby.id); 
    res.end();
});

// gets called when the host starts the game
app.get('/app/startGame', (req, res) => {
    var c = req.cookies;
    Lobby.findOne({_id: c.lobby.id}).exec( (err, result) => {
        if (err || !result) {
            res.end(JSON.stringify(-1));
        }
        else {
            // makes sure there are at least 2 players in the lobby before the host can
            // start the game
            if (size(lobbies[c.lobby.id]) >= 2) {
                result.gameStarted = true;
            }
            else {
                return res.end("Not Enough Players To Start Game");
            }

            result.save( (err) => {
                if (err) {res.end(JSON.stringify(-1));}
                else {
                    res.end("Game Started");
                }
            })
        }
    })
});

/**
 * Creates the deck then shuffles it
 * @returns a full shuffled array of card strings
 *          each in the form "color value ID"
 */
function shuffleDeck() {
    var res = [];
    [0, 1].forEach(pile => {
        ["red", "blue", "green", "goldenrod"].forEach(color => {
            [0,1,2,3,4,5,6,7,8,9,"+","#","%"].forEach(value => {
                var randomNum = Math.floor(Math.random() * 1000000000000);
                res.push(color + " " + value + " " + randomNum);
            });
        });
    });
    [0, 1, 2, 3].forEach(pile => {
        ["$", "?"].forEach(value => {
            var randomNum = Math.floor(Math.random() * 1000000000000);
            res.push("black " + value + " " + randomNum);
        });
    });
    return res.sort(()=> (Math.random() > .5) ? 1 : -1);
}

/**
 * Draws from a given card deck a specified number of times 
 * then returns the cards drawn
 * @param {*} num the number of cards to draw
 * @param {*} deck the deck of all the remaining cards in the lobby's deck
 * @returns 
 */
function drawCard(num, deck) {
    var res = [];
    for (let i = 0; i < num; i++) {
        res.push(deck.pop());
    }
    return res;
}

// WIP: connected to the thing below
app.get('/app/stats', (req, res) => {
    User.find().exec((err, results) => {
        if (err || !results) {
            res.end(JSON.stringify(-1));
        } else {
            res.end(JSON.stringify(getStats(results)));
        }        
    });
});

// FIXME: half works, bullshit call backs
function getStats(results) {
    var playerStats = [];
    results.forEach(user => {
        console.log(user);
        Stat.findOne({_id: user.stats}).exec((err, result) => {
            console.log(result);
            if (err || !result) {
                console.log("ERROR");
            } else {
                var playerStat = {
                    username: user.username,
                    wins: result.wins,
                    losses: result.losses,
                    streak: result.streak
                };
                console.log(playerStat);
                playerStats.push(playerStat);
            }
        });
    });
    return playerStats;
}

/**
 * Salts and Hashes the user's password
 * @param {*} password the given password
 * @param {*} salt a generated salt
 * @returns the hashed and salted password
 */
function getHash(password, salt) {
    var cryptoHash = crypto.createHash('sha512');
    var toHash = password + salt;
    var hash = cryptoHash.update(toHash, 'utf-8').digest('hex');
    return hash;
}

/**
 * Checks to see if the given password matches the password in the
 * database that the given username has
 * @param {*} account a username 
 * @param {*} password a password
 * @returns true if the password matches the user's password and false otherwise
 */
function isPasswordCorrect(account, password) {
    var hash = getHash(password, account.salt);
    return account.hash == hash;
}

// handles when a user logs in on the login page
app.post('/login', (req, res) => {
    var user = {username: req.body.username};
    User.findOne(user).exec( (err, result) => {
        if (err || !result) {
            res.end(JSON.stringify(-1));
        } else {
            var password = req.body.password;
            var correct = isPasswordCorrect(result, password);
            // logs them into the lobby page if the password matches the 
            // password associated with that user in the database
            if (correct) {
                var sessionKey = addSession(req.body.username);
                res.cookie("username", req.body.username);
                res.cookie("sessionKey", sessionKey);
                res.end("LOGIN");
            } else {
                res.end(JSON.stringify(-1));
            }
        }
    });
});

// handles when the requester is making a new user
app.post('/createUser', (req, res) => {
    User.findOne({username: req.body.username}).exec( (err, result) => {
        // if a result was found then the username was taken
        if (err || result) {
            return res.end("User already exist");
        } else {
            // salts and hashes the given password 
            var salt = Math.floor(Math.random() * 1000000000000);
            var hash = getHash(req.body.password, salt);
            var stats = new Stat({
                wins: 0,
                losses: 0,
                streak: 0
            });
            stats.save((err) => {
                if (err) {
                    res.end("db error occurred");
                } else {
                    // creates the user and saves their info in the database
                    var temp = new User({
                        'username': req.body.username,
                        'salt': salt,
                        'hash': hash,
                        'stats': stats
                    });
                    temp.save((err) => {
                        err ? res.end("db error occurred") : res.end("User Created!");
                    });
                }
            });
        }
    });
});

// handles session cookies
var sessions = {};
var second = 1000; var minute = 60*second; var hour = 60*minute;
// 10 minute session cookie expiration time
const LOGIN_TIME = 10*minute;
function filterSessions() {
    for (x in sessions) {
        if (sessions[x].time + LOGIN_TIME < Date.now()) {
            delete sessions[x];
        }
    }
}

// validates the session cookie every 2 seconds
setInterval(filterSessions, 2000);

// creates a new session if the user did not have one and 
// refreshes their session if they already had one
function addSession(username, sessionKey) {
    if (username in sessions) {
        sessions[username] = {'key': sessionKey, 'time': Date.now()};
        return sessionKey;
    } else {
        let sessionKey = Math.floor(Math.random() * 1000)
        sessions[username] = {'key': sessionKey, 'time': Date.now()};
        return sessionKey;
    }
}

// validates the session
function isValidSession(username, sessionKey) {
    return username in sessions && sessions[username].key == sessionKey;
}

// authenticates the session when accessing pages in /app
app.use('/app/*', (req, res, next) => {
    var c = req.cookies;
    if (c && c.username && c.sessionKey) {
        if (isValidSession(c.username, c.sessionKey)) {
            addSession(c.username, c.sessionKey);
            next();
        } else { res.redirect('/public/index.html'); }
    } else { res.redirect('/public/index.html'); }
});

app.use(express.static('public_html'));
app.get('/*', (req, res) => { res.redirect('/app/lobby.html'); });

server.listen(80, () => { console.log('server has started'); });