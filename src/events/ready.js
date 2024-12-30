module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`✅ ${client.user.tag} is online and ready!`);
        
        // Set bot activity
        client.user.setActivity('with Discord.js', { type: 'PLAYING' });
    }
}; 