Spotify bot
===========

This is a very small script to allow Slack to control the Spotify app running on a Mac via a bot.


Setup
-----

Create a new bot in your Slack preferences (Apps -> Build your own -> Custom Integration -> Bots). Call it Spotify or whatever you like. Copy the key you are given.

Create a file called bot_setup.js and fill it with these contents:

```
module.exports = {
  token: 'your token goes here',
  channel: 'channel name (no #)' // optional for track updates - if you can't find the channel id just leave this out
}
```

Run node spotifybot.js

In Slack, invite the bot to a channel (/invite @bot_name) and now you can talk to it.

Type @bot_name help to get a list of commands