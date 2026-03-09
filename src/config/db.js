import mongoose from 'mongoose';

function connectDB() {
    mongoose.connect(process.env.DATABASE_URL).then(r => console.log('DB Connected')).catch(err => console.log(err + '\n DB Connection Failed'))
}

connectDB();

export default connectDB;