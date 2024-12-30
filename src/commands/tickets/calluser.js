const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder 
} = require('discord.js');
const ticketService = require('../../services/ticketService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('calluser')
        .setDescription('Call a user to their ticket')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to call')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const user = interaction.options.getUser('user');
            const tickets = await ticketService.getUserTickets(user.id, interaction.guild.id);

            if (tickets.length === 0) {
                return await interaction.editReply({
                    content: `${user} has no open tickets.`,
                    ephemeral: true
                });
            }

            const ticketsList = tickets.map(ticket => `<#${ticket.channelId}>`).join(', ');
            await interaction.editReply({
                content: `${user}, you have pending tickets: ${ticketsList}\nPlease attend to your tickets!`
            });

            // Log the call action
            await ticketService.logTicketAction({
                guildId: interaction.guild.id,
                action: 'CALL_USER',
                targetId: user.id,
                moderatorId: interaction.user.id,
                tickets: tickets.map(t => t.ticketId)
            });
        } catch (error) {
            console.error('Error in calluser command:', error);
            await interaction.editReply({
                content: 'An error occurred while executing the command.',
                ephemeral: true
            });
        }
    }
}; 