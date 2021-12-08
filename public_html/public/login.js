/**
 * Author: Eric Mendoza (ericmendoza@email.arizona.edu)
 * Author: Luke Ramirez (lucasxavier@email.arizona.edu)
 * File: login.js
 * Assignment: Final Project
 * Course: CSc 337; Fall 21
 * Purpose: handles the landing page requests
 */
/**
 * simple login post request using jquery
 */
 function login() {
    $.post('/login',
    {
        username: $('#usernameLogin').val(),
        password: $('#passwordLogin').val()
    },
    (data) => {
        if (data == -1) {
            alert("Invalid Username or Password");
        } else {
            alert("Logged In");
            window.location.href = '/app/lobby.html';
        }
    });
}

/**
 * simple account creation post request using jquery
 */
function createUser() {
    $.post('/createUser', 
    {
        username: $('#username').val(),
        password: $('#password').val()
    },
    (data) => { alert(data) });
}