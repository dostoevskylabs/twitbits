var TwitPackage = require('twit');
var lowdb = require('lowdb');
var FileSync = require('lowdb/adapters/FileSync');
var adapter = new FileSync('db.json');
const db = lowdb(adapter);
db.defaults({ users:['dostoevskylabs'], entries: [] })
  .write();
var secret =  {
  "consumer_key": "YOUR_CONSUMER_KEY",
  "consumer_secret": "YOUR_CONSUMER_SECRET",
  "access_token": "YOUR_ACCESS_TOKEN",
  "access_token_secret": "YOUR_ACCESS_SECRET"
};
var T = new TwitPackage(secret);
var Twitter = T.stream('user');
Twitter.on('direct_message', function(event){
  var users = db.get('users').value();
  var username = event["direct_message"]["sender_screen_name"];
  var userid = event["direct_message"].sender_id_str
  var raw_message = event["direct_message"]["text"].split(" ");
  var message = [];
  if ( !users.includes(username) ) return false;
  raw_message.forEach(function(word){
   if ( word.indexOf("/") === -1 && word.indexOf("#") === -1 ) message.push(word);
  });
  var cmd = raw_message[0];
  var commands = {
    "/h":function(){
      // send available commands
      T.post('direct_messages/new', {
       user_id: userid,
       text: `[Twitbit] usage: /a #tags example\n1) [a] #tags text - add tidbit\n2) [t] - list tags\n3) [s] #tags - search tidbits for tags\n4) [d] id - delete tidbit by id`
      });
    },
    "/t":function(){
      let entries = db.get('entries')
                  .filter({ username: username })
                  .value();
      let composedTags = "";
      entries.forEach(function(entry){
        entry["tags"].forEach(function(tag){
          if ( composedTags.indexOf(tag) === -1 ) {
            composedTags += `#${tag} `
          }
        });
      });
      if ( composedTags !== "" ) {
        T.post('direct_messages/new', {
          user_id: userid,
          text: `[Twitbit] Tags: ${composedTags}`
        });
      }
    },
    "/a":function(){
      let tags = [];
      for ( let i = 0; i < event["direct_message"]["entities"]["hashtags"].length; i++ ) {
        tags.push(event["direct_message"]["entities"]["hashtags"][i].text);
      }
      db.get('entries')
        .push({
          userid:userid,
          username:username,
          message:message,
          tags:tags
        })
        .write();
      T.post('direct_messages/new', {
       user_id: userid,
       text: `[Twitbit] Got it, ${username}`
      });            
    },
    "/s":function(){
      let tags = [];
      for ( let i = 0; i < event["direct_message"]["entities"]["hashtags"].length; i++ ) {
        tags.push(event["direct_message"]["entities"]["hashtags"][i].text);
      }
      let result = db.get('entries')
                    .filter({ username: username, tags: tags })
                    .value();
      if ( result.length === 0 ) {
        T.post('direct_messages/new', {
         user_id: userid,
         text: "[Twitbit] No twitbits found! Try adding some."
        }); 
      } else {
        let composedMessage = "";
        let i = 1;
        result.forEach(function(entry){
          composedMessage += `${i}) ${entry.message}\n`;
          i++;
        });
        if ( composedMessage !== "" ) {
          T.post('direct_messages/new', {
           user_id: userid,
           text: `[Twitbit] twitbits found:\n${composedMessage}`
          });         
        }
      }
    }
  };
  if ( typeof commands[cmd] !== "function" ) return false;
  return commands[cmd]();
});
Twitter.on('error', function(error){
  console.log(error);
});
