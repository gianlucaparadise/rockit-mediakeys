// ==UserScript==
// @name         Rockit MediaKeys
// @namespace    https://github.com/gianlucaparadise/rockit-mediakeys/blob/master/rockit-mediakeys.js
// @version      0.1
// @description  Rende compatibile MediaKeys (http://sway.fm) con il player nelle recensioni di Rockit.it
// @author       Gianluca Paradiso
// @match        http://www.rockit.it/recensione/*
// @grant        none
// @require      https://s3.amazonaws.com/SwayFM/UnityShim.js
// ==/UserScript==

var enableLogging = true;

function logg(text) {
    if (enableLogging)
    {
        console.log(text);
    }
}

function play(track) {
    $(".play a", track).click();
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
    
    var imgSrc = $(".box-disco .box-img img")[0].src;
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
