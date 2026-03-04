import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        await mongoose.connect("mongodb+srv://yvanopara:0000000000@cluster0.t9kcwaw.mongodb.net/inventory?retryWrites=true&w=majority&appName=Cluster0", {
            useNewUrlParser: true, // Optional, adds compatibility for MongoDB driver
            useUnifiedTopology: true, // Optional, removes deprecated server selection warnings
        });
        console.log('DB connected');
    } catch (error) {
        console.error('DB connection error:', error.message);
        process.exit(1); // Exit process with failure
    }
};
"mongodb+srv://yvanopara:00000000@cluster0.dxck4ha.mongodb.net/"



//"mongodb+srv://yvanopara1845:0000000000@cluster0.5wkfb.mongodb.net/project0?retryWrites=true&w=majority&appName=Cluster0"