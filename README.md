## Spotify bot

A very small script to allow Slack to control the Spotify app running on a Mac via a bot.

### Setup

#### Create your bot

Log into Slack website, then: Apps -> Build your own -> Custom Integration -> Bots.

Name your bot "Spotify" or whatever you like. Copy the key Slack gives you.

#### Configure your bot:

Create a file named `bot_setup.js` and populate it with:

```
module.exports = {
  token: 'your slack bot token here',
  channel: 'channel name (no #)' // optional for track updates - if you can't find the channel id just leave this out
};
```

#### Install the required dependencies

`npm install`

#### Boot up your new bot:

`node spotifybot.js`

In Slack, invite the bot to a channel (`/invite @bot_name`) and now you can talk to it.

Type `@bot_name help` to get a list of commands
