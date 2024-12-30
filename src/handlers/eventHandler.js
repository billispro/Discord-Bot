const { readdirSync } = require('fs');
const path = require('path');

async function loadEvents(client) {
    const eventsPath = path.join(__dirname, '../events');
    const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const event = require(`${eventsPath}/${file}`);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
        
        console.log(`🌟 Loaded event: ${event.name}`);
    }
}

module.exports = { loadEvents }; 