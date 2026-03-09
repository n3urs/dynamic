const router = require('express').Router();
const Route = require('../main/models/route');

// Rooms
router.get('/rooms', (req, res, next) => {
  try { res.json(Route.listRooms()); } catch (e) { next(e); }
});
router.post('/rooms', (req, res, next) => {
  try { res.json(Route.createRoom(req.body)); } catch (e) { next(e); }
});
router.put('/rooms/:id', (req, res, next) => {
  try { res.json(Route.updateRoom(req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete('/rooms/:id', (req, res, next) => {
  try { res.json(Route.deleteRoom(req.params.id)); } catch (e) { next(e); }
});

// Walls
router.get('/walls', (req, res, next) => {
  try { res.json(Route.listWalls()); } catch (e) { next(e); }
});
router.get('/walls/:id', (req, res, next) => {
  try { res.json(Route.getWall(req.params.id) || null); } catch (e) { next(e); }
});
router.post('/walls', (req, res, next) => {
  try { res.json(Route.createWall(req.body)); } catch (e) { next(e); }
});
router.put('/walls/:id', (req, res, next) => {
  try { res.json(Route.updateWall(req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete('/walls/:id', (req, res, next) => {
  try { res.json(Route.deleteWall(req.params.id)); } catch (e) { next(e); }
});

// Climbs
router.post('/climbs/map-positions', (req, res, next) => {
  try { res.json(Route.updateClimbMapPositions(req.body.positions || [])); } catch (e) { next(e); }
});
router.post('/climbs', (req, res, next) => {
  try { res.json(Route.createClimb(req.body)); } catch (e) { next(e); }
});
router.get('/climbs', (req, res, next) => {
  try { res.json(Route.listClimbs(req.query)); } catch (e) { next(e); }
});
router.get('/climbs/:id', (req, res, next) => {
  try { res.json(Route.getClimbById(req.params.id) || null); } catch (e) { next(e); }
});
router.put('/climbs/:id', (req, res, next) => {
  try { res.json(Route.updateClimb(req.params.id, req.body)); } catch (e) { next(e); }
});
router.post('/climbs/strip-all', (req, res, next) => {
  try {
    const db = require('../main/database/db.js').getDb();
    const now = new Date().toISOString();
    const result = db.prepare("UPDATE climbs SET status = 'stripped', date_stripped = ? WHERE status = 'active'").run(now);
    res.json({ success: true, count: result.changes });
  } catch (e) { next(e); }
});
router.post('/climbs/:id/strip', (req, res, next) => {
  try { res.json(Route.stripClimb(req.params.id)); } catch (e) { next(e); }
});
router.get('/climbs/due-for-stripping', (req, res, next) => {
  try { res.json(Route.getDueForStripping(parseInt(req.query.days) || 7)); } catch (e) { next(e); }
});

// Logbook
router.post('/logs', (req, res, next) => {
  try { res.json(Route.logAttempt(req.body)); } catch (e) { next(e); }
});
router.get('/logs/:memberId', (req, res, next) => {
  try { res.json(Route.getMemberLogbook(req.params.memberId, req.query)); } catch (e) { next(e); }
});
router.get('/stats/:memberId', (req, res, next) => {
  try { res.json(Route.getMemberStats(req.params.memberId)); } catch (e) { next(e); }
});

// Feedback
router.post('/feedback', (req, res, next) => {
  try { res.json(Route.addFeedback(req.body)); } catch (e) { next(e); }
});
router.get('/feedback/:climbId', (req, res, next) => {
  try { res.json(Route.getClimbFeedback(req.params.climbId)); } catch (e) { next(e); }
});

// Distributions
router.get('/grade-distribution', (req, res, next) => {
  try { res.json(Route.getGradeDistribution(req.query.wallId)); } catch (e) { next(e); }
});
router.get('/style-distribution', (req, res, next) => {
  try { res.json(Route.getStyleDistribution(req.query.wallId)); } catch (e) { next(e); }
});
router.get('/colour-distribution', (req, res, next) => {
  try { res.json(Route.getColourDistribution(req.query.wallId)); } catch (e) { next(e); }
});

// Holds
router.post('/holds', (req, res, next) => {
  try { res.json(Route.createHold(req.body)); } catch (e) { next(e); }
});
router.get('/holds', (req, res, next) => {
  try { res.json(Route.listHolds(req.query)); } catch (e) { next(e); }
});
router.put('/holds/:id', (req, res, next) => {
  try { res.json(Route.updateHold(req.params.id, req.body)); } catch (e) { next(e); }
});

// Competitions
router.post('/competitions', (req, res, next) => {
  try { res.json(Route.createCompetition(req.body)); } catch (e) { next(e); }
});
router.get('/competitions', (req, res, next) => {
  try { res.json(Route.listCompetitions(req.query.status)); } catch (e) { next(e); }
});
router.get('/competitions/:id', (req, res, next) => {
  try { res.json(Route.getCompetitionById(req.params.id) || null); } catch (e) { next(e); }
});
router.post('/competitions/:id/register', (req, res, next) => {
  try { res.json(Route.registerForCompetition(req.params.id, req.body.memberId, req.body.category)); } catch (e) { next(e); }
});
router.post('/competitions/scores', (req, res, next) => {
  try { res.json(Route.submitScore(req.body)); } catch (e) { next(e); }
});
router.get('/competitions/:id/leaderboard', (req, res, next) => {
  try { res.json(Route.getLeaderboard(req.params.id)); } catch (e) { next(e); }
});
router.post('/competitions/:id/start', (req, res, next) => {
  try { res.json(Route.startCompetition(req.params.id)); } catch (e) { next(e); }
});
router.post('/competitions/:id/complete', (req, res, next) => {
  try { res.json(Route.completeCompetition(req.params.id)); } catch (e) { next(e); }
});

module.exports = router;
