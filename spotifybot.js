"use strict";

let setup = require('./bot_setup.js');

let Botkit = require('botkit');
let Spotify = require('spotify-node-applescript');

let https = require('https');
let os = require('os');
let q = require('q');

var lastTrackId;
var lastVolume = 0;
var channelId;

var controller = Botkit.slackbot({
    debug: false,
});

var bot = controller.spawn({
    token: setup.token
}).startRTM();


var init = () => {
    bot.api.channels.list({}, function(err, response) {
        if(err) {
            throw new Error(err);
        }

        if (response.hasOwnProperty('channels') && response.ok) {
            var total = response.channels.length;
            for (var i = 0; i < total; i++) {
                var channel = response.channels[i];
                if(verifyChannel(channel)) {
                    return;
                }
            }
        }
    });

    bot.api.groups.list({}, function(err, response) {
        if(err) {
            throw new Error(err);
        }

        if (response.hasOwnProperty('groups') && response.ok) {
            var total = response.groups.length;
            for (var i = 0; i < total; i++) {
                var channel = response.groups[i];
                if(verifyChannel(channel)) {
                    return;
                }
            }
        }
    });
};

controller.hears(['^help$'],'direct_message,direct_mention,mention', function(bot, message) {
    bot.reply(message,'You can say these things to me:\n'+
        '\t⦿ *next* – _Fed up with the track? Skip it._\n'+
        '\t⦿ *previous* – _Want to hear that again? Just ask._\n'+
        '\t⦿ *start again* / *over* – _Missed the beginning of the track? No problem._\n'+
        '\t⦿ *volume up* / *down* – _increases / decreases the volume_\n'+
        '\t⦿ *set volume* [1-100] – _sets the volume_\n'+
        '\t⦿ *status* – _I will tell information about the Spotify player_\n'+
        '\t⦿ *info* – _I will tell you about this track_\n'+
        '\t⦿ *detail* – _I will tell you more about this track_\n'+
        '\t⦿ *play* / *pause* – _plays or pauses the music_\n'+
        '\t⦿ *play track* [track name], *play track* [track name] - [artist] – _plays a specific track_\n'+
        '\t⦿ *play track* [track name] | [album] – _plays a specific track in the context of an album. You can add_ - [artist] _to either the track or the album to be more specific_\n'+
        '\t⦿ *play album* [album name], play album [album name] - artist – _plays a specific album_'
        // 'play playlist [playlist name] – plays a specific playlist\n'+
    );
});

controller.hears(['^hello$','^hi$'],'direct_message,direct_mention,mention',function(bot,message) {

    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'radio',
    }, function(err,res) {
        if (err) {
            bot.botkit.log("Failed to add emoji reaction :(",err);
        }
    });


    controller.storage.users.get(message.user,function(err,user) {
        if (user && user.name) {
            bot.reply(message,"Hello " + user.name + "!!");
        }
        else {
            bot.reply(message,"Hello.");
        }
    });
});

controller.hears(['repeat(?: (on|off))?'],'direct_message,direct_mention,mention',function(bot,message) {

    var repeating = true;

    if(message.match && message.match[1]) {
        if(message.match[1] === 'on') {
            repeating = true;
        }
        else if(message.match[1] === 'off') {
            repeating = false;
        }
        else {
            return;
        }
    }

    var repeatingText = repeating ? 'on' : 'off';

    Spotify.setRepeating(repeating, function(err) {
        if(err) {
            bot.reply(message, "Error turning repeat "+repeatingText);
        }
        else {
            bot.reply(message, "Repeat is now "+repeatingText);
        }
    });
    
});

controller.hears(['shuffle(?: (on|off))?'],'direct_message,direct_mention,mention',function(bot,message) {

    var shuffling = true;

    if(message.match && message.match[1]) {
        if(message.match[1] === 'on') {
            shuffling = true;
        }
        else if(message.match[1] === 'off') {
            shuffling = false;
        }
        else {
            return;
        }
    }

    var shufflingText = shuffling ? 'on' : 'off';

    Spotify.setShuffling(shuffling, function(err) {
        if(err) {
            bot.reply(message, "Error turning shuffle "+shufflingText);
        }
        else {
            bot.reply(message, "Shuffle is now "+shufflingText);
        }
    });
    
});

/*
track = {
    artist: 'Bob Dylan',
    album: 'Highway 61 Revisited',
    disc_number: 1,
    duration: 370,
    played count: 0, // don't think this works.
    track_number: 1,
    starred: false,
    popularity: 71,
    id: 'spotify:track:3AhXZa8sUQht0UEdBJgpGc',
    name: 'Like A Rolling Stone',
    album_artist: 'Bob Dylan',
    spotify_url: 'spotify:track:3AhXZa8sUQht0UEdBJgpGc' }
}
*/
controller.hears(['what is this','what\'s this','^info$','^playing$','what is playing','what\'s playing'],'direct_message,direct_mention,mention', function(bot, message) {
    Spotify.getTrack(function(err, track){
        if(track) {
            lastTrackId = track.id;
            bot.reply(message,'This is ' + trackFormatSimple(track) + '!');
        }
    });
});

controller.hears(['^detail$'],'direct_message,direct_mention,mention', function(bot, message) {
    Spotify.getTrack(function(err, track){
        if(track) {
            lastTrackId = track.id;
            getArtworkUrlFromTrack(track, function(artworkUrl) {
                bot.reply(message, trackFormatDetail(track)+"\n"+artworkUrl);
            });
        }
    });
});

controller.hears(['^status$'],'direct_message,direct_mention,mention', function(bot, message) {
    // shuffle, repeat, 
    q.all([checkRunning(), getState(), checkRepeating(), checkShuffling()]).
        then(function(results) {
            var running = results[0],
                state = results[1],
                repeating = results[2],
                shuffling = results[3];

            var reply = "Current status:\n";

            if(running && state) {
                reply += "    Spotify is *running*\n"+
                    "    Repeat: *" + (repeating ? 'On' : 'Off') + "*\n"+
                    "    Shuffle: *" + (shuffling ? 'On' : 'Off') + "*\n"+
                    "    Volume: *" + state.volume + "*\n"+
                    "    Position in track: *" + state.position + "*\n"+
                    "    State: *" + state.state + "*\n";
            }
            else {
                reply += "Spotify is *NOT* running";
            }

            bot.reply(message, reply);
        });
});

controller.hears(['next'],'direct_message,direct_mention,mention', function(bot, message) {
    Spotify.next(function(err, track){
        bot.reply(message, 'Skipping to the next track...');
    });
});

controller.hears(['previous','prev'],'direct_message,direct_mention,mention', function(bot, message) {
    var currentTrack;
    Spotify.getTrack(function(err, track){
        if(track) {
            currentTrack = track.id;

            (function previousTrack() {
                Spotify.previous(function(err, track){
                    Spotify.getTrack(function(err, track){
                        if(track) {
                            if(track.id !== currentTrack) {
                                bot.reply(message, 'Skipping back to the previous track...');
                            }
                            else {
                                previousTrack();
                            }
                        }
                    });
                });
            })();
        }
    });
});

controller.hears(['start (again|over)'],'direct_message,direct_mention,mention', function(bot, message) {
    Spotify.jumpTo(0, function(err, track){
        bot.reply(message, 'Going back to the start of this track...');
    });
});

controller.hears(['^play$','^resume$','^go$'],'direct_message,direct_mention,mention', function(bot, message) {
    Spotify.getState(function(err, state){
        if(state.state == 'playing') {
            bot.reply(message, 'Already playing...');
            return;
        }

        Spotify.play(function(){
            bot.reply(message, 'Resuming playback...');
        });
    });
});


let playTrackRegex = '^play track (.*)$';
controller.hears(playTrackRegex,'direct_message,direct_mention,mention', function(bot, message) {
    // parse play string
    let reg = new RegExp(playTrackRegex);
    let track = reg.exec(message.text)[1];

    var context, artist;

    var contextSplit = track.split('|');
    if(contextSplit.length > 1) {
        // context found
        track = contextSplit[0];
        context = contextSplit[1]; // discard any additional contexts
    }

    var artistSplit = track.split('-');
    if(artistSplit.length > 1) {
        // artist found
        track = artistSplit[0];
        artist = artistSplit[1]; // discard any additional separators
    }

    let promises = [
        searchFor(track+(artist ? ' - '+artist : ''), ['track'])
    ];

    if(context) {
        let contextPromise = searchFor(context, ['album','playlist']).
            then(results => { // update with full album data (including artists)
                var albumIds = results.albums.items.map(album => album.id);
                var deferred = q.defer();
                getAlbumsFromIds(albumIds).then(albums => {
                    results.albums.items = albums;
                    deferred.resolve(results);
                }).
                catch(err => {
                    deferred.reject(err);
                });

                return deferred.promise;
            });

        promises.push(contextPromise);
    }

    q.all(promises).
    then(results => {
        let parsedResult = parseSearchResultsForTrack(results[0], results[1], track, artist, context);
        return parsedResult.length ? parsedResult : q.reject();
    }).
    then(results => {
        if(results.length === 1) {
            return playTrack(results[0]).
                then(ok => {
                    bot.reply(message, 'I couldn\'t find that track on that album, but playing my best guess for the track name anyway...');
                });
        }
        else if(results.length === 2) {
            return playTrack(results[0], results[1]).
                then(ok => {
                    bot.reply(message, 'No problem 👍');
                });
        }
        else {
            return q.reject();
        }
    }).
    catch(err => {
        console.log('Problem playing track: \"'+message.text+'\"', err);
        bot.reply(message, 'Sorry, I\'m having trouble with that request 😢');
    });

});

let playAlbumRegex = '^play album (.*)$';
controller.hears(playAlbumRegex,'direct_message,direct_mention,mention', function(bot, message) {
    // parse play string
    let reg = new RegExp(playAlbumRegex);
    let album = reg.exec(message.text)[1];

    var artist;

    var artistSplit = album.split('-');
    if(artistSplit.length > 1) {
        // artist found
        album = artistSplit[0];
        artist = artistSplit[1]; // discard any additional separators
    }

    searchFor(album+(artist ? ' - '+artist : ''), ['album']).
    then(results => {
        return parseSearchResultsForAlbum(results);
    }).
    then(results => {
        if(results.length === 2) {
            return playTrack(results[0], results[1]).
                then(ok => {
                    bot.reply(message, 'No problem 👍');
                });
        }
        else {
            return q.reject();
        }
    }).
    catch(err => {
        console.log('Problem playing album: \"'+message.text+'\"', err);
        bot.reply(message, 'Sorry, I\'m having trouble with that request 😢');
    });

});

controller.hears(['^stop$','^pause$','^shut up$'],'direct_message,direct_mention,mention', function(bot, message) {
    Spotify.getState(function(err, state){
        if(state.state != 'playing') {
            bot.reply(message, 'Not currently playing...');
            return;
        }

        Spotify.pause(function(){
            bot.reply(message, 'Pausing playback...');
        });
    });
});

controller.hears(['louder( \\d+)?','volume up( \\d+)?','pump it( \\d+)?'],'direct_message,direct_mention,mention', function(bot, message) {
    var increase = message.match ? parseInt(message.match[1], 10) : undefined;
    Spotify.getState(function(err, state){
        var volume = state.volume;

        if(volume == 100) {
            bot.reply(message, 'Already playing at maximum volume!');
            return;
        }

        var newVolume = increase ? volume + increase : volume + 10;
        if(!newVolume) {
            return;
        }
        else if(newVolume > 100) {
            newVolume = 100;
        }

        Spotify.setVolume(newVolume, function(){
            bot.reply(message, `Increased volume from ${volume} to ${newVolume}`);
        });
    });
});

controller.hears(['quieter( \\d+)?','volume down( \\d+)?','turn it down( \\d+)?','shh+( \\d+)?'],'direct_message,direct_mention,mention', function(bot, message) {
    var decrease = message.match ? parseInt(message.match[1], 10) : undefined;
    Spotify.getState(function(err, state){
        var volume = state.volume;

        if(volume == 0) {
            bot.reply(message, 'I can\'t go any lower... (my career as a limbo dancer was a short one)');
            return;
        }

        var newVolume = decrease ? volume - decrease : volume - 10;
        if(!newVolume && newVolume !== 0) {
            return;
        }
        else if(newVolume < 0) {
            newVolume = 0;
        }

        Spotify.setVolume(newVolume, function(){
            bot.reply(message, `Decreased volume from ${volume} to ${newVolume}`);
        });
    });
});

controller.hears('set volume (\\d+)','direct_message,direct_mention,mention', function(bot, message) {
    var volume = message.match ? parseInt(message.match[1], 10) : undefined;
    Spotify.getState(function(err, state){
        var oldVolume = state.volume;

        if(volume !== undefined && volume >= 0 && volume <= 100) {
            Spotify.setVolume(volume, function(){
                bot.reply(message, `Changed volume from ${oldVolume} to ${volume}`);
            });
            return;
        }

        bot.api.reactions.add({
            timestamp: message.ts,
            channel: message.channel,
            name: 'trollface',
        }, function(err,res) {
            if (err) {
                bot.botkit.log("Failed to add emoji reaction :(",err);
            }
        });
        bot.reply(message, 'Volume can be set from 0-100');
    });
});


controller.hears('\\brick ?roll\\b','message,direct_message,direct_mention,mention', function(bot, message) {
    playTrack('spotify:track:4uLU6hMCjMI75M1A2tKUQC').
    then(() => bot.reply(message, ':trollface:'));
});


controller.on('bot_channel_join', function(bot, message) {
    let inviterId = message.inviter;
    let channelId = message.channel;
    var inviter, channel;

    let done = () => {
        if(inviter && channel) {
            inviteMessage(inviter, channel);
            verifyChannel(channel);
        }
    };

    bot.api.channels.info({channel: channelId}, function(err, response) {
        if(response && !err) {
            channel = response.channel;
            done();
        }
    });

    bot.api.users.info({user: inviterId}, function(err, response) {
        if(response && !err) {
            inviter = response.user;
            done();
        }
    });
});

controller.on('bot_group_join', function(bot, message) {
    let inviterId = message.inviter;
    let channelId = message.channel;
    var inviter, channel;

    let done = () => {
        if(inviter && channel) {
            inviteMessage(inviter, channel);
            verifyChannel(channel);
        }
    };

    bot.api.groups.info({channel: channelId}, function(err, response) {
        if(response && !err) {
            channel = response.group;
            done();
        }
    });

    bot.api.users.info({user:  inviterId}, function(err, response) {
        if(response && !err) {
            inviter = response.user;
            done();
        }
    });
});


function inviteMessage(inviter, channel) {
    Spotify.getTrack(function(err, track){
        var nowPlaying;
        let welcomeText = `Thanks for inviting me, ${inviter.name}! Good to be here :)\n`;

        if(track) {
            lastTrackId = track.id;
            getArtworkUrlFromTrack(track, function(artworkUrl) {
                bot.say({
                    text: welcomeText+'Currently playing: '+trackFormatSimple(track),
                    channel: channel.id
                });
            });
        }
        else {
            bot.say({
                text: welcomeText+'There is nothing currently playing',
                channel: channel.id
            });
        }
    });
}


setInterval(() => {
    checkRunning()
    .then(function(running) {
        if(running) {
            checkForTrackChange();
        }
        else {
            if(lastTrackId !== null) {
                bot.say({
                    text: 'Oh no! Where did Spotify go? It doesn\'t seem to be running 😨',
                    channel: channelId
                });
                lastTrackId = null
            }
        }
    });
}, 5000);


function getState() {
    var deferred = q.defer();

    Spotify.getState(function(err, state) {
        if(err || !state) {
            return deferred.resolve(false);
        }

        return deferred.resolve(state);
    });

    return deferred.promise;
}

function checkRunning() {
    var deferred = q.defer();

    Spotify.isRunning(function(err, isRunning) {
        if(err || !isRunning) {
            return deferred.resolve(false);
        }

        return deferred.resolve(true);
    });

    return deferred.promise;
}

function checkShuffling() {
    var deferred = q.defer();

    Spotify.isShuffling(function(err, isShuffling) {
        if(err) {
            return deferred.reject(err);
        }

        return deferred.resolve(isShuffling);
    });

    return deferred.promise;
}

function checkRepeating() {
    var deferred = q.defer();

    Spotify.isRepeating(function(err, isRepeating) {
        if(err) {
            return deferred.reject(err);
        }

        return deferred.resolve(isRepeating);
    });

    return deferred.promise;
}

function checkForTrackChange() {
    Spotify.getTrack(function(err, track) {
        if(track && (track.id !== lastTrackId)) {
            if(!channelId) return;

            lastTrackId = track.id;

            if(setup.muteAds) {
                if(!track.artist) {
                    getState().then(state => {
                        if(lastVolume === 0) { // not currently muting (can't fully mute or playback stops)
                            lastVolume = state.volume;
                            Spotify.setVolume(1, function(){
                                bot.say({
                                    text: `Back soon...`,
                                    channel: channelId
                                });
                            });
                        }
                    });
                    return;
                }
                else {
                    if(lastVolume !== 0) {
                        Spotify.setVolume(lastVolume);
                        lastVolume = 0;
                    }
                }
            }

            getArtworkUrlFromTrack(track, function(artworkUrl) {
                bot.say({
                    text: `Now playing: ${trackFormatSimple(track)}\n${artworkUrl}`,
                    channel: channelId
                });
            });
        }
    });
}


/**
 * Calls Spotify API to search for an item
 * @param {String} query
 * @param {String[]} resultTypes Any of 'track', 'arsit', 'album', 'playlist'
 * @return {Promise} Resolved with successful query response payload
 */
function searchFor(query, resultTypes) {
    let deferred = q.defer();
    let reqUrl = 'https://api.spotify.com/v1/search?limit=50&q='+encodeURIComponent(query)+'&type='+resultTypes.join(',');

    var req = https.request(reqUrl, function(response) {
        var str = '';

        response.on('data', function (chunk) {
            str += chunk;
        });

        response.on('end', function() {
            var json = JSON.parse(str);
            if(json && (json.albums || json.artists || json.tracks || json.playlists)) {
                deferred.resolve(json);
            }
            else {
                deferred.reject('Bad response');
            }
        });
    });
    req.end();

    req.on('error', function(e) {
      console.error(e);
    });

    return deferred.promise;
}


/**
 * Parses the search results for a track (and optionally a context) for the correct URI based on the query text
 * @param {Object} trackResults
 * @param {Object | undefined} contextResults
 * @return {String[]} Array containing the track Uri (and context Uri, if provided)
 */
function parseSearchResultsForTrack(trackResults, contextResults) {
    let result = [];
    if(trackResults.tracks.items.length) {
        if(contextResults) {
            trackResults.tracks.items.some(track => {
                contextResults.albums.items.some(album => {
                    if(track.album.uri === album.uri) {
                        result.push(track.uri);
                        result.push(album.uri);
                        return true;
                    }
                });

                if(result.length) {
                    return true;
                }
            });

            if(result.length) return result;

        }

        result.push(trackResults.tracks.items[0].uri);
    }

    return result;
}


/**
 * Uses the search results to construct an array of the first track on the album's URI and the album's URI
 * @param {Object} albumResults
 * @return {Promise} Resolved with Array containing the track Uri and album Uri
 */
function parseSearchResultsForAlbum(albumResults) {
    return getAlbumsFromIds([albumResults.albums.items[0].id]).
    then(results => {
        return [results[0].tracks.items[0].uri, results[0].uri];
    }).
    catch(err => {
        return q.reject(err);
    });
}


/**
 * Plays a track, optionally within a context
 */
function playTrack(trackUri, contextUri) {
    let deferred = q.defer();

    if(contextUri) {
        Spotify.playTrackInContext(trackUri, contextUri, err => {
            if(err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve(true);
            }
        });
    }
    else {
        Spotify.playTrack(trackUri, err => {
            if(err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve(true);
            }
        });
    }

    return deferred.promise;
}


/**
 * Fetches a list of albums from IDs from the Spotify API
 * @param {String[]} albumIds Array of album IDs
 * @return {Promise} Resolved with array of complete album data
 */
function getAlbumsFromIds(albumIds) {
    let deferred = q.defer();
    let reqUrl = 'https://api.spotify.com/v1/albums?ids='+albumIds.join(',');

    var req = https.request(reqUrl, function(response) {
        var str = '';

        response.on('data', function (chunk) {
            str += chunk;
        });

        response.on('end', function() {
            var json = JSON.parse(str);
            if(json && json.albums && json.albums.length) {
                deferred.resolve(json.albums);
            }
            else {
                deferred.reject('Bad response');
            }
        });
    });
    req.end();

    req.on('error', function(e) {
      console.error(e);
    });

    return deferred.promise;
}


let trackFormatSimple = track => {
    var out = '';
    if(track.name) {
        out += `_${track.name}_`;
        if(track.artist) {
            out += ` by *${track.artist}*`;
        }
    }
    return out;
};

let trackFormatDetail = track => {
    var out = '';
    if(track.name) {
        out += `_${track.name}_`;
        if(track.artist) {
            out += ` by _${track.artist}_`;
        }
        if(track.album) {
            out += ` is from the album *${track.album}*`;
        }
    }
    return out;
};

let getArtworkUrlFromTrack = (track, callback) => {
    let trackId = track.id.split(':')[2];
    let reqUrl = 'https://api.spotify.com/v1/tracks/'+trackId;
    var req = https.request(reqUrl, function(response) {
        var str = '';

        response.on('data', function (chunk) {
            str += chunk;
        });

        response.on('end', function() {
            var json = JSON.parse(str);
            if(json && json.album && json.album.images && json.album.images[1]) {
                callback(json.album.images[1].url);
            }
            else {
                callback('');
            }
        });
    });
    req.end();

    req.on('error', function(e) {
      console.error(e);
    });
};

controller.hears(['uptime','identify yourself','who are you','what is your name'],'direct_message,direct_mention,mention',function(bot,message) {
    var hostname = os.hostname();
    var uptime = formatUptime(process.uptime());

    bot.reply(message,':robot_face: I am a bot named <@' + bot.identity.name +'>. I have been running for ' + uptime + ' on ' + hostname + ".");
});

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit +'s';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}

function verifyChannel(channel) {
    if(channel && channel.name && channel.id && setup.channel && channel.name == setup.channel) {
        channelId = channel.id;
        console.log('** ...chilling out on #' + channel.name);
        return true;
    }

    return false;
}

init();
