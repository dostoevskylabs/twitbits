/**
 * Twitbit - Twitter DM Bot
 *
 * Used to quickly save tidbits of information you want to catalogue for later
 *
 * @author Elijah Seymour
 */
const TwitPackage = require('twit');
const lowdb = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('db.json');
const db = lowdb(adapter);
const secret =  {
  "consumer_key": "",
  "consumer_secret": "",
  "access_token": "",
  "access_token_secret": ""
};
const T = new TwitPackage(secret);
const Twitter = T.stream('user');
db.defaults({ users:['dostoevskylabs'], entries: [] })
  .write();
// ACL for users allowed to use this DM bot.
let users = db.get('users').value();
// DM Received
Twitter.on('direct_message', function(event){
  let username = event["direct_message"]["sender_screen_name"];
  let userid = event["direct_message"].sender_id_str
  let raw_message = event["direct_message"]["text"].split(" ");
  let message = [];
  let tags = [];
  // loop through the user_mentions object array
  // we have to use this because twitter has a security mechanism in place
  // that will stop the ability to send tags in direct messages if you send too many
  for ( let i = 0; i < event["direct_message"]["entities"]["user_mentions"].length; i++ ) {
    tags.push(event["direct_message"]["entities"]["user_mentions"][i].screen_name);
  }  
  // User is not in our ACL, gtfo
  if ( !users.includes(username) ) return false;
  // Remove the command and the tags (which are actually mentions) from the message we will store
  raw_message.forEach(function(word){
   if ( word.indexOf(".") === -1 && word.indexOf("@") === -1 ) message.push(word);
  });
  let cmd = raw_message[0];
  // Command Controller
  const commands = {
    /**
     * Help
     */
    ".h":function(){
      sendDM(T, userid, `[bot] usage: .a #tags example\n1) .a @tag1 @tag2 text - add tidbit\n2) .t - list tags\n3) .s @tag1 @tag2 - search tidbits for tags\n4) .d id - delete tidbit by id`);
    },
    /**
     * Tags
     */
    ".t":function(){
      // get tags created boy our username
      let entries = db.get('entries')
                  .filter({ username: username })
                  .value();
      let composedTags = "";
      entries.forEach(function(entry){
        entry["tags"].forEach(function(tag){
          // only display unique tags
          if ( composedTags.indexOf(tag) === -1 ) {
            composedTags += `@${tag} `
          }
        });
      });
      if ( composedTags !== "" ) {
        sendDM(T, userid, `[bot] Tags: ${composedTags}`);
      }
    },
    /**
     * Add
     */
    ".a":function(){
      // add our new entry to the database
      let url = [];
      for ( let i = 0; i < event["direct_message"]["entities"]["urls"].length; i++ ) {
        url.push(event["direct_message"]["entities"]["urls"][i]["expanded_url"]); 
      }
      db.get('entries')
        .push({
          userid:userid,
          username:username,
          message:message.join(" "),
          tags:tags,
          link: url[0]
        })
        .write();
      sendDM(T, userid, `[bot] Got it, ${username}`);
    },
    /**
     * Search
     */
    ".s":function(){
      // find an entry that matches our tags, and our username
      let result = db.get('entries')
                    .filter({ username: username, tags: tags })
                    .value();
      if ( result.length === 0 ) { // no results!
        sendDM(T, userid, "[bot] No twitbits found! Try adding some.");
      } else {
        let composedMessage = "";
        let i = 1;
        result.forEach(function(entry){
          let link = ( entry.link != undefined ? ` ${entry.link}` : "");
          if ( entry.message === "" && link === "" ) return false;
          composedMessage += `${i}) ${entry.message}${link}\n`;
          i++;
        });
        sendDM(T, userid, `[bot] twitbits found:\n${composedMessage}`);       
      }
    }
  };
  if ( typeof commands[cmd] !== "function" ) return false; // command invalid
  return commands[cmd](); // trigger command
  /**
   * Helper function to send direct messages
   */
  function sendDM(T, userid, message){
    T.post('direct_messages/new', {
      user_id: userid,
      text: message
    });
  }
});
// error
Twitter.on('error', function(error){
  console.log(error);
});
