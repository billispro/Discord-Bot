const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { loadEvents } = require('./src/handlers/eventHandler');
const { loadCommands } = require('./src/handlers/commandHandler');
const { deployCommands } = require('./src/handlers/deployCommands');
const { connectDatabase } = require('./src/config/database');
const ticketService = require('./src/services/ticketService');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands = new Collection();
client.cooldowns = new Collection();

// Load handlers and deploy commands
(async () => {
    try {
        console.log('Starting bot initialization...');
        
        // Initialize ticketService with client first
        ticketService.setClient(client);
        console.log('Ticket service initialized');
        
        // Connect to MongoDB
        await connectDatabase();
        
        // Then deploy commands
        await deployCommands(client);
        
        // Load events and commands
        await loadEvents(client);
        await loadCommands(client);
        
        // Finally, login
        await client.login(process.env.TOKEN);
    } catch (error) {
        console.error('Error during initialization:', error);
    }
})();

process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
}); 