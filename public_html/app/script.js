/**
 * Author: Eric Mendoza (ericmendoza@email.arizona.edu)
 * Author: Luke Ramirez (lucasxavier@email.arizona.edu)
 * File: script.js
 * Assignment: Final Project
 * Course: CSc 337; Fall 21
 * Purpose: 
 */

/*
108 cards
25 each color 2 sets of (0-9, skip (@), +2, reverse (%))
8 wild cards (4 wild cards, 4 +4 wild cards)
*/
cardCount = 0;
colors = ['green', 'blue', 'red', 'yellow']
document.addEventListener('DOMContentLoaded', function() {
    draw();
    // makeCard(7)
    // makeOpponentCard(7, 2)
    // makeOpponentCard(7, 3)
    // makeOpponentCard(7, 4)
}, false);

function followMouse(state, card) {
    state == "on" ? y = -50 : y = 0;
    $("#" + card.id).css("transform", "translateY(" + y + "px)");
}

function draw() {
    $.get('/app/draw',
    (data) => {
        if (data == -1) {
            alert("Something went wrong with the server, try clearing your cookies")
        } else {
            $("#cardGroup1").append(data);
        }
    });
}

// function makeOpponentCard(amount, player) {
//     for (let index = 0; index < amount; index++) {
//         $("#cardGroup" + player).append(opponentCard(player))
//     }
// }

function opponentCard(player) {
    return '<img class="cardBack' + player + '" src="images/CardBack' + player + '.png"></img>'
}

function makeMove(card) {
    var cardVal = $("#" + card.id).children()[0].innerText
    var cardColor = $("#" + card.id).attr("style").split(" ")[1].replace(";", "")
    $.post('/app/playedCard', { 
        value: cardVal,
        color: cardColor
        }, (data, status) => {
            data = JSON.parse(data);
            if (data[0] == "Remove") {
                $(".playedCards").children(".card").remove()
                $("#" + card.id).remove()
                $(".playedCards").append(data[1])
            } else if (data == -1) {
                alert("Something went wrong with the server, try reloading the page");
            }
    })
}

function createLobby() {
    $.post('/app/createLobby', {
        players: {p0: [], p1: [], p2: [], p3: []},
        deck: {played: [], remaining: []},
        turn: 0
    }, (data, status) => {
        alert(data)
        window.location.href = '/app/uno.html';
    })
}