const mongoose = require('mongoose');
const User = require('./models/User');
const Holding = require('./models/Holding');
const Stock = require('./models/Stock');
const Transaction = require('./models/Transaction');

require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/stock-market', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);

      console.log('Querying...');
      const [
        totalUsers,
        newThisWeek,
        totalTrades,
        tradesToday,
        portfolioAgg,
        recentUsers,
        holdingCounts
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ createdAt: { $gte: startOfWeek } }),
        Transaction.countDocuments(),
        Transaction.countDocuments({ createdAt: { $gte: startOfDay } }),
        Holding.aggregate([
          { $lookup: { from: 'stocks', localField: 'stockId', foreignField: '_id', as: 'stock' } },
          { $unwind: { path: '$stock', preserveNullAndEmptyArrays: true } },
          { $group: { _id: null, totalPortValue: { $sum: { $multiply: [ { $ifNull: ['$stock.currentPrice', 0] }, { $ifNull: ['$quantity', 0] } ] } } } }
        ]),
        User.find().sort({ createdAt: -1 }).limit(8).select('-password').lean(),
        Holding.aggregate([ { $group: { _id: '$userId', count: { $sum: 1 } } } ])
      ]);
      console.log('Query completed successfully');
      console.log({ totalUsers, newThisWeek, totalTrades, tradesToday });
    } catch (err) {
      console.error('Error in queries:', err);
    }
    process.exit(0);
  });
