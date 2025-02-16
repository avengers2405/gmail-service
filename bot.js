// const bot = new TelegramBot(process.env.NEXT_PUBLIC_TELEGRAM_TOKEN as string, {polling: true});

// bot.on('message', async (msg: Message) =>{
//     const chatID: number = msg.chat.id;
//     const messageText: string= msg.text as string;

//     console.log('chatID: ', chatID);

//     if (messageText.startsWith('/start')){
//         bot.sendMessage(chatID, 'enter ? <no of mails> to get result.');
//     }

//     if (messageText.startsWith('?')){
//         const info =messageText.split(' ');
//         if (info.length>1 && info[1].toUpperCase()==info[1].toLowerCase()){
//             const data_raw = await getRecentEmails(oauth2Client, info[1] as unknown as number);
//             // console.log('msg to be sent: ', data.map(element => element[0]+'\r\n'+element[1]).join('\r\n'));
//             // console.log('HEREREEEREEEEEEEEEEEEEEEEE');
//             for (var i=0; i<(info[1] as unknown as number); i+=5){
//                 const data = data_raw.slice(i, i+5);
//                 bot.sendMessage(chatID, `${data.map(element => '*'+(element[0]??'').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')+'*'+'\r\n'+(element[1]??'').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')).join('\r\n\n')}`, { parse_mode: "MarkdownV2" });            }
//         } else {
//             const data = await getRecentEmails(oauth2Client, 7);
//             // console.log('msg to be sent: ', data.map(element => element[0]+'\r\n'+element[1]).join('\r\n'));
//             // console.log('HEREREEEREEEEEEEEEEEEEEEEE');
//             bot.sendMessage(chatID, `${data.map(element => '*'+(element[0]??'').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')+'*'+'\r\n'+(element[1]??'').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')).join('\r\n\n')}`, { parse_mode: "MarkdownV2" });
//         }
//     }
// })