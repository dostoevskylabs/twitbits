/**
 * Twitbit - Twitter DM Bot
 *
 * save tidbits of information you want to catalogue for later
 *
 * @author Elijah Seymour
 */
const TwitPackage = require('twit');
const lowdb = require('lowdb');
const shortid = require('shortid')
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
  let userid = event["direct_message"].sender_id_str;
  let message = event["direct_message"]["text"].split(" ");
  let tags = [];
  // loop through the hashtags object array
  for ( let i = 0; i < event["direct_message"]["entities"]["hashtags"].length; i++ ) {
    tags.push(event["direct_message"]["entities"]["hashtags"][i].text);
  }  
  // User is not in our ACL, gtfo
  if ( !users.includes(username) ) return false;
  // break the anatomy of the string up int multiple parts
  // [cmd] ['each', 'word', 'of', 'message']
  // remove tags entirely as there is a tags array already
  let cmd = message[0];
  let localizedMessage = [];
  // Remove the command and the tags (which are actually mentions) from the message we will store
  message.forEach(function(word){
   if ( word.indexOf(".") === -1 && word.indexOf("#") === -1 ) localizedMessage.push(word);
  });
  // Command Controller
  const commands = {
    /**
     * Help
     */
    ".h":function(){
      sendDM(T, userid, `[info] a list of commands you can use\nthe database is specific to you and no one can see what you save\n1) .a #tag1 #tag2 text - add tidbit\n2) .t - list tags\n3) .s #tag1 #tag2 - search tidbits for tags\n4) .d id - delete tidbit by id`);
    },
    /**
     * Tags
     */
    ".t":function(){
      // get tags created boy our username
      let entries = db.get('entries')
                  .filter({ username: username })
                  .value();
      let localizedTags = [];
      entries.forEach(function(entry){
        entry["tags"].forEach(function(tag){
          // only display unique tags
          if ( localizedTags.indexOf(tag) === -1 ) localizedTags.push(`#${tag}`);
        });
      });
      if ( localizedTags.length > 0 ) {
        sendDM(T, userid, `[info] Tags: ${localizedTags.join(", ")}`);
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
          id:shortid.generate(),
          userid:userid,
          username:username,
          message:localizedMessage.join(" "),
          tags:tags,
          link: url[0] // temporarily
        })
        .write();
      sendDM(T, userid, `[info] Got it, ${username}`);
    },
    /**
     * Delete
     */
    ".d":function(){
      db.get('entries')
        .remove({ id: localizedMessage[0] })
        .write();
      sendDM(T, userid, `[info] Deleted ${localizedMessage[0]}`);
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
        sendDM(T, userid, "[info] No twitbits found! Try adding some.");
      } else {
        let localizedMessage = [];
        result.forEach(function(entry){
          let link = ( entry.link != undefined ? ` ${entry.link}` : "");
          if ( entry.message === "" && link === "" ) return false;
          localizedMessage.push(`[${entry.id}] ${entry.message}${link}`);
        });
        sendDM(T, userid, `[info] twitbits found:\n${localizedMessage.join("\n")}`);       
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
