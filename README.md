## Spotify bot

A very small script to control Spotify (on a Mac) from Slack, using a bot.

### Setup

#### Create your bot

Log into Slack website, then: Apps -> Build your own -> Custom Integration -> Bots.

Name your bot "Spotify" or whatever you like. Copy the key Slack gives you.

#### Configure your bot

Create a file named `bot_setup.js` and populate it with:

```javascript
module.exports = {
  token: 'your slack bot token here',
  channel: 'channel name (no #)' // optional, for posting track updates
};
```

#### Install the required dependencies

    npm install

#### Boot up your new bot

    node spotifybot.js

In Slack, invite the bot to a channel (`/invite @bot_name`) and now you can talk to it.

Type `@bot_name help` to get a list of commands

#### Keep your bot running as a background service

On OS X, background services are either LaunchAgents or LaunchDaemons.
SpotifySlackBot can only run while a user is logged in, since it depends
on the Spotify GUI app being open, so the appropriate type of service
here is a LaunchAgent.

First, edit `spotifybot.launchagent.plist` and change `BOT_HOME` to
the **full path** of your bot's directory, e.g.
`/Users/jm3/code/spotifyslackbot` or the like.

Install the launchAgent by copying it to the required location:

    cp spotifybot.launchagent.plist ~/Library/LaunchAgents/

If you care about logging (and who doesn't), create two empty logfiles, owned by you:

    sudo touch /var/log/spotify.slackbot.out.log /var/log/spotify.slackbot.err.log
    sudo chown `whoami` /var/log/spotify.slackbot.out.log /var/log/spotify.slackbot.err.log

Finally, launch your background service for the first time (it will now auto-start upon login)

    launchctl load ~/Library/LaunchAgents/spotifybot.launchagent.plist


### Upgrading

If you are lagging behind on an old version of SpotifySlackBot, use the following steps to upgrade:

If you are running the bot as a background service, stop it with

    launchctl unload ~/Library/LaunchAgents/spotifybot.launchagent.plist

Otherwise, just stop the script as you would normally.

Pull the latest version from github

    git pull origin

Update the npm dependencies

    npm install

You're all set! Restart from the command line, or using this command to start again as a background service

    launchctl load ~/Library/LaunchAgents/spotifybot.launchagent.plist