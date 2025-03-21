const mongoose= require('mongoose');

const ExpenseSchema = new mongoose.Schema({
    amount: Number,
    category: String,
    note: String,
    timestamp: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports= mongoose.model('Expense', ExpenseSchema);
