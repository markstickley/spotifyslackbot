"use strict";

let setup = require('./bot_setup.js');

let Botkit = require('botkit');
let Spotify = require('spotify-node-applescript');

var os = require('os');

var lastTrackId;
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

controller.hears(['help'],'direct_message,direct_mention,mention', function(bot, message) {
    bot.reply(message,'You can say these things to me:\nhello - I will greet you back\ninfo - I will tell you about this track\ndetail - I will tell you more about this track\nnext - Fed up with the track? Skip it.');
});

controller.hears(['hello','hi'],'direct_message,direct_mention,mention',function(bot,message) {

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

/*
track = {
    artist: 'Bob Dylan',
    album: 'Highway 61 Revisited',
    disc_number: 1,
    duration: 370,
    played count: 0,
    track_number: 1,
    starred: false,
    popularity: 71,
    id: 'spotify:track:3AhXZa8sUQht0UEdBJgpGc',
    name: 'Like A Rolling Stone',
    album_artist: 'Bob Dylan',
    spotify_url: 'spotify:track:3AhXZa8sUQht0UEdBJgpGc' }
}
*/
controller.hears(['what is this','what\'s this','info','playing','what is playing','what\'s playing'],'direct_message,direct_mention,mention', function(bot, message) {
    Spotify.getTrack(function(err, track){
        if(track) {
            lastTrackId = track.id;
            bot.reply(message,'This is ' + trackFormatSimple(track) + '!');
        }
    });
});

controller.hears(['detail'],'direct_message,direct_mention,mention', function(bot, message) {
    Spotify.getTrack(function(err, track){
        if(track) {
            lastTrackId = track.id;
            bot.reply(message, trackFormatDetail(track));
        }
    });
});

controller.hears(['next'],'direct_message,direct_mention,mention', function(bot, message) {
    Spotify.next(function(err, track){
        bot.reply(message, 'Skipping to the next track...');
    });
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

        if(track) {
            lastTrackId = track.id;
            nowPlaying = 'Currently playing: '+trackFormatSimple(track);
        }
        else {
            nowPlaying = 'There is nothing currently playing';
        }

        bot.say({
            text: `Thanks for inviting me, ${inviter.name}! Good to be here :)\n${nowPlaying}`,
            channel: channel.id
        });
    });
}


setInterval(() => {
    Spotify.getTrack(function(err, track) {
        if(track && (track.id !== lastTrackId)) {
            if(!channelId) return;

            lastTrackId = track.id;

            bot.say({
                text: 'Now playing: ' + trackFormatSimple(track) + ' (' + track['played_count'] + ' plays)',
                channel: channelId
            });
        }
    });
}, 5000);

let trackFormatSimple = (track) => `_${track.name}_ by *${track.artist}*`;
let trackFormatDetail = (track) => `_${track.name}_ by _${track.artist}_ is from the album *${track.album}*\nIt has been played ${track['played_count']} time(s).`;


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