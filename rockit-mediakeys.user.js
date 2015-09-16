// ==UserScript==
// @name         Rockit MediaKeys
// @namespace    https://github.com/gianlucaparadise/rockit-mediakeys/blob/master/rockit-mediakeys.js
// @version      0.2
// @description  Rende compatibile MediaKeys (http://sway.fm) con il player nelle recensioni di Rockit.it
// @author       Gianluca Paradiso
// @match        http://www.rockit.it/recensione/*
// @grant        none
// @require      https://s3.amazonaws.com/SwayFM/UnityShim.js
// ==/UserScript==

var enableLogging = false;
var enableNotifications = true;

var imgSrc;

function showNotification(theBody, theTitle, theIcon) {
    var options = {
        body: theBody,
        icon: theIcon
    }
    
    var n = new Notification(theTitle,options);
    setTimeout(n.close.bind(n), 4000);
}

function notify(theBody, theTitle, theIcon) {
    if (!enableNotifications) return;
    
    // Preso da MDN: https://developer.mozilla.org/en-US/docs/Web/API/notification#Example
    // Let's check if the browser supports notifications
    if (!("Notification" in window)) {
        logg("This browser does not support desktop notification");
        return;
    }
    
    // Let's check whether notification permissions have already been granted
    if (Notification.permission === "granted") {
        // If it's okay let's create a notification
        showNotification(theBody, theTitle, theIcon);
    }

    // Otherwise, we need to ask the user for permission
    else if (Notification.permission !== 'denied') {
        Notification.requestPermission(function (permission) {
            // If the user accepts, let's create a notification
            if (permission === "granted") {
                showNotification(theBody, theTitle, theIcon);
            }
        });
    }

    // At last, if the user has denied notifications, and you 
    // want to be respectful there is no need to bother them any more.
}

function logg(text) {
    if (enableLogging)
    {
        console.log(text);
    }
}

function play(track) {
    var message = $(".title", track).text();
    if (track.hasClass("playing")) message = "In pausa: " + message;
    else if (track.hasClass("paused")) message = "In riproduzione: " + message;
    
    $(".play a", track).click();
    
    logg(message);
    notify(message, 'Rockit MediaKeys', imgSrc);
}

var unity = UnityMusicShim();
unity.setSupports({
    playpause: true,
    next: true,
    previous: true
});
var playerState;

function sendState(isPlaying, thisTrack, artist, albumArt) {
    //logg("Invio stato. \nPlaying: " + isPlaying + "\nTitle: " + $(".title", thisTrack).text() + "\nArtist: " + artist);
    playerState = {
        playing: isPlaying,
        title: $(".title", thisTrack).text(),
        artist: artist,
        albumArt: albumArt,
    };
    unity.sendState(playerState);
}

$(function() {
    logg("Rockit MediaKeys caricato!");
    
    // Controllo se ho un solo player
    if ($(".elenco-brani.griglia").length < 1)
    {
        logg("Nessun Player trovato.");
        return;
    }
    
    if ($(".elenco-brani.griglia").length > 1)
    {
        logg("Trovato più di un player.");
        return;
    }
    
    var rockitPlayer = $(".elenco-brani.griglia");
    var track;
    
    imgSrc = $(".box-disco .box-img img")[0].src;
    var artistName = $("a.nome-artista").eq(0).text();
    
    unity.setCallbackObject({
        pause: function() {
            track = $("li[itemprop=track].paused", rockitPlayer); // Cerco una traccia in pausa
            if (track.length > 0)
            {
                logg("Trovata traccia in pausa. Premo play.");
                
                sendState(true, track, artistName, imgSrc);
                play(track);
                return;
            }
            
            track = $("li[itemprop=track].playing", rockitPlayer); // Cerco una traccia in play
            if (track.length > 0)
            {
                logg("Trovata traccia in play. Premo pausa");
                
                sendState(false, track, artistName, imgSrc);
                play(track);
                return;
            }
            
            logg("Nessuna traccia in play trovata: riproduco la prima.");
            
            track = $("li[itemprop=track]", rockitPlayer).eq(0);
            // Cerco la prima traccia riproducibile
            while(track.find("li.play").hasClass("off"))
            {
                track = track.next();
                if (track.length === 0)
                {
                    logg("Nessuna traccia riproducibile trovata.");
                    return;
                }
            }
            
            sendState(true, track, artistName, imgSrc);
            play(track);
        },
        next: function() {
            track = $("li[itemprop=track].paused", rockitPlayer); // Cerco una traccia in pausa
            if (track.length === 0)
            {   
                track = $("li[itemprop=track].playing", rockitPlayer); // Cerco una traccia in play
                
                if (track.length === 0)
                {
                    logg("Nessuna traccia attiva trovata.");
                    return;
                }
            }
            
            // Cerco la prima traccia riproducibile
            do
            {
                track = track.next();
                if (track.length === 0)
                {
                    logg("Sto riproducendo l'ultima traccia dell'album.");
                    return;
                }
            } while(track.find("li.play").hasClass("off"));
            
            logg("Riproduco la prossima traccia.");
            
            sendState(true, track, artistName, imgSrc);
            play(track);
        },
        previous:function() {
            track = $("li[itemprop=track].paused", rockitPlayer); // Cerco una traccia in pausa
            if (track.length === 0)
            {   
                track = $("li[itemprop=track].playing", rockitPlayer); // Cerco una traccia in play
                
                if (track.length === 0)
                {
                    logg("Nessuna traccia attiva trovata.");
                    return;
                }
            }
            
            // Cerco la prima traccia riproducibile
            do
            {
                track = track.prev();
                if (track.length === 0)
                {
                    logg("Sto riproducendo la prima traccia dell'album.");
                    return;
                }
            } while(track.find("li.play").hasClass("off"));
            
            logg("Riproduco la traccia precedente.");
            
            sendState(true, track, artistName, imgSrc);
            play(track);
        }
    });
    
    // Creo l'observer per vedere quando viene cambiata la traccia
    var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
    var playerList = document.querySelector(".elenco-brani.griglia ul");

    var observer = new MutationObserver(function(mutations) {  
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes') {
                track = $(mutation.target);
                //logg("Mutazione! ");
                //logg(track);
                
                if (track.attr("itemprop") == "track" && track.hasClass("item"))
                {
                    logg("Una traccia ha cambiato stato!");
                    sendState(track.hasClass("playing"), track, artistName, imgSrc);
                }
            }
        });
    });

    observer.observe(playerList, {
        attributes: true, 
        childList: false, 
        characterData: false,
		subtree: true,
		attributeFilter: ['class']
    });
    
    // Mi serve fare il primo sendState a true altrimenti il plugin non parte
    sendState(true, [], artistName, imgSrc);
    sendState(false, [], artistName, imgSrc); // Faccio apparire album e artista.
});
