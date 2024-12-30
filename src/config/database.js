const mongoose = require('mongoose');
require('dotenv').config();

const connectDatabase = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            retryWrites: true,
            w: 'majority'
        });

        console.log('📦 MongoDB connected successfully');

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected. Attempting to reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected successfully');
        });

    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        console.log('MongoDB URI:', process.env.MONGODB_URI?.replace(/:[^:]*@/, ':****@')); // Oculta la contraseña en los logs
        throw error;
    }
};

module.exports = { connectDatabase }; 