/**
 * Author: Eric Mendoza (ericmendoza@email.arizona.edu)
 * Author: Luke Ramirez (lucasxavier@email.arizona.edu)
 * File: server.js
 * Assignment: Final Project
 * Course: CSc 337; Fall 21
 * Purpose: 
 */

// necessary packages
const mongoose = require('mongoose');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const socketio = require('socket.io');
const ioCookieParser = require('socket.io-cookie-parser');
const crypto = require('crypto');

// sets up express and the multer image path
const app = express();
const upload = multer({ dest: __dirname + '/public_html/app/images/pfp'} );
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const http = require('http');
const { boolean } = require('webidl-conversions');
const server = http.createServer(app);
const io = socketio(server);
io.use(ioCookieParser());

lobbies = {}
lobbyCodes = {}

function size(array) {
    var size = 0
    array.forEach(element => {
        if (element != null) {
            size++
        }
    });
    return size
}

io.on('connection', socket => {
    socket.on("getGame", () =>{
        var curCookie = socket.request.cookies;   
        if (lobbies[curCookie.lobby.id] == null) {
            lobbies[curCookie.lobby.id] = [socket.id, null, null, null]
        }
        else if (size(lobbies[curCookie.lobby.id]) != 4) {
            for (let index = 0; index < 4; index++) {
                if (lobbies[curCookie.lobby.id][index] == null) {
                    lobbies[curCookie.lobby.id][index] = socket.id
                    break;
                }
            }
        }
        else {
            socket.emit("lobbyFull")
            return
        }
        for (let index = 0; index < 4; index++) {
            getState(index, curCookie.lobby.id)
        }
        Lobby.findOne({_id: curCookie.lobby.id}).exec( (err, result) => {
            if (err || !result) {
                return;
            } else if (!result.gameStarted) {
                if (curCookie.lobby.isHost) {
                    socket.emit("startGameButton")
                }
            }
        });
    })

    socket.on("disconnect", () => {
        var c = socket.request.cookies;  
        if (c.lobby == null) {
            return
        }
        if (lobbies[c.lobby.id] == null) {
            return
        }
        Lobby.findOne({_id: c.lobby.id}).exec( (err, result) => {
            if (err || !result) {
                console.log("COULD NOT FIND LOBBY")
            } else {
                socket.to(socket.id).emit("clearCookie")
                lobbies[c.lobby.id] = remove(lobbies[c.lobby.id], socket.id)
                var curPlayer = c.lobby.player
                if (curPlayer == 0) {
                    result.player0 = []
                }
                if (curPlayer == 1) {
                    result.player1 = []
                }
                else if (curPlayer == 2) {
                    result.player2 = []
                }
                else if (curPlayer == 3) {
                    result.player3 = []
                }
                if (result.turn == curPlayer) {
                    var i = 0
                    while (lobbies[c.lobby.id][result.turn] == null) {
                        if (i == 4) {
                            lobbies[c.lobby.id] = null
                            return
                        }
                        result.turn = (result.turn + 1) % 4
                        i++
                    }
                }
                result.save( (err) => {
                    if (err) {
                        console.log("COULD NOT SAVE LOBBY")
                    } else {
                        var newHostFound = false;
                        for (let i = 0; i < lobbies[c.lobby.id].length; i++) {
                            if (lobbies[c.lobby.id][i] == null) {
                                continue;
                            }
                            else if (!newHostFound) {
                                socket.to(lobbies[c.lobby.id][i]).emit("makeNewHost")
                                socket.to(lobbies[c.lobby.id][i]).emit("startGameButton")
                                newHostFound = true;
                            }
                            else {
                                socket.to(lobbies[c.lobby.id][i]).emit("playerDisconnected")
                            }
                        }
                    }
                });
            }
        });
    })
})

function remove(array, rem) {
    var newArray = []
    for (let i = 0; i < 4; i++) {
        if (array[i] == null) {
            continue;
        }
        else if (array[i] == rem) {
            newArray[i] == null
        }
        else {
            newArray[i] = array[i]
        }
    }
    return newArray
}

const db  = mongoose.connection;
const mongoDBURL = 'mongodb://127.0.0.1/Uno'

var UserSchema = new mongoose.Schema({
    username: String,
    salt: String,
    hash: String,
    stats: {wins: Number, losses: Number, streak: Number}
});
var User = mongoose.model("Users", UserSchema);

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

var cardCount = 0;
app.get('/app/draw', (req, res) => {
    var c = req.cookies;
    if (c && c.lobby) {
        Lobby.findOne({_id: c.lobby.id}).exec( (err, result) => {
            if (err || !result) {
                res.end(JSON.stringify(-1));
            } else if (result.gameStarted) {
                if (result.deck.remaining.length == 0) {
                    result.deck.remaining = shuffleDeck();
                    var lastCard = result.deck.played.pop();
                    result.deck.played = [lastCard];
                }
                var card = result.deck.remaining.pop();
                getPlayers(result, c.lobby.player)[0].push(card);
                result.save( (err) => {
                    if (err) {
                        res.end(JSON.stringify(-1));
                    } else {
                        getState(0, c.lobby.id)
                        getState(1, c.lobby.id)
                        getState(2, c.lobby.id)
                        getState(3, c.lobby.id)
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

function getPlayers(result, playerNum) {
    if (playerNum == 0) {
        return [result.player0, result.player1, result.player2, result.player3]
    }
    else if (playerNum == 1) {
        return [result.player1, result.player2, result.player3, result.player0]
    }
    else if (playerNum == 2) {
        return [result.player2, result.player3, result.player0, result.player1]
    }
    else if (playerNum == 3) {
        return [result.player3, result.player0, result.player1, result.player2]
    }
}

function getState(playerNum, lobbyID) {
    Lobby.findOne({_id: lobbyID}).exec( (err, result) => {
        if (err || !result) {
            console.log("COULD NOT FIND LOBBY")
        } else {
            var players = getPlayers(result, playerNum)
            state = [generateHand(players[0]),
                    playedCard(result.deck.played.pop()),
                    players[1].length,
                    players[2].length,
                    players[3].length]
            io.to(lobbies[lobbyID][playerNum]).emit("receiveGame", state)
        }
    });
}

function generateHand(cards) {
    res = [];
    cards.forEach(card => {
        res.push(generateCard(card));
    });
    return res;
}

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
    cardCount++;
    return newCard;
}

app.post('/app/playedCard', (req, res) => {
    var c = req.cookies;
    if (c && c.lobby) {
        Lobby.findOne({_id: c.lobby.id}).exec( (err, result) => {
            if (err || !result) {
                res.end(JSON.stringify(-1));
            } else if (result.gameStarted) {
                if (result.turn == c.lobby.player) {
                    var color = req.body.color;
                    var value = req.body.value;
                    var cardID = req.body.id.substring(4);
                    var curPlayer = "player" + c.lobby.player
                    var curCard = "" + color + " " + value + " " + cardID
                    Lobby.findOneAndUpdate({_id: c.lobby.id}, {$pull: {[curPlayer] : curCard}}).exec( (err) => {
                        if (err) {
                            res.end(JSON.stringify(-1));
                        } else {
                            result.deck.played.push("" + color + " " + value + " " + cardID);
                            result.turn = (result.turn + 1) % lobbies[c.lobby.id].length;
                            for (let index = result.turn; index < 4; index++) {
                                if (lobbies[c.lobby.id][index] == null) {
                                    result.turn = (result.turn + 1) % lobbies[c.lobby.id].length;
                                }
                                else {
                                    break;
                                }
                            }
                            result.save((err) => {
                                if (err) {
                                    res.end(JSON.stringify(-1));
                                } else {
                                    getState(0, c.lobby.id)
                                    getState(1, c.lobby.id)
                                    getState(2, c.lobby.id)
                                    getState(3, c.lobby.id)
                                    res.end("Make Move");
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

app.get('/app/playerLeft', (req, res) => {
    var c = req.cookies
    getState(c.lobby.player, c.lobby.id) 
    res.end()
})

app.get('/app/clearCookie', (req, res) => {
    var c = req.cookies
    res.cookie("lobby", {id: null, player: null, isHost: null})
    res.end()
})

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

app.post('/app/createLobby', (req, res) => {
    if (lobbyCodes[req.body.lobbyCode] != null) {
        if (lobbies[lobbyCodes[req.body.lobbyCode]] != null) {
            return res.end("Lobby Invalid")
        }
    }
    var newDeck = shuffleDeck();
    var newLobby = new Lobby({
        deck : {
            played : [],
            remaining : newDeck
        },
        player0 : drawCard(7, newDeck),
        player1 : [],
        player2 : [],
        player3 : [],
        turn : 0,
        direction : 1,
        gameStarted: false
    });
    newLobby.save( (err) => {
        if (err) {
            res.end(JSON.stringify(-1))
        }
        else {
            lobbyCodes[req.body.lobbyCode] = newLobby._id
            res.cookie("lobby", {id: newLobby._id, player: 0, isHost: true})
            res.end("Lobby Created");
        }
    })
});

app.post('/app/joinLobby', (req, res) => {
    if (lobbyCodes[req.body.lobbyCode] != null) {
        if (lobbies[lobbyCodes[req.body.lobbyCode]] == null) {
            return res.end("Lobby Invalid")
        }
    }
    Lobby.findOne({_id: lobbyCodes[req.body.lobbyCode]}).exec( (err, result) => {
        if (err) {
            res.end(JSON.stringify(-1));
        }
        else if (!result) {
            res.end("Lobby Invalid");
        }
        else if (!result.gameStarted) {
            var playerCount = 0
            if (lobbies[result._id] == null) {
                playerCount = 0
            }
            else {
                for (let index = 0; index < 4; index++) {
                    if (lobbies[result._id][index] == null) {
                        break;
                    }
                    else {
                        playerCount++;
                    }
                }
            }
            if (playerCount >= 4) {
                res.end("Lobby Full")
            }
            res.cookie("lobby", {id: lobbyCodes[req.body.lobbyCode], player: playerCount, isHost: false})
            if (playerCount == 0) {
                result.player0 = drawCard(7, result.deck.remaining)
            }
            else if (playerCount == 1) {
                result.player1 = drawCard(7, result.deck.remaining)
            }
            else if (playerCount == 2) {
                result.player2 = drawCard(7, result.deck.remaining)
            }
            else if (playerCount == 3) {
                result.player3 = drawCard(7, result.deck.remaining)
            }
            result.save( (err) => {
                if (err) {res.end(JSON.stringify(-1))}
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

app.get('/app/rejoinLobby', (req, res) => {
    var c = req.cookies
    Lobby.findOne({_id: c.lobby.id}).exec( (err, result) => {
        if (err || !result) {
            res.end(JSON.stringify(-1));
        }
        else if (!result.gameStarted) {
            var playerCount = 0
            if (lobbies[result._id] == null) {
                playerCount = 0
            }
            else {
                for (let index = 0; index < 4; index++) {
                    if (lobbies[result._id][index] == null) {
                        break;
                    }
                    else {
                        playerCount++;
                    }
                }
            }
            res.cookie("lobby", {id: result._id, player: playerCount, isHost: false})
            if (playerCount == 0) {
                result.player0 = drawCard(7, result.deck.remaining)
            }
            else if (playerCount == 1) {
                result.player1 = drawCard(7, result.deck.remaining)
            }
            else if (playerCount == 2) {
                result.player2 = drawCard(7, result.deck.remaining)
            }
            else if (playerCount == 3) {
                result.player3 = drawCard(7, result.deck.remaining)
            }
            else {
                res.end("Lobby Full")
            }
            result.save( (err) => {
                if (err) console.log('ERROR FINDING LOBBY')
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

app.get('/app/makeHost', (req, res) => {
    var c = req.cookies
    res.cookie("lobby", {id: c.lobby.id, player: c.lobby.player, isHost: true})
    getState(c.lobby.player, c.lobby.id) 
    res.end();
});

app.get('/app/startGame', (req, res) => {
    var c = req.cookies
    Lobby.findOne({_id: c.lobby.id}).exec( (err, result) => {
        if (err || !result) {
            res.end(JSON.stringify(-1));
        }
        else {
            result.gameStarted = true;
            result.save( (err) => {
                if (err) {res.end(JSON.stringify(-1));}
                else {
                    res.end("Game Started");
                }
            })
        }
    })
});

function shuffleDeck() {
    var res = [];
    var count = 0;
    [0, 1].forEach(pile => {
        ["red", "blue", "green", "yellow"].forEach(color => {
            [0,1,2,3,4,5,6,7,8,9,"+2","$","%"].forEach(value => {
                res.push(color + " " + value + " " + count);
                count++;
            });
        });
    });
    return res.sort(()=> (Math.random() > .5) ? 1 : -1);
}

function drawCard(num, deck) {
    var res = [];
    for (let i = 0; i < num; i++) {
        res.push(deck.pop());
    }
    return res;
}

function getHash(password, salt) {
    var cryptoHash = crypto.createHash('sha512');
    var toHash = password + salt;
    var hash = cryptoHash.update(toHash, 'utf-8').digest('hex');
    return hash;
}

function isPasswordCorrect(account, password) {
    var hash = getHash(password, account.salt);
    return account.hash == hash;
}

app.post('/login', (req, res) => {
    var user = {username: req.body.username}
    User.findOne(user).exec( (err, result) => {
        if (err || !result) {
            res.end(JSON.stringify(-1));
        } else {
            var password = req.body.password;
            var correct = isPasswordCorrect(result, password);
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

app.post('/createUser', (req, res) => {
    User.findOne({username: req.body.username}).exec( (err, result) => {
        if (err || result) {
            return res.end("User already exist");
        } else {
            var salt = Math.floor(Math.random() * 1000000000000);
            var hash = getHash(req.body.password, salt);
            var temp = new User({
                'username': req.body.username,
                'salt': salt,
                'hash': hash,
                'stats': {wins: 0, losses: 0, streak: 0}
            });
            temp.save((err) => {
                err ? res.end("db error occurred") : res.end("User Created!");
            });
        }
    });
});

var sessions = {};
var second = 1000; var minute = 60*second; var hour = 60*minute;
const LOGIN_TIME = 10*minute;

function filterSessions() {
    for (x in sessions) {
        if (sessions[x].time + LOGIN_TIME < Date.now()) {
            delete sessions[x];
        }
    }
}
setInterval(filterSessions, 2000);


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

function isValidSession(username, sessionKey) {
    return username in sessions && sessions[username].key == sessionKey;
}

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