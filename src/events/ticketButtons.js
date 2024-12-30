const { Events } = require('discord.js');
const ticketService = require('../services/ticketService');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isButton()) return;

        try {
            switch (interaction.customId) {
                case 'create_ticket':
                    await handleCreateTicket(interaction);
                    break;
                case 'view_tickets':
                    await handleViewTickets(interaction);
                    break;
                case 'claim_ticket':
                    await handleClaimTicket(interaction);
                    break;
                case 'close_ticket':
                    await handleCloseTicket(interaction);
                    break;
            }
        } catch (error) {
            console.error('Error handling ticket button:', error);
            await interaction.reply({
                content: 'An error occurred while processing your request.',
                ephemeral: true
            });
        }
    }
};

async function handleCreateTicket(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const canCreate = await ticketService.canCreateTicket(
            interaction.user.id, 
            interaction.guild.id
        );

        if (!canCreate.allowed) {
            return await interaction.editReply({
                content: `❌ ${canCreate.reason}`,
                ephemeral: true
            });
        }

        // Create the ticket
        const ticket = await ticketService.createTicket({
            userId: interaction.user.id,
            category: 'GENERAL',
            subject: 'New Support Ticket',
            description: 'User created ticket from panel'
        }, interaction.guild);

        await interaction.editReply({
            content: `Your ticket has been created! Please go to <#${ticket.channelId}>`
        });
    } catch (error) {
        console.error('Error creating ticket:', error);
        await interaction.editReply({
            content: 'Failed to create ticket. Please try again later.'
        });
    }
}

async function handleViewTickets(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const tickets = await ticketService.getUserTickets(interaction.user.id, interaction.guild.id);
        
        if (tickets.length === 0) {
            return await interaction.editReply({
                content: 'You have no open tickets!'
            });
        }

        const ticketList = tickets.map(ticket => 
            `• Ticket ${ticket.ticketId} - <#${ticket.channelId}> - Status: ${ticket.status}`
        ).join('\n');

        await interaction.editReply({
            content: `Your open tickets:\n${ticketList}`
        });
    } catch (error) {
        console.error('Error fetching tickets:', error);
        await interaction.editReply({
            content: 'Failed to fetch your tickets. Please try again later.'
        });
    }
}

async function handleClaimTicket(interaction) {
    await interaction.deferReply({ ephemeral: false });

    try {
        const config = await ticketService.getConfig(interaction.guild.id);
        
        // Check if user has support role
        if (!interaction.member.roles.cache.has(config.supportRoleId)) {
            return await interaction.editReply({
                content: 'You do not have permission to claim tickets.'
            });
        }

        const ticket = await ticketService.claimTicket(
            interaction.channel.id,
            interaction.user.id
        );

        await interaction.editReply({
            content: `Ticket claimed by ${interaction.user}`
        });
    } catch (error) {
        console.error('Error claiming ticket:', error);
        await interaction.editReply({
            content: 'Failed to claim ticket. Please try again later.'
        });
    }
}

async function handleCloseTicket(interaction) {
    await interaction.deferReply({ ephemeral: false });

    try {
        const config = await ticketService.getConfig(interaction.guild.id);
        const ticket = await ticketService.getTicketByChannelId(interaction.channel.id);

        // Check permissions
        const canClose = interaction.member.roles.cache.has(config.supportRoleId) || 
                        ticket.userId === interaction.user.id;

        if (!canClose) {
            return await interaction.editReply({
                content: 'You do not have permission to close this ticket.'
            });
        }

        await ticketService.closeTicket(
            ticket.ticketId,
            interaction.user.id,
            'Closed by user'
        );

        await interaction.editReply({
            content: 'Ticket will be closed in 5 seconds...'
        });

        // Delete channel after delay
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (error) {
                console.error('Error deleting ticket channel:', error);
            }
        }, 5000);
    } catch (error) {
        console.error('Error closing ticket:', error);
        await interaction.editReply({
            content: 'Failed to close ticket. Please try again later.'
        });
    }
} 