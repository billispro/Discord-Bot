const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with bot latency'),
    
    async execute(interaction) {
        try {
            // Defer the reply to prevent timeout
            await interaction.deferReply();

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🏓 Pong!')
                .addFields(
                    { 
                        name: 'Bot Latency', 
                        value: `${Date.now() - interaction.createdTimestamp}ms`,
                        inline: true 
                    },
                    { 
                        name: 'API Latency', 
                        value: `${Math.round(interaction.client.ws.ping)}ms`,
                        inline: true 
                    }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in ping command:', error);
            
            // If we haven't replied yet, send an error message
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'There was an error executing this command!',
                    ephemeral: true 
                });
            } else {
                await interaction.editReply({ 
                    content: 'There was an error executing this command!' 
                });
            }
        }
    }
}; 