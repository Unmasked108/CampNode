// routes/orders.js
const express = require('express');
const Order = require('../models/Order');
const { authenticateToken } = require('../routes/jwt'); // Assuming this is for authentication
const router = express.Router();
const mongoose = require('mongoose');
// Route to create a new order
router.post('/orders', authenticateToken, async (req, res) => {
  try {
    console.log('Received Data:', req.body); // Log the data sent by the frontend

    const orders = Array.isArray(req.body) ? req.body : [req.body];

    // Check for size limit
    if (orders.length > 5000) {
      return res.status(413).json({ message: 'Payload too large. Maximum 5000 records allowed.' });
    }

    // Ensure all orders include the "state" field with default value "new"
    const ordersWithState = orders.map(order => ({
      ...order,
      state: order.state || 'new', // Add "state" only if it's not already provided
    }));

    // Save orders
    const savedOrders = await Order.insertMany(ordersWithState);
    res.status(201).json({ message: 'Orders created successfully', orders: savedOrders });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    if (error.code === 11000) { // Duplicate key error
      return res.status(400).json({ message: 'Order ID must be unique' });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const { leadIds } = req.query; // Accept leadIds (lead ObjectIds)

    console.log(req.query); // Log incoming query for debugging

    let query = {}; // Default to fetch all orders

    // If leadIds (lead ObjectIds) are provided, filter orders
    if (leadIds) {
      const leadIdsArray = leadIds.split(','); // Convert leadIds string to array
      query._id = { $in: leadIdsArray.map((id) => new mongoose.Types.ObjectId(id)) }; // Filter orders by ObjectId
    }

    const orders = await Order.find(query).exec(); // Fetch matching orders
    console.log('Leads Allocated:', orders.length); 

    // Calculate completed leads
    const leadsCompleted = orders.filter(order => order.paymentStatus === 'Paid').length;
    console.log('Leads Completed:', leadsCompleted);

    // Respond with correct information
    res.status(200).json({
      data: orders,
      leadsAllocated: orders.length,  // Total number of orders allocated
      leadsCompleted: leadsCompleted, // Total number of completed orders
    });
    console.log(orders);

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});



// Update payment status
router.patch('/orders/payment-status', authenticateToken, async (req, res) => {
  try {
    const { orders } = req.body; // Receive an array of orders with orderId and paymentStatus

    if (!orders || orders.length === 0) {
      return res.status(400).json({ message: 'No orders provided to update' });
    }

    const updatedOrders = [];

    for (const order of orders) {
      const { orderId, paymentStatus } = order;

      if (!orderId || !paymentStatus) {
        continue;  // Skip if there's missing data
      }

      // Find the order by orderId and update its payment status
      const updatedOrder = await Order.findOneAndUpdate(
        { orderId: orderId }, // Match using the orderId field (as a string)
        { paymentStatus, updatedAt: new Date() }, // Update payment status and timestamp
        { new: true } // Return the updated document
      );

      if (updatedOrder) {
        updatedOrders.push(updatedOrder);
      }
    }

    if (updatedOrders.length > 0) {
      return res.status(200).json({
        message: 'Payment statuses updated successfully',
        data: updatedOrders,
      });
    } else {
      return res.status(404).json({ message: 'No matching orders found to update' });
    }
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
