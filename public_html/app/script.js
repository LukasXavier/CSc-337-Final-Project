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

const socket = io();

function followMouse(state, card) {
    state == "on" ? y = -50 : y = 0;
    $("#" + card.id).css("transform", "translateY(" + y + "px)");
}

function draw() {
    $.get('/app/draw',
    (data) => {
        if (data == -1) {
            alert("Something went wrong with the server, try clearing your cookies");
        } 
    });
}

function getGame() {
    $.get('/app/rejoinLobby',
    (data) => {
        if (data == -1) {
            alert("Something went wrong with the server, try clearing your cookies");
        } 
        else if (data == "Lobby Full") {
            alert("The Lobby is Full");
        }
        else if (data == "Lobby Joined") {
            socket.emit("getGame")
        }
        else if (data == "Game Started") {
            alert("Cannot Join: The Game Has Already Been Started");
        }
    });
}

socket.on("receiveGame", (data) => {
    $("#cardGroup1").children(".card").remove();
    $("#cardGroup2").children(".cardBack2").remove();
    $("#cardGroup3").children(".cardBack3").remove();
    $("#cardGroup4").children(".cardBack4").remove();
    data[0].forEach(card => { 
        $("#cardGroup1").append(card); 
    });
    
    $(".playedCards").children(".card").remove();
    $(".playedCards").append(data[1]);

    for (let i = 2; i < 5; i++) {
        if (data[i][0] == null) {
            continue;
        }
        $("#cardGroup" + i).append(opponentCard(i, data[i].length));
    }
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

function opponentCard(player, amount) {
    out = ""
    for (let index = 0; index < amount; index++) {
        out += '<img class="cardBack' + player + '" src="images/CardBack' + player + '.png"></img> '
    }
    return out
}

function makeMove(card) {
    var cardVal = $("#" + card.id).children()[0].innerText
    var cardColor = $("#" + card.id).attr("style").split(" ")[1].replace(";", "")
    if ($(".playedCards").children().length == 0) {
        var lastPlayedCardVal = cardVal
        var lastPlayedCardColor = cardColor
    }
    else {
        var lastPlayedCardVal = $(".playedCards").children()[0].innerText.split("\n")[0]
        var lastPlayedCardColor = $(".playedCards").children().attr("style").split(":")[1].replace(";", "")
    }
    if (cardVal == lastPlayedCardVal || cardColor == lastPlayedCardColor) {
        $.post('/app/playedCard', { 
            value: cardVal,
            color: cardColor,
            id: card.id
            }, (data, status) => {
                if (data == -1) {
                    alert("Something went wrong with the server, try reloading the page");
                }
        })
    }
}

function createLobby() {
    $.post('/app/createLobby',
    {lobbyCode: $('#lobbyCreateID').val()},
    (data, status) => {
        if (data == -1) {
            alert("Something went wrong with the server, try clearing your cookies")
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

function startGame() {
    $.get('/app/startGame',
    (data, status) => {
        if (data == -1) {
            alert("Something went wrong with the server, try clearing your cookies")
        }
        else if (data == "Game Started") {
            $(".playedCards").children("#gameStart").remove();
        }
        else {
            alert(data)
        }
    })
}

socket.on("startGameButton", () => {
    if ($(".playedCards").children().length == 0) {
        var button = '<input type="button" id="gameStart" value="Start Game" onclick="startGame()" ' 
                     + 'style="height:30px; width:100px;">'
        $(".playedCards").append(button);
    }
})

socket.on("hostLeft", () => {
    $(".playedCards").children().remove();
})

function joinLobby() {
    $.post('/app/joinLobby',
    {lobbyCode: $('#lobbyJoinID').val()},
    (data, status) => {
        if (data == -1) {
            alert("Something went wrong with the server, try clearing your cookies");
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

socket.on("lobbyFull", () => {
    alert("The Lobby is Full")
})

socket.on("clearCookie", () => {
    $.get('/app/clearCookie')
})

socket.on("playerDisconnected", () => {
    $.get('/app/playerLeft')
})

socket.on("makeNewHost", () => {
    $.get('/app/makeHost')
})