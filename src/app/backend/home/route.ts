import {google} from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { NextRequest, NextResponse } from 'next/server';
import TelegramBot, { Message } from 'node-telegram-bot-api';
import {createClient} from 'redis';

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly'
];

const redis = await createClient({url: process.env.NEXT_PUBLIC_REDIS_URL}).connect();

async function sleep(ms: number){
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getRecentEmails(auth: OAuth2Client, n:number){
    const gmail = google.gmail({ version: 'v1', auth });

    try{
        const messageList = await gmail.users.messages.list({
            userId: 'me',
            maxResults: n, // Adjust this number as needed
            q: 'category:primary' // You can modify this query to filter emails
        });

        const gmails = messageList.data.messages || [];
        const result = [];
        for (const mail of gmails){
            console.log('mail id: ', mail.id);
            const msg = await gmail.users.messages.get({
                userId: 'me' as string,
                id: mail.id as string,
                format: 'full'
            });
            // console.log('mail is: ', JSON.stringify(msg.data));
            // console.log(`Message is: ${JSON.stringify(msg.data.snippet)}\n${Buffer.from((((msg.data.payload??{body:null}).body??{data:null}).data)??((((((msg.data.payload??{parts:null}).parts??[null])[0])??{body:null}).body??{data:null}).data??''), "base64").toString("utf-8")}\n`);
            var subject='';
            for (const sdata of msg.data.payload?.headers??[]){
                if (sdata.name=="Subject"){
                    subject = sdata.value as string;
                }
            }
            result.push([
                subject,
                msg.data.snippet,
                Buffer.from((((msg.data.payload??{body:null}).body??{data:null}).data)??((((((msg.data.payload??{parts:null}).parts??[null])[0])??{body:null}).body??{data:null}).data??''), "base64").toString("utf-8")
            ]);
        }

        // console.log(messageList);
        return result;
    } catch (error) {
        console.error('Error fetching emails:', error);
        throw error;
    }
}

const oauth2Client = new OAuth2Client(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_WEBSITE_URL as string}/backend/home`
);

console.log(oauth2Client.credentials);

export async function GET(request: NextRequest){
    try{
        const { searchParams } = new URL(request.nextUrl);
        const code = searchParams.get('code');
        console.log('code: ', code);

        if (JSON.stringify(oauth2Client.credentials)=="{}"){
            if (!code){
                const authUrl = oauth2Client.generateAuthUrl({
                    access_type: 'offline', // This gets us a refresh token
                    prompt: 'consent', // forces to show consent screen on every login, important to get refresh token every time
                    scope: SCOPES
                });
                return NextResponse.redirect(authUrl);
            }
            const { tokens } = await oauth2Client.getToken(code as string);
            oauth2Client.setCredentials(tokens);
            if (await redis.get('oauthclient')){
                await redis.del('oauthclient');
            }
            console.log('setting credentials in redis: ', JSON.stringify({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                scope: tokens.scope,
                token_type: tokens.token_type,
                expiry_date: tokens.expiry_date
            }));
            await redis.set('oauthclient', JSON.stringify({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                scope: tokens.scope,
                token_type: tokens.token_type,
                expiry_date: tokens.expiry_date
            }));
        }
        // oauth2Client || kv.get('oauthclient');
        const emails = await getRecentEmails(oauth2Client, 7);
        return NextResponse.json({ emails });
    } catch (error){
        console.error('Authorization URL generation failed:', error);
        return NextResponse.json(
            { error: 'Failed to generate authorization URL' },
            { status: 500 }
        );
    }
}

const bot = new TelegramBot(process.env.NEXT_PUBLIC_TELEGRAM_TOKEN as string, {webHook: { port: Number(process.env.NEXT_PUBLIC_TELEGRAM_PORT??'') }});

bot.setWebHook(`${process.env.NEXT_PUBLIC_WEBSITE_URL}/backend/home`, {
    secret_token: `${process.env.NEXT_PUBLIC_TELEGRAM_SECRET_TOKEN}`
}).then(value=>{
    console.log('Webhook prolly setup success: ', value);
}).catch(error=>{
    console.log('Webhook failed: ', error);
});

var work_done=false;
const messagesSent:Promise<TelegramBot.Message>[]=[];
bot.on('message', async (msg: Message) =>{
    try{
        console.log('in message processing section: ', oauth2Client.credentials);
        const { credentials } = await oauth2Client.refreshAccessToken();

        await redis.set('oauthclient', JSON.stringify({
            access_token: credentials.access_token,
            refresh_token: credentials.refresh_token,
            scope: credentials.scope,
            token_type: credentials.token_type,
            expiry_date: credentials.expiry_date
        }));

        const chatID: number = msg.chat.id;
        const messageText: string= msg.text as string;
        console.log('setting credentials for oauth2client: ', await redis.get('oauthclient'));
        oauth2Client.setCredentials(JSON.parse((await redis.get('oauthclient'))??'{}'));

        console.log('chatID: ', chatID);

        if (messageText.startsWith('/start')){
            bot.sendMessage(chatID, 'enter ? <no of mails> to get result.');
        }

        if (messageText.startsWith('?')){
            bot.sendMessage(chatID, 'Processing...');
            const info =messageText.split(' ');
            if (info.length>1 && info[1].toUpperCase()==info[1].toLowerCase()){
                const data_raw = await getRecentEmails(oauth2Client, Number(info[1]));
                // console.log('msg to be sent: ', data.map(element => element[0]+'\r\n'+element[1]).join('\r\n'));
                // console.log('HEREREEEREEEEEEEEEEEEEEEEE');
                for (var i=0; i<(Number(info[1])); i+=5){
                    const data = data_raw.slice(i, i+5);
                    messagesSent.push(
                        bot.sendMessage(chatID, `${data.map(element => '*'+(element[0]??'').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')+'*'+'\r\n'+(element[1]??'').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')).join('\r\n\n')}`, { parse_mode: "MarkdownV2" })
                    );
                }
            } else {
                const data = await getRecentEmails(oauth2Client, 7);
                // console.log('msg to be sent: ', data.map(element => element[0]+'\r\n'+element[1]).join('\r\n'));
                // console.log('HEREREEEREEEEEEEEEEEEEEEEE');
                messagesSent.push(
                    bot.sendMessage(chatID, `${data.map(element => '*'+(element[0]??'').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')+'*'+'\r\n'+(element[1]??'').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')).join('\r\n\n')}`, { parse_mode: "MarkdownV2" })
                );
            }
            await Promise.all(messagesSent);
        }
    } catch(error){
        console.log('Error in bot function: ', error);
    }
    work_done=true;
});

export async function POST(request: NextRequest){
    try{
        const telegramSecret = request.headers.get('x-telegram-bot-api-secret-token');

        if (telegramSecret!=process.env.NEXT_PUBLIC_TELEGRAM_SECRET_TOKEN){
            console.error('Invalid secret token received');
            return NextResponse.json('Invalid secret token recieved', {status: 401});
        }

        const update = await request.json();
        console.log('update: ', update);
        bot.processUpdate(update);
        while (!work_done) await sleep(50);
        work_done=false;
        return NextResponse.json('done sm', {status: 200});
    } catch(error){
        console.log('Error in updating: ', error);
        return NextResponse.json('Error occurred.', {status: 500});
    }
}