Deno.serve((req) => new Response("Hello World"));


import { Client, GatewayIntentBits } from "npm:discord.js@latest";
import cron from "npm:node-cron";
import moment from "npm:moment-hijri";
import Calendar from "npm:date-bengali-revised";

// Initialize Deno KV
const kv = await Deno.openKv();


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

const TOKEN = Deno.env.get("TOKEN");
const logChannelId =  Deno.env.get("VC_LOG_CHANNEL");

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

Deno.cron("sample cron", "* * * * *", () => {
  const channel = client.channels.cache.get("1241435335641268304");
  if (channel) {
    channel.send(new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' }));
  }
});




async function dynamicFetch(apiParam, objectKey) {
    const url = `https://api.api-ninjas.com/v1/${apiParam}`;
    const apiKey =  Deno.env.get("APIKEY");;
    const apiPostChannel = Deno.env.get("API_POST_CHANNEL");
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Api-Key': apiKey
            }
        });
        const data = await response.json();

        let msgData = {};
        objectKey.forEach(key => {
            if (key === 'answer') {
                msgData[key] = `||${data[0][key]}||`;
            } else if (key === 'title') {
                msgData[key] = `**_${data[0][key]}_**`;
            }
            else {
                msgData[key] = data[0][key];
            }
        });
        // Plural to Singular and First letter uppercase
        const toUppercase = apiParam.charAt(0).toUpperCase() + apiParam.slice(1, apiParam.length - 1);

        const message = `**${toUppercase}** - ${Object.values(msgData).join(' - ')}`;
        const channel = client.channels.cache.get(apiPostChannel);
        if (channel) {
            channel.send(message);
        }
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}



client.once('ready', () => {
    console.log(`cron job started`);

    cron.schedule('* */12 * * *', () => {
        dynamicFetch('quotes', ['quote', 'author']);
        dynamicFetch('jokes', ['joke']);
        dynamicFetch('dadjokes', ['joke']);
        dynamicFetch('facts', ['fact']);
        dynamicFetch('riddles', ['title', 'question', 'answer']);
    });

    // Schedule a task to run at 6 AM every day
    cron.schedule('0 6 * * *', () => {
        const today = new Date();
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const bar = days[today.getDay()];
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        const monthName = monthNames[today.getMonth()];
        const formattedDate = `${day}/${monthName}/${year}`;
        const gregToday = `${bar} ${formattedDate}`;

        // HIJRI date + fixed for Bangladesh, 1 day behind Saudi Arabia / Middle Eastern Countries. 
        let yesterday = new Date(today.getTime() - (1000 * 60 * 60 * 24));
        function getTodaysArabicDay() {
            const weekdays = ["الاحد", "الاثنين", "الثلاثاء", "الاربعاء", "الخميس", "الجمعة", "السبت"];
            return yesterday.getDay() === 6 ? weekdays[0] : weekdays[yesterday.getDay() + 1];
        }
        const todaysArabicDay = getTodaysArabicDay();
        const hijri = moment(yesterday).format('iD/iMMM/iYYYY');
        const hijriToday = `${todaysArabicDay} ${hijri}`;

        // BANGLA date
        let cal = new Calendar();
        cal.fromDate(today);
        const bongabdo = cal.format('dddd D MMMM, Y');

        // Combine all dates into one message
        const message = `## ${gregToday}\n## ${bongabdo}\n## ${hijriToday}`;

        // Send the message to a specific channel
        const channel = client.channels.cache.get(logChannelId);
        if (channel) {
            channel.send(message);
        }
    }, {
        timezone: "Asia/Dhaka"
    });
});


client.on("voiceStateUpdate", async (oldState, newState) => {
  const logChannel = await client.channels.fetch(logChannelId);
  if (!logChannel) return;

  const member = newState.member;
  const displayName = member.user.displayName;

  const currentTime = new Date();
  currentTime.setHours(currentTime.getHours() + 6);
  
  const time = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  // Ensure the channel has changed
  if (oldState.channelId !== newState.channelId) {
    if (!oldState.channel && newState.channel) {
      // User joined a voice channel
      await kv.set([`${displayName}`], currentTime.toISOString());
      logChannel.send(
        `**${displayName}** has joined **${newState.channel.name}** at ${time}`
      );
    } else if (oldState.channel && !newState.channel) {
      // User left a voice channel
      const joinTimeEntry = await kv.get([`${displayName}`]);
      if (joinTimeEntry) {
        const joinTime = new Date(joinTimeEntry.value);
        const leaveTime = currentTime;
        const sessionTime = new Date(leaveTime - joinTime)
          .toISOString()
          .substr(11, 8);
        logChannel.send(
          `**${displayName}** has left **${oldState.channel.name}** at ${time} (session time ${sessionTime})`
        );
        await kv.delete([`${displayName}`]);
      } else {
        logChannel.send(
          `**${displayName}** has left **${oldState.channel.name}** at ${time}`
        );
      }
    }
  }
});

client.login(TOKEN);
