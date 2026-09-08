const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const cron = require('node-cron');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const CHANNEL_A = process.env.CHANNEL_A;
const CHANNEL_B = process.env.CHANNEL_B;
const TARGET_USER_2 = Number(process.env.TARGET_USER_2);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();

const botSchema = new mongoose.Schema({
    id: { type: String, default: 'bot_data' },
    last_active_time: { type: Date, default: Date.now },
    current_msg_id: { type: Number, default: 1 },
    msg_count: { type: Number, default: 0 } 
});
const BotData = mongoose.model('BotData', botSchema);

mongoose.connect(MONGO_URI).then(() => console.log("MongoDB Connected"));

bot.on('message', async (msg) => {
    if (msg.from.id === TARGET_USER_2) {
        
        let data = await BotData.findOne({ id: 'bot_data' });
        if (!data) {
            data = await BotData.create({ id: 'bot_data' });
        }

        const newCount = (data.msg_count || 0) + 1;
        
        if (newCount >= 5) {
            await BotData.findOneAndUpdate(
                { id: 'bot_data' }, 
                { 
                    msg_count: 0,
                    last_active_time: new Date() 
                }
            );
            console.log("User 2 sent 5 messages. Timer and count reset to now.");
        } else {
            await BotData.findOneAndUpdate(
                { id: 'bot_data' }, 
                { msg_count: newCount }
            );
            console.log(`User 2 sent a message. Current count: ${newCount}`);
        }
    }
});

cron.schedule('*/5 * * * *', async () => {
    const data = await BotData.findOne({ id: 'bot_data' });
    if (!data) {
        await BotData.create({ id: 'bot_data' }); 
        return;
    }

    const now = new Date();
    const diffHours = Math.abs(now - data.last_active_time) / 36e5;

    if (diffHours >= 24) {
        console.log("24 hours passed without 5 messages from User 2. Forwarding message ID:", data.current_msg_id);
        try {
            await bot.copyMessage(CHANNEL_B, CHANNEL_A, data.current_msg_id);
            
            await BotData.findOneAndUpdate(
                { id: 'bot_data' },
                { 
                    $inc: { current_msg_id: 1 },
                    last_active_time: new Date(), 
                    msg_count: 0 
                }
            );
            console.log("Message copied successfully.");
        } catch (error) {
            console.log("Message not found or error. Skipping ID:", data.current_msg_id);
            await BotData.findOneAndUpdate(
                { id: 'bot_data' }, 
                { $inc: { current_msg_id: 1 } }
            );
        }
    }
});

app.get('/ping', (req, res) => res.send('Bot is active!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
