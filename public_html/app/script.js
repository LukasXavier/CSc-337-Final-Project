/**
 * Author: Eric Mendoza (ericmendoza@email.arizona.edu)
 * Author: Luke Ramirez (lucasxavier@email.arizona.edu)
 * File: script.js
 * Assignment: Final Project
 * Course: CSc 337; Fall 21
 * Purpose: client side script for handling server-client request
 *      We use a combination of socket.io (a wrapper around Websocket)
 *      and jquery get/post request
 */

// necessary for socket.io on the client side.
const socket = io();

/**
 * This is a simple animation that raising and lowers 'highlighted' cards
 * @param {String} state - Either 'on' or 'off
 * @param {DOM} card - the DOM object of the card
 */
function followMouse(state, card) {
    state == "on" ? y = -50 : y = 0;
    $("#" + card.id).css("transform", "translateY(" + y + "px)");
}

/**
 * queries the server to draw a card
 */
function draw(num) {
    $.post('/app/draw',
    {amount: num},
    (data) => {
        if (data == -1) {
            alert("Something went wrong with the server, try clearing your cookies 4");
        } 
    });
}

/**
 * the onload function, asks the server about the lobby state it is joining
 */
function getGame() {
    $.get('/app/rejoinLobby',
    (data) => {
        if (data == -1) {
            alert("Something went wrong with the server, try clearing your cookies 5");
        } 
        else if (data == "Lobby Full") {
            alert("The Lobby is Full");
            window.location.href = '/app/lobby.html';
        }
        else if (data == "Lobby Joined") {
            socket.emit("getGame")
        }
        else if (data == "Game Started") {
            alert("Cannot Join: The Game Has Already Been Started");
            window.location.href = '/app/lobby.html';
        }
    });
}

// Used to communicate a change in the game state using sockets
socket.on("receiveGame", (data) => {
    // clears all players hands
    $("#cardGroup1").children(".card").remove();
    $("#cardGroup2").children(".cardBack2").remove();
    $("#cardGroup3").children(".cardBack3").remove();
    $("#cardGroup4").children(".cardBack4").remove();
    // adds back the players hand
    data[0].forEach(card => { 
        $("#cardGroup1").append(card); 
    });
    // updates the last played pile
    $(".playedCards").children(".card").remove();
    $(".playedCards").append(data[1]);

    // populates the other players with the amount of cards they have
    for (let i = 2; i < 5; i++) {
        if (data[i][0] == null) {
            continue;
        }
        $("#cardGroup" + i).append(opponentCard(i, data[i].length));
    }
    // Used to communicate the winner and looser of the game
    if (data[0].length == 0) {
        alert("You Win!")
        $.post('/app/gameOver', { 
            won: true
            }, (data, status) => {
                if (data == -1) {
                    alert("Something went wrong with the server, try reloading the page");
                }
        })
        window.location.href = '/app/lobby.html';
        return;
    }
    for (let i = 2; i < 5; i++) {
        if (data[i].length == 0) {
            alert("You Lose!")
            $.post('/app/GameOver', { 
                won: false
                }, (data, status) => {
                    if (data == -1) {
                        alert("Something went wrong with the server, try reloading the page");
                    }
            })
            window.location.href = '/app/lobby.html';
            return;
        }
    }
})

/**
 * Used to generate the other players hand
 * @param {String} player - the player number (2,3,4)
 * @param {Number} amount - the amount of cards to draw
 * @returns A HTML string of X amount of cards
 */
function opponentCard(player, amount) {
    out = ""
    for (let index = 0; index < amount; index++) {
        out += '<img class="cardBack' + player + '" src="images/CardBack' + player + '.png"></img> '
    }
    return out
}

function lightUp(parent) {
    $("#" + parent.id).css("filter", "brightness(100%)")
}

function dim(parent) {
    $("#" + parent.id).css("filter", "brightness(50%)")
}

function chooseColor(cardVal, id) {
    var data = cardVal + " " + id
    var popUp = '<div id="popUp">'
    + '<div id="red" onmouseover="lightUp(this);" onmouseout="dim(this);"' 
    + 'onclick="colorChosen(this)" data-internalid="' + data + '"></div>'
    + '<div id="blue" onmouseover="lightUp(this);" onmouseout="dim(this);"' 
    + 'onclick="colorChosen(this)" data-internalid="' + data + '"></div>'
    + '<div id="goldenrod" onmouseover="lightUp(this);" onmouseout="dim(this);"' 
    + 'onclick="colorChosen(this)" data-internalid="' + data + '"></div>'
    + '<div id="green" onmouseover="lightUp(this);" onmouseout="dim(this);"' 
    + 'onclick="colorChosen(this)" data-internalid="' + data + '"></div>'
    + '</div>'
    $(popUp).appendTo('body');
}

function colorChosen(card) {
    var colorChosen = card.id;
    console.log(card.id)
    var data = $('#' + colorChosen).data('internalid').split(" ");
    var value = data[0];
    var cardID = data[1];
    $("#popUp").remove();
    $.post('/app/playedCard', { 
        value: value,
        color: colorChosen,
        id: cardID
        }, (data) => {
            console.log(typeof data)
            if (data == -1) {
                alert("Something went wrong with the server, try reloading the page");
            }
            else if (data.includes("DrawFour")) {
                console.log("DRAW4")
                var draw = data.split(" ")
                socket.emit("makeDrawFour", parseInt(draw[1]))
            }
    });
}

/**
 * asks the server if it can play this card or not
 * @param {DOM} card - the DOM element that contains the card you want to play
 */
function makeMove(card) {
    var cardVal = $("#" + card.id).children()[0].innerText
    var cardColor = $("#" + card.id).attr("style").split(" ")[1].replace(";", "")
    if (cardColor == "black") {
        chooseColor(cardVal, card.id);
        return;
    }
    // lets the player play any card if there is no previously played
    if ($(".playedCards").children().length == 0) {
        var lastPlayedCardVal = cardVal
        var lastPlayedCardColor = cardColor
    }
    else {
        // gets the last played cards color and value
        var lastPlayedCardVal = $(".playedCards").children()[0].innerText.split("\n")[0]
        var lastPlayedCardColor = $(".playedCards").children().attr("style").split(":")[1].replace(";", "")
    }
    // if both are the same time ask the server to play the card
    if (cardVal == lastPlayedCardVal || cardColor == lastPlayedCardColor) {
        $.post('/app/playedCard', { 
            value: cardVal,
            color: cardColor,
            id: card.id
            }, (data) => {
                console.log(typeof data)
                
                if (data == -1) {
                    alert("Something went wrong with the server, try reloading the page");
                }
                else if (data.includes("DrawTwo")) {
                    var draw = data.split(" ")
                    socket.emit("makeDrawTwo", parseInt(draw[1]))
                }
        });
    }
}

/**
 * asks the server to make a new lobby
 */
function createLobby() {
    $.post('/app/createLobby',
    {lobbyCode: $('#lobbyCreateID').val()},
    (data, status) => {
        if (data == -1) {
            alert("Something went wrong with the server, try clearing your cookies 1")
        }
        else if (data == "Lobby Invalid") {
            alert("Lobby Already Created")
        }
        else if (data == "Lobby Created") {
            alert(data)
            window.location.href = '/app/uno.html';
        }
    })
}

/**
 * Tells the server to start the game
 */
function startGame() {
    $.get('/app/startGame',
    (data, status) => {
        if (data == -1) {
            alert("Something went wrong with the server, try clearing your cookies 2")
        }
        else if (data == "Game Started") {
            $(".playedCards").children("#gameStart").remove();
        }
        else {
            alert(data)
        }
    })
}

/**
 * adds a button to the host screen allowing them to start the game
 */
socket.on("startGameButton", () => {
    if ($(".playedCards").children().length == 0) {
        var button = '<input type="button" id="gameStart" value="Start Game" onclick="startGame()" ' 
                     + 'style="height:30px; width:100px;">'
        $(".playedCards").append(button);
    }
})

// removes the last played card
socket.on("hostLeft", () => {
    $(".playedCards").children().remove();
})

// asks the server to join a lobby
function joinLobby() {
    $.post('/app/joinLobby',
    {lobbyCode: $('#lobbyJoinID').val()},
    (data, status) => {
        if (data == -1) {
            alert("Something went wrong with the server, try clearing your cookies 3");
        } 
        else if (data == "Lobby Full") {
            alert("The Lobby is Full");
        }
        else if (data == "Lobby Invalid") {
            alert("Lobby ID Not Created");
        }
        else if (data == "Game Started") {
            alert("Cannot Join: The Game Has Already Been Started");
        }
        else {
            alert(data)
            window.location.href = '/app/uno.html';
        }
    })
}

socket.on("drawTwo", () => { 
    draw(2);
})

socket.on("drawFour", () => { 
    draw(4);
})

// socket to tell the client the server is full
socket.on("lobbyFull", () => { alert("The Lobby is Full"); })

// removes the users cookies
socket.on("clearCookie", () => { $.get('/app/clearCookie'); })

// lets the player know that someone left and they should update their view
socket.on("playerDisconnected", () => { $.get('/app/playerLeft'); })

// if the host leaves, a new one is chosen.
socket.on("makeNewHost", () => { $.get('/app/makeHost'); })