const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ticketService = require('../../services/ticketService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('priority')
        .setDescription('Set ticket priority')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option.setName('level')
                .setDescription('Priority level')
                .setRequired(true)
                .addChoices(
                    { name: '🟢 Low', value: 'LOW' },
                    { name: '🟡 Medium', value: 'MEDIUM' },
                    { name: '🟠 High', value: 'HIGH' },
                    { name: '🔴 Urgent', value: 'URGENT' }
                )),

    async execute(interaction) {
        try {
            const ticket = await ticketService.getTicketByChannelId(interaction.channel.id);
            if (!ticket) {
                return await interaction.reply({
                    content: '❌ This command can only be used in ticket channels.',
                    ephemeral: true
                });
            }

            const priority = interaction.options.getString('level');
            await ticketService.updateTicketPriority(ticket.ticketId, priority, interaction.user.id);

            const embed = new EmbedBuilder()
                .setColor(getPriorityColor(priority))
                .setTitle('Ticket Priority Updated')
                .setDescription(`Priority set to: ${getPriorityEmoji(priority)} ${priority}`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error setting ticket priority:', error);
            await interaction.reply({
                content: '❌ Failed to update ticket priority.',
                ephemeral: true
            });
        }
    }
};

function getPriorityColor(priority) {
    const colors = {
        LOW: '#00ff00',
        MEDIUM: '#ffff00',
        HIGH: '#ff9900',
        URGENT: '#ff0000'
    };
    return colors[priority];
}

function getPriorityEmoji(priority) {
    const emojis = {
        LOW: '🟢',
        MEDIUM: '🟡',
        HIGH: '🟠',
        URGENT: '🔴'
    };
    return emojis[priority];
} 