const mongoose = require('mongoose');

const connectToMongo = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

mongoose.connection.on('error', err => {
    console.error('MongoDB error:', err);
});

module.exports = connectToMongo;