const router = require('express').Router();
const Event = require('../main/models/event');

// Templates
router.post('/templates', (req, res, next) => {
  try { res.json(Event.createTemplate(req.body)); } catch (e) { next(e); }
});
router.get('/templates', (req, res, next) => {
  try { res.json(Event.listTemplates(req.query.activeOnly !== 'false')); } catch (e) { next(e); }
});
router.put('/templates/:id', (req, res, next) => {
  try { res.json(Event.updateTemplate(req.params.id, req.body)); } catch (e) { next(e); }
});

// Events
router.post('/', (req, res, next) => {
  try { res.json(Event.createEvent(req.body)); } catch (e) { next(e); }
});
router.post('/from-template', (req, res, next) => {
  try { res.json(Event.createFromTemplate(req.body.templateId, req.body.startsAt)); } catch (e) { next(e); }
});
router.get('/list', (req, res, next) => {
  try { res.json(Event.listEvents(req.query)); } catch (e) { next(e); }
});
router.get('/upcoming', (req, res, next) => {
  try { res.json(Event.listUpcoming(parseInt(req.query.days) || 7)); } catch (e) { next(e); }
});
router.get('/:id', (req, res, next) => {
  try { res.json(Event.getEventById(req.params.id) || null); } catch (e) { next(e); }
});
router.put('/:id', (req, res, next) => {
  try { res.json(Event.updateEvent(req.params.id, req.body)); } catch (e) { next(e); }
});
router.post('/:id/cancel', (req, res, next) => {
  try { res.json(Event.cancelEvent(req.params.id, req.body.reason)); } catch (e) { next(e); }
});
router.post('/:id/complete', (req, res, next) => {
  try { res.json(Event.completeEvent(req.params.id)); } catch (e) { next(e); }
});
router.post('/auto-cancel', (req, res, next) => {
  try { res.json({ cancelled: Event.autoCancel() }); } catch (e) { next(e); }
});

// Enrolments — RESTful per-event routes
router.get('/:id/enrollments', (req, res, next) => {
  try {
    const event = Event.getEventById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event.enrolments || []);
  } catch (e) { next(e); }
});

router.post('/:id/enroll', (req, res, next) => {
  try {
    const { member_id } = req.body;
    const result = Event.enrol(req.params.id, member_id);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id/enroll/:memberId', (req, res, next) => {
  try {
    const db = require('../main/database/db').getDb();
    const enrolment = db.prepare(
      "SELECT id FROM event_enrolments WHERE event_id = ? AND member_id = ? AND status IN ('enrolled','waitlisted')"
    ).get(req.params.id, req.params.memberId);
    if (!enrolment) return res.status(404).json({ error: 'Enrolment not found' });
    Event.cancelEnrolment(enrolment.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// Enrolments (legacy)
router.post('/enrol', (req, res, next) => {
  try {
    const { eventId, memberId, price, transactionId } = req.body;
    res.json(Event.enrol(eventId, memberId, price, transactionId));
  } catch (e) { next(e); }
});
router.post('/enrolments/:id/cancel', (req, res, next) => {
  try { Event.cancelEnrolment(req.params.id); res.json({ success: true }); } catch (e) { next(e); }
});
router.post('/enrolments/:id/attended', (req, res, next) => {
  try { Event.markAttended(req.params.id); res.json({ success: true }); } catch (e) { next(e); }
});
router.post('/enrolments/:id/no-show', (req, res, next) => {
  try { Event.markNoShow(req.params.id); res.json({ success: true }); } catch (e) { next(e); }
});

// Courses
router.post('/courses', (req, res, next) => {
  try { res.json(Event.createCourse(req.body)); } catch (e) { next(e); }
});
router.get('/courses', (req, res, next) => {
  try { res.json(Event.listCourses(req.query.activeOnly !== 'false')); } catch (e) { next(e); }
});
router.get('/courses/:id', (req, res, next) => {
  try { res.json(Event.getCourseById(req.params.id) || null); } catch (e) { next(e); }
});
router.post('/courses/:id/enrol', (req, res, next) => {
  try {
    const { memberId, price, transactionId } = req.body;
    res.json(Event.enrolInCourse(req.params.id, memberId, price, transactionId));
  } catch (e) { next(e); }
});
router.get('/courses/:id/late-join-price', (req, res, next) => {
  try { res.json({ price: Event.lateJoinPrice(req.params.id) }); } catch (e) { next(e); }
});

// Slots
router.post('/slot-templates', (req, res, next) => {
  try { res.json(Event.createSlotTemplate(req.body)); } catch (e) { next(e); }
});
router.get('/slot-templates', (req, res, next) => {
  try { res.json(Event.listSlotTemplates(req.query.activeOnly !== 'false')); } catch (e) { next(e); }
});
router.post('/slots', (req, res, next) => {
  try { res.json(Event.createSlot(req.body)); } catch (e) { next(e); }
});
router.post('/slots/generate', (req, res, next) => {
  try { res.json(Event.generateSlots(req.body.templateId, req.body.start, req.body.end)); } catch (e) { next(e); }
});
router.get('/slots/list', (req, res, next) => {
  try { res.json(Event.listSlots(req.query)); } catch (e) { next(e); }
});
router.post('/slots/:id/book', (req, res, next) => {
  try {
    const { memberId, price, transactionId } = req.body;
    res.json(Event.bookSlot(req.params.id, memberId, price, transactionId));
  } catch (e) { next(e); }
});
router.post('/slot-bookings/:id/cancel', (req, res, next) => {
  try { Event.cancelSlotBooking(req.params.id); res.json({ success: true }); } catch (e) { next(e); }
});

module.exports = router;
