import { metadata } from './../../layout';
import {google} from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { NextRequest, NextResponse } from 'next/server';
import TelegramBot, { Message } from 'node-telegram-bot-api';


const KEYFILE = {
    "client_id": process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    "project_id": process.env.NEXT_PUBLIC_GOOGLE_PROJECT_ID,
    "auth_uri": process.env.NEXT_PUBLIC_GOOGLE_AUTH_URI,
    "token_uri": process.env.NEXT_PUBLIC_GOOGLE_TOKEN_URI,
    "auth_provider_x509_cert_url": process.env.NEXT_PUBLIC_GOOGLE_AUTH_PROVIDER_CERT_URL,
    "client_secret": process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET
}

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly'
];

async function getRecentEmails(auth: OAuth2Client, n:number){
    const gmail = google.gmail({ version: 'v1', auth });

    try{
        const messageList = await gmail.users.messages.list({
            userId: 'me',
            maxResults: n, // Adjust this number as needed
            q: 'category:primary' // You can modify this query to filter emails
        });

        if (!messageList.data.messages) {
            return [];
        }

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
    "http://localhost:3000/backend/home"
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
                    scope: SCOPES
                });
                return NextResponse.redirect(authUrl);
            }
            const { tokens } = await oauth2Client.getToken(code as string);
            oauth2Client.setCredentials(tokens);
        }
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

const bot = new TelegramBot(process.env.NEXT_PUBLIC_TELEGRAM_TOKEN as string, {polling: true});

bot.on('message', async (msg: Message) =>{
    const chatID: number = msg.chat.id;
    const messageText: string= msg.text as string;

    console.log('chatID: ', chatID);

    if (messageText.startsWith('?')){
        const info =messageText.split(' ');
        if (info.length>1 && info[1].toUpperCase()==info[1].toLowerCase()){
            const data_raw = await getRecentEmails(oauth2Client, info[1] as unknown as number);
            // console.log('msg to be sent: ', data.map(element => element[0]+'\r\n'+element[1]).join('\r\n'));
            // console.log('HEREREEEREEEEEEEEEEEEEEEEE');
            for (var i=0; i<(info[1] as unknown as number); i+=5){
                const data = data_raw.slice(i, i+5);
                bot.sendMessage(chatID, `${data.map(element => '*'+(element[0]??'').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')+'*'+'\r\n'+(element[1]??'').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')).join('\r\n\n')}`, { parse_mode: "MarkdownV2" });            }
        } else {
            const data = await getRecentEmails(oauth2Client, 7);
            // console.log('msg to be sent: ', data.map(element => element[0]+'\r\n'+element[1]).join('\r\n'));
            // console.log('HEREREEEREEEEEEEEEEEEEEEEE');
            bot.sendMessage(chatID, `${data.map(element => '*'+(element[0]??'').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')+'*'+'\r\n'+(element[1]??'').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')).join('\r\n\n')}`, { parse_mode: "MarkdownV2" });
        }
    }
})
