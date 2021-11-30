/**
 * Author: Eric Mendoza (ericmendoza@email.arizona.edu)
 * Author: Luke Ramirez (lucasxavier@email.arizona.edu)
 * File: server.js
 * Assignment: Final Project
 * Course: CSc 337; Fall 21
 * Purpose: 
 */
 function login() {
    $.post('/login',
    {
        username: $('#usernameLogin').val(),
        password: $('#passwordLogin').val()
    },
    (data) => {
        if (data == -1) {
            alert("Unknown User");
        } else {
            alert("Logged In");
            window.location.href = '/app/lobby.html';
        }
    });
}

function createUser() {
    $.post('/createUser', 
    {
        username: $('#username').val(),
        password: $('#password').val()
    },
    (data) => {
        alert(data)
    });
}