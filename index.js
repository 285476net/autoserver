const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const cron = require('node-cron');

// Environment Variables မှ တန်ဖိုးများကို ယူခြင်း
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const CHANNEL_A = process.env.CHANNEL_A;
const CHANNEL_B = process.env.CHANNEL_B;
const TARGET_USER_1 = Number(process.env.TARGET_USER_1);
const TARGET_USER_2 = Number(process.env.TARGET_USER_2);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();

const botSchema = new mongoose.Schema({
    id: { type: String, default: 'bot_data' },
    last_active_time: { type: Date, default: Date.now },
    current_msg_id: { type: Number, default: 1 } 
});
const BotData = mongoose.model('BotData', botSchema);

mongoose.connect(MONGO_URI).then(() => console.log("MongoDB Connected"));

bot.on('message', async (msg) => {
    // သတ်မှတ်ထားသော User များ Group အတွင်း စာပို့ခြင်းရှိမရှိ စစ်ဆေးခြင်း
    if (msg.from.id === TARGET_USER_1 || msg.from.id === TARGET_USER_2) {
        await BotData.findOneAndUpdate(
            { id: 'bot_data' }, 
            { last_active_time: new Date() }, 
            { upsert: true }
        );
        console.log("Activity detected from target users. Timer reset.");
    }
});

// ၅ မိနစ် တစ်ကြိမ် ၂၄ နာရီပြည့်/မပြည့် စစ်ဆေးမည်
cron.schedule('*/5 * * * *', async () => {
    const data = await BotData.findOne({ id: 'bot_data' });
    if (!data) {
        await BotData.create({ id: 'bot_data' }); // ပထမဆုံးအကြိမ် DB တည်ဆောက်ခြင်း
        return;
    }

    const now = new Date();
    const diffHours = Math.abs(now - data.last_active_time) / 36e5;

    if (diffHours >= 24) {
        console.log("24 hours passed. Forwarding message ID:", data.current_msg_id);
        try {
            await bot.copyMessage(CHANNEL_B, CHANNEL_A, data.current_msg_id);
            
            await BotData.findOneAndUpdate(
                { id: 'bot_data' },
                { 
                    $inc: { current_msg_id: 1 },
                    last_active_time: new Date() 
                }
            );
            console.log("Message copied successfully.");
        } catch (error) {
            console.log("Message not found or error. Skipping ID:", data.current_msg_id);
            // Message ဖျက်ခံရလျှင် ကျော်သွားရန်
            await BotData.findOneAndUpdate(
                { id: 'bot_data' }, 
                { $inc: { current_msg_id: 1 } }
            );
        }
    }
});

// Web Server (Sleep မဖြစ်စေရန်)
app.get('/ping', (req, res) => res.send('Bot is active!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
