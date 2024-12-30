const { readdirSync } = require('fs');
const path = require('path');

async function loadCommands(client) {
    const commandsPath = path.join(__dirname, '../commands');
    const commandFolders = readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        const commandFiles = readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(`${folderPath}/${file}`);
            
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`📚 Loaded command: ${command.data.name}`);
            } else {
                console.log(`⚠️ Command at ${file} is missing required properties!`);
            }
        }
    }
}

module.exports = { loadCommands }; 