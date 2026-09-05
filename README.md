# Real-Time Group Trip Planner

A collaborative trip planning application where groups can plan journeys together in real-time, share live locations, receive transport updates, and get notifications.

## Tech Stack

- **Backend**: Node.js + Express
- **Real-time**: Socket.io with Redis adapter
- **Database**: MongoDB
- **Authentication**: Firebase Auth
- **Frontend**: React + TypeScript (Coming soon)

## Setup

### Prerequisites

- Node.js 16+ 
- MongoDB running locally or connection string
- Firebase project credentials
- Redis (optional, for scaling Socket.io)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```

3. Create `.env` file from `.env.example`:
   ```
   cp .env.example .env
   ```

4. Fill in your environment variables:
   - MongoDB connection string
   - Firebase credentials
   - Google Maps API key (optional)
   - Redis URL (optional)

### Running the Server

Development mode with auto-reload:
```
npm run dev
```

Production mode:
```
npm run start
```

The server will start on `http://localhost:5000` by default.

## Project Structure

```
server/
├── config/          # Database and Firebase configuration
├── middleware/      # Authentication and other middleware
├── models/          # MongoDB schemas
├── routes/          # API endpoints
├── services/        # Business logic (coming in later phases)
├── websocket/       # Socket.io handlers (coming in later phases)
└── index.js         # Main server file

client/
├── src/
│   ├── pages/       # React pages
│   ├── components/  # React components
│   └── hooks/       # Custom React hooks
```

## API Endpoints

### Trips
- `POST /api/trips` - Create a new trip
- `GET /api/trips` - Get all trips for current user
- `GET /api/trips/:groupId` - Get a specific trip
- `PUT /api/trips/:groupId` - Update a trip
- `DELETE /api/trips/:groupId` - Delete a trip

### Groups
- `POST /api/groups/:groupId/members` - Add a member to trip
- `DELETE /api/groups/:groupId/members/:userId` - Remove a member
- `GET /api/groups/:groupId/members` - Get trip members

## Real-Time Events

Coming in Phase 3:
- `join-trip` - User joins a trip group
- `leave-trip` - User leaves a trip group
- `trip:updated` - Trip itinerary changed
- `location:update` - User location updated
- `transport:update` - Transport delay/update

## Roadmap

- [x] Phase 1: Project setup & auth
- [ ] Phase 2: Core trip management
- [ ] Phase 3: Real-time collaboration
- [ ] Phase 4: Location tracking
- [ ] Phase 5: Transport API integration
- [ ] Phase 6: Notifications
- [ ] Phase 7: Frontend & polish
