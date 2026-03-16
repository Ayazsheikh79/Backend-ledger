import mongoose from 'mongoose';

function connectDB() {
    mongoose.connect(process.env.DATABASE_URL).then(() => console.log('DB Connected')).catch(err => console.log(err + '\n DB Connection Failed'))
}

export default connectDB;