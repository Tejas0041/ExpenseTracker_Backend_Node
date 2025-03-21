require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = process.env.PORT || 5000;

const Expense = require('./models/expenseSchema');
const Category = require('./models/categorySchema');
const User= require('./models/userSchema');

const {authMiddleware} = require('./middleware');

app.use(cors());
app.use(express.json()); 

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB connected"))
.catch(err => console.error("MongoDB connection error:", err));


app.get('/expenses', authMiddleware, async (req, res) => {
    try {
        const expenses = await Expense.find({user: req.user._id});
        return res.json(expenses);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/expenses', authMiddleware, async (req, res) => {
    const { amount, category, note } = req.body;
    if (!amount || !category) return res.status(400).json({ error: "Missing required fields" });

    const categoryExists = await Category.findOne({ name: category });
    if (!categoryExists) return res.status(400).json({ error: "Category does not exist" });

    const newExpense = new Expense({ amount, category, note, user: req.user._id });
    await newExpense.save();
    return res.status(201).json(newExpense);
});

app.put('/expenses/:id', authMiddleware, async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({ error: "Expense not found" });
        }

        if (expense.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Unauthorized to update this expense" });
        }

        const updatedExpense = await Expense.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );


        res.json({ message: "Expense updated", expense: updatedExpense });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/expenses/:id', authMiddleware, async (req, res) => {
    try {
        const deletedExpense = await Expense.findByIdAndDelete(req.params.id);
        if (!deletedExpense) return res.status(404).json({ error: "Expense not found" });

        res.json({ message: "Expense deleted" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/categories', authMiddleware, async (req, res) => {
    try {
        const categories = await Category.find({user: req.user._id});
        return res.json(categories);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/categories', authMiddleware, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Missing required fields" });

    if (await Category.findOne({ $and: [{name}, {user: req.user._id}] })) return res.status(400).json({ error: "Category already exists" });

    const newCategory = new Category({ name, user: req.user._id });
    await newCategory.save();
    return res.status(201).json(newCategory);
});

app.delete('/categories/:name',authMiddleware, async (req, res) => {
    try {
        const deletedCategory = await Category.findOneAndDelete({ name: req.params.name, user: req.user._id });
        if (!deletedCategory) return res.status(404).json({ error: "Category not found" });

        await Expense.deleteMany({ category: req.params.name, user: req.user._id }); 
        return res.json({ message: "Category and associated expenses deleted" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing required fields" });

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ error: "Username already exists" });

        const user = new User({ username, password });
        await user.save();

        const token = user.generateAuthToken();
        return res.status(201).json({ token });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing required fields" });

    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ error: "Invalid username or password" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid username or password" });

        const token = user.generateAuthToken();
        return res.json({ token });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/status', async (req, res) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded._id);
        if (!user) return res.status(404).json({ error: "User not found" });

        return res.json({ user: { username: user.username } });
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
