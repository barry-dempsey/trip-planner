const express = require('express');
const Trip = require('../models/Trip');
const TripInvitation = require('../models/TripInvitation');
const User = require('../models/User');
const { logMemberChange } = require('../services/activityLogger');

const router = express.Router();

// Add a member to a trip (by userId) or send invitation (by email)
router.post('/:groupId/members', async (req, res) => {
  try {
    const { userId, email } = req.body;
    const trip = await Trip.findOne({ groupId: req.params.groupId });

    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Check authorization - only organizers can add members
    const requesterMember = trip.members.find((m) => m.userId === req.user.uid);
    if (!requesterMember || requesterMember.role !== 'organizer') {
      return res.status(403).json({ error: 'Only organizers can add members' });
    }

    // If userId provided, add directly
    if (userId) {
      const memberExists = trip.members.some((m) => m.userId === userId);
      if (memberExists) {
        return res.status(400).json({ error: 'Member already in trip' });
      }

      // Get user email if available
      const user = await User.findOne({ uid: userId });
      const memberEmail = user?.email || email || null;

      trip.members.push({
        userId,
        email: memberEmail,
        role: 'member',
        status: 'active',
        joinedAt: new Date(),
      });

      trip.updatedAt = new Date();
      await trip.save();

      await logMemberChange(
        trip._id,
        trip.groupId,
        req.user.uid,
        requesterMember.email,
        userId,
        'member_added',
        { email: memberEmail }
      );

      return res.status(201).json(trip);
    }

    // If email provided, send invitation
    if (email) {
      const invitationExists = trip.members.some((m) => m.email === email);
      if (invitationExists) {
        return res.status(400).json({ error: 'Member already in trip' });
      }

      const token = TripInvitation.generateToken();
      const invitation = new TripInvitation({
        tripId: trip._id,
        groupId: trip.groupId,
        recipientEmail: email,
        invitedBy: req.user.uid,
        invitedByEmail: requesterMember.email,
        token,
      });

      await invitation.save();

      // Add pending member to trip
      trip.members.push({
        email,
        role: 'member',
        status: 'pending',
        invitedBy: req.user.uid,
        invitedAt: new Date(),
      });

      trip.updatedAt = new Date();
      await trip.save();

      await logMemberChange(
        trip._id,
        trip.groupId,
        req.user.uid,
        requesterMember.email,
        email,
        'member_invited',
        { email, token }
      );

      return res.status(201).json({
        message: 'Invitation sent',
        invitation: {
          token,
          recipientEmail: email,
          createdAt: invitation.createdAt,
          expiresAt: invitation.expiresAt,
        },
      });
    }

    res.status(400).json({ error: 'Either userId or email is required' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update member role
router.put('/:groupId/members/:userId', async (req, res) => {
  try {
    const { role } = req.body;
    const trip = await Trip.findOne({ groupId: req.params.groupId });

    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Check authorization - only organizers can change roles
    const requesterMember = trip.members.find((m) => m.userId === req.user.uid);
    if (!requesterMember || requesterMember.role !== 'organizer') {
      return res.status(403).json({ error: 'Only organizers can change member roles' });
    }

    const targetMember = trip.members.find((m) => m.userId === req.params.userId);
    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const oldRole = targetMember.role;
    targetMember.role = role;
    trip.updatedAt = new Date();
    await trip.save();

    await logMemberChange(
      trip._id,
      trip.groupId,
      req.user.uid,
      requesterMember.email,
      req.params.userId,
      'member_role_changed',
      { from: oldRole, to: role }
    );

    res.json(targetMember);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Remove a member from a trip
router.delete('/:groupId/members/:userId', async (req, res) => {
  try {
    const trip = await Trip.findOne({ groupId: req.params.groupId });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Check authorization - only organizers can remove members
    const requesterMember = trip.members.find((m) => m.userId === req.user.uid);
    if (!requesterMember || requesterMember.role !== 'organizer') {
      return res.status(403).json({ error: 'Only organizers can remove members' });
    }

    const targetMember = trip.members.find((m) => m.userId === req.params.userId);
    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    trip.members = trip.members.filter((m) => m.userId !== req.params.userId);
    trip.updatedAt = new Date();
    await trip.save();

    await logMemberChange(
      trip._id,
      trip.groupId,
      req.user.uid,
      requesterMember.email,
      req.params.userId,
      'member_removed',
      { email: targetMember.email }
    );

    res.json({ message: 'Member removed' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get trip members
router.get('/:groupId/members', async (req, res) => {
  try {
    const trip = await Trip.findOne({ groupId: req.params.groupId });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Check authorization
    const requesterMember = trip.members.find((m) => m.userId === req.user.uid);
    if (!requesterMember) {
      return res.status(403).json({ error: 'Not a member of this trip' });
    }

    res.json(trip.members);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get pending invitations for a trip
router.get('/:groupId/invitations', async (req, res) => {
  try {
    const trip = await Trip.findOne({ groupId: req.params.groupId });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Check authorization - only organizers can see invitations
    const requesterMember = trip.members.find((m) => m.userId === req.user.uid);
    if (!requesterMember || requesterMember.role !== 'organizer') {
      return res.status(403).json({ error: 'Only organizers can view invitations' });
    }

    const invitations = await TripInvitation.find({
      tripId: trip._id,
      status: 'pending',
    }).select('-token');

    res.json(invitations);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Accept invitation (by token, no groupId needed)
router.post('/invitations/:token/accept', async (req, res) => {
  try {
    const invitation = await TripInvitation.findOne({ token: req.params.token });

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation already processed' });
    }

    if (new Date() > invitation.expiresAt) {
      invitation.status = 'expired';
      await invitation.save();
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    const trip = await Trip.findById(invitation.tripId);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Check if user exists, create if not
    let user = await User.findOne({ email: invitation.recipientEmail });
    if (!user) {
      user = new User({
        uid: `user_${Date.now()}`,
        email: invitation.recipientEmail,
        createdAt: new Date(),
      });
      await user.save();
    }

    // Check if user already in trip
    const alreadyMember = trip.members.some((m) => m.userId === user.uid);
    if (alreadyMember) {
      return res.status(400).json({ error: 'Already a member of this trip' });
    }

    // Add user to trip
    const pendingMember = trip.members.find((m) => m.email === invitation.recipientEmail);
    if (pendingMember) {
      pendingMember.userId = user.uid;
      pendingMember.status = 'active';
      pendingMember.inviteAccepted = new Date();
    } else {
      trip.members.push({
        userId: user.uid,
        email: invitation.recipientEmail,
        role: 'member',
        status: 'active',
        joinedAt: new Date(),
        invitedBy: invitation.invitedBy,
        inviteAccepted: new Date(),
      });
    }

    trip.updatedAt = new Date();
    await trip.save();

    // Mark invitation as accepted
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    invitation.acceptedByUserId = user.uid;
    await invitation.save();

    await logMemberChange(trip._id, trip.groupId, user.uid, user.email, user.uid, 'member_added', {
      email: invitation.recipientEmail,
    });

    res.json({ message: 'Invitation accepted', trip, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Accept invitation
router.post('/:groupId/invitations/:token/accept', async (req, res) => {
  try {
    const invitation = await TripInvitation.findOne({ token: req.params.token });

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation already processed' });
    }

    if (new Date() > invitation.expiresAt) {
      invitation.status = 'expired';
      await invitation.save();
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    const trip = await Trip.findById(invitation.tripId);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Check if user exists, create if not
    let user = await User.findOne({ email: invitation.recipientEmail });
    if (!user) {
      user = new User({
        uid: `user_${Date.now()}`,
        email: invitation.recipientEmail,
        createdAt: new Date(),
      });
      await user.save();
    }

    // Check if user already in trip
    const alreadyMember = trip.members.some((m) => m.userId === user.uid);
    if (alreadyMember) {
      return res.status(400).json({ error: 'Already a member of this trip' });
    }

    // Add user to trip
    const pendingMember = trip.members.find((m) => m.email === invitation.recipientEmail);
    if (pendingMember) {
      pendingMember.userId = user.uid;
      pendingMember.status = 'active';
      pendingMember.inviteAccepted = new Date();
    } else {
      trip.members.push({
        userId: user.uid,
        email: invitation.recipientEmail,
        role: 'member',
        status: 'active',
        joinedAt: new Date(),
        invitedBy: invitation.invitedBy,
        inviteAccepted: new Date(),
      });
    }

    trip.updatedAt = new Date();
    await trip.save();

    // Mark invitation as accepted
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    invitation.acceptedByUserId = user.uid;
    await invitation.save();

    await logMemberChange(trip._id, trip.groupId, user.uid, user.email, user.uid, 'member_added', {
      email: invitation.recipientEmail,
    });

    res.json({ message: 'Invitation accepted', trip, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Cancel invitation
router.delete('/:groupId/invitations/:invitationId', async (req, res) => {
  try {
    const invitation = await TripInvitation.findById(req.params.invitationId);

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const trip = await Trip.findById(invitation.tripId);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Check authorization - only organizers can cancel invitations
    const requesterMember = trip.members.find((m) => m.userId === req.user.uid);
    if (!requesterMember || requesterMember.role !== 'organizer') {
      return res.status(403).json({ error: 'Only organizers can cancel invitations' });
    }

    // Remove pending member from trip
    trip.members = trip.members.filter((m) => m.email !== invitation.recipientEmail);
    trip.updatedAt = new Date();
    await trip.save();

    // Mark invitation as rejected
    invitation.status = 'rejected';
    invitation.rejectedAt = new Date();
    await invitation.save();

    res.json({ message: 'Invitation cancelled' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Resend invitation
router.post('/:groupId/invitations/:invitationId/resend', async (req, res) => {
  try {
    const invitation = await TripInvitation.findById(req.params.invitationId);

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const trip = await Trip.findById(invitation.tripId);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Check authorization - only organizers can resend invitations
    const requesterMember = trip.members.find((m) => m.userId === req.user.uid);
    if (!requesterMember || requesterMember.role !== 'organizer') {
      return res.status(403).json({ error: 'Only organizers can resend invitations' });
    }

    // Reset expiration
    invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await invitation.save();

    res.json({ message: 'Invitation resent', invitation });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
