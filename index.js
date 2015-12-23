"use strict";

process.env['token'] = 'xoxb-17278136419-2Bw1xrm43erTotinXiZwFR1U';

let Botkit = require('botkit');
let Spotify = require('spotify-node-applescript');

var os = require('os');

var lastTrackId;

var controller = Botkit.slackbot({
  debug: false,
});

var bot = controller.spawn(
  {
    token:process.env.token
  }
).startRTM();

controller.hears(['help'],'direct_message,direct_mention,mention', function(bot, message) {
    bot.reply(message,'You can say these things to me:\nhello - I will greet you back\ninfo - I will tell you about this track\ndetail - I will tell you more about this track\nnext - Fed up with the track? Skip it.');
});

controller.hears(['hello','hi'],'direct_message,direct_mention,mention',function(bot,message) {

  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'radio',
  },function(err,res) {
    if (err) {
      bot.botkit.log("Failed to add emoji reaction :(",err);
    }
  });


  controller.storage.users.get(message.user,function(err,user) {
    if (user && user.name) {
      bot.reply(message,"Hello " + user.name + "!!");
    } else {
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


setInterval(() => {
    Spotify.getTrack(function(err, track) {
        if(track && (track.id !== lastTrackId)) {
            lastTrackId = track.id;
            bot.say({
                text: 'Now playing: ' + trackFormatSimple(track) + ' (' + track['played_count'] + ' plays)',
                channel: 'C0H87SG2V' // #jukebox (unless this changes)
            });
        }
    });
}, 5000);

let trackFormatSimple = (track) => `_${track.name}_ by *${track.artist}*`;
let trackFormatDetail = (track) => `_${track.name}_ by _${track.artist}_ is from the album *${track.album}*\nIt has been played ${track['played_count']} time(s).`;

// controller.hears(['call me (.*)'],'direct_message,direct_mention,mention',function(bot,message) {
//   var matches = message.text.match(/call me (.*)/i);
//   var name = matches[1];
//   controller.storage.users.get(message.user,function(err,user) {
//     if (!user) {
//       user = {
//         id: message.user,
//       }
//     }
//     user.name = name;
//     controller.storage.users.save(user,function(err,id) {
//       bot.reply(message,"Got it. I will call you " + user.name + " from now on.");
//     })
//   })
// });

// controller.hears(['what is my name','who am i'],'direct_message,direct_mention,mention',function(bot,message) {

//   controller.storage.users.get(message.user,function(err,user) {
//     if (user && user.name) {
//       bot.reply(message,"Your name is " + user.name);
//     } else {
//       bot.reply(message,"I don't know yet!");
//     }
//   })
// });


// controller.hears(['shutdown'],'direct_message,direct_mention,mention',function(bot,message) {

//   bot.startConversation(message,function(err,convo) {
//     convo.ask("Are you sure you want me to shutdown?",[
//       {
//         pattern: bot.utterances.yes,
//         callback: function(response,convo) {
//           convo.say("Bye!");
//           convo.next();
//           setTimeout(function() {
//             process.exit();
//           },3000);
//         }
//       },
//       {
//         pattern: bot.utterances.no,
//         default:true,
//         callback: function(response,convo) {
//           convo.say("*Phew!*");
//           convo.next();
//         }
//       }
//     ])
//   })
// })


controller.hears(['uptime','identify yourself','who are you','what is your name'],'direct_message,direct_mention,mention',function(bot,message) {

  var hostname = os.hostname();
  var uptime = formatUptime(process.uptime());

  bot.reply(message,':robot_face: I am a bot named <@' + bot.identity.name +'>. I have been running for ' + uptime + ' on ' + hostname + ".");

})

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