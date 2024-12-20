const express = require('express');
const LeadAllocation = require('../models/LeadAllocation');
const Team = require('../models/Team'); // Import the Team model
const router = express.Router();
const { authenticateToken } = require('../routes/jwt'); // Assuming this is for authentication

// POST: Save lead allocations
router.post('/lead-allocations', async (req, res) => {
  try {
    const { selectedMembers } = req.body;

    console.log('Request body:', req.body);

    if (!selectedMembers || selectedMembers.length === 0) {
      return res.status(400).json({ error: 'No members selected for allocation.' });
    }

    // Fetch the team from the database using the provided teamId
    const team = await Team.findOne({ teamId: selectedMembers[0].teamId });

    if (!team) {
      return res.status(404).json({ error: 'Team not found.' });
    }

    // Use the MongoDB teamId
    const allocations = selectedMembers.map((member) => ({
      teamId: team._id, // Use the MongoDB-provided teamId
      memberId: member.id,
      leadIds: member.orderIds,
      allocatedTime: member.time,
      date: new Date(), // Add the current date
      status: member.status,
    }));

    // Insert allocations into the database
    await LeadAllocation.insertMany(allocations);

    res.status(201).json({ message: 'Allocations saved successfully.' });
  } catch (err) {
    console.error('Error saving lead allocations:', err);
    res.status(500).json({ error: 'Failed to save lead allocations.' });
  }
});


// GET: Fetch allocations for a team
// GET: Fetch allocations for a team or a specific member
const moment = require('moment'); // Ensure you have moment.js installed

router.get('/lead-allocations', authenticateToken, async (req, res) => {
  try {
    const { teamId, date } = req.query;
    const memberId = req.user && req.user.id;

    console.log("Received query:", req.query);
    console.log("Authenticated user ID:", memberId);

    if (!teamId && !memberId) {
      return res.status(400).json({ error: 'Team ID or Member ID is required.' });
    }

    let query = {};

    if (teamId) {
      query.teamId = teamId;
    }

    if (memberId) {
      query.memberId = memberId;
    }

    // Updated date logic using moment.js
    if (date) {
      const searchDate = moment(date, 'YYYY-MM-DD').startOf('day'); // Parse and normalize to start of the day
      const nextDay = moment(searchDate).add(1, 'day'); // Add one day

      query.date = {
        $gte: searchDate.toDate(), // Greater than or equal to start of the day
        $lt: nextDay.toDate(), // Less than the start of the next day
      };
    }

    console.log("Constructed query:", query);

    const allocations = await LeadAllocation.find(query)
      .populate('memberId', 'name')
      .exec();

    console.log("Allocations found:", allocations);

    res.status(200).json(allocations);
  } catch (err) {
    console.error('Error fetching lead allocations:', err);
    res.status(500).json({ error: 'Failed to fetch lead allocations.' });
  }
});


module.exports = router;