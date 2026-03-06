/**
 * Route management model — climbs, logbook, gym map, competitions, holds, feedback
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');

const Route = {
  // ---- Walls ----

  listWalls() {
    return getDb().prepare('SELECT * FROM walls ORDER BY sort_order').all();
  },

  getWall(id) {
    const db = getDb();
    const wall = db.prepare('SELECT * FROM walls WHERE id = ?').get(id);
    if (wall) {
      wall.active_climbs = db.prepare("SELECT * FROM climbs WHERE wall_id = ? AND status = 'active' ORDER BY grade").all(id);
      wall.climb_count = wall.active_climbs.length;
    }
    return wall;
  },

  // ---- Climbs ----

  createClimb(data) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO climbs (id, wall_id, grade, colour, setter, style_tags, date_set, date_strip_planned, status, notes, nfc_tag_id, map_x, map_y)
      VALUES (@id, @wall_id, @grade, @colour, @setter, @style_tags, @date_set, @date_strip_planned, 'active', @notes, @nfc_tag_id, @map_x, @map_y)
    `).run({
      id, wall_id: data.wall_id, grade: data.grade, colour: data.colour,
      setter: data.setter || null, style_tags: data.style_tags || null,
      date_set: data.date_set || new Date().toISOString().split('T')[0],
      date_strip_planned: data.date_strip_planned || null,
      notes: data.notes || null, nfc_tag_id: data.nfc_tag_id || null,
      map_x: data.map_x != null ? data.map_x : null,
      map_y: data.map_y != null ? data.map_y : null,
    });
    return this.getClimbById(id);
  },

  getClimbById(id) {
    const db = getDb();
    const climb = db.prepare(`
      SELECT c.*, w.name as wall_name, w.colour as wall_colour
      FROM climbs c JOIN walls w ON c.wall_id = w.id WHERE c.id = ?
    `).get(id);

    if (climb) {
      climb.log_count = db.prepare('SELECT count(*) as c FROM climb_logs WHERE climb_id = ?').get(id).c;
      climb.send_count = db.prepare('SELECT count(*) as c FROM climb_logs WHERE climb_id = ? AND sent = 1').get(id).c;
      climb.avg_attempts = db.prepare('SELECT avg(attempts) as a FROM climb_logs WHERE climb_id = ? AND sent = 1').get(id).a || 0;

      const feedback = db.prepare('SELECT avg(rating) as avg_rating, count(*) as count FROM climb_feedback WHERE climb_id = ?').get(id);
      climb.avg_rating = feedback.avg_rating || 0;
      climb.feedback_count = feedback.count;
    }
    return climb;
  },

  listClimbs({ wallId, status = 'active', grade, colour } = {}) {
    const db = getDb();
    let sql = 'SELECT c.*, w.name as wall_name FROM climbs c JOIN walls w ON c.wall_id = w.id WHERE 1=1';
    const params = {};

    if (wallId) { sql += ' AND c.wall_id = @wallId'; params.wallId = wallId; }
    if (status) { sql += ' AND c.status = @status'; params.status = status; }
    if (grade) { sql += ' AND c.grade = @grade'; params.grade = grade; }
    if (colour) { sql += ' AND c.colour = @colour'; params.colour = colour; }

    sql += ' ORDER BY w.sort_order, c.grade, c.colour';
    return db.prepare(sql).all(params);
  },

  updateClimb(id, data) {
    const db = getDb();
    const fields = ['wall_id', 'grade', 'colour', 'setter', 'style_tags', 'date_set',
      'date_strip_planned', 'date_stripped', 'status', 'notes', 'snippet_video_path', 'nfc_tag_id', 'map_x', 'map_y'];
    const updates = []; const params = { id };
    for (const f of fields) { if (data[f] !== undefined) { updates.push(`${f} = @${f}`); params[f] = data[f]; } }
    if (updates.length) {
      updates.push("updated_at = datetime('now')");
      db.prepare(`UPDATE climbs SET ${updates.join(', ')} WHERE id = @id`).run(params);
    }
    return this.getClimbById(id);
  },

  stripClimb(id) {
    return this.updateClimb(id, {
      status: 'stripped',
      date_stripped: new Date().toISOString().split('T')[0],
    });
  },

  archiveClimb(id) {
    return this.updateClimb(id, { status: 'archived' });
  },

  // ---- Climb Logbook ----

  logAttempt(data) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO climb_logs (id, climb_id, member_id, attempts, sent, logged_via, notes)
      VALUES (@id, @climb_id, @member_id, @attempts, @sent, @logged_via, @notes)
    `).run({
      id, climb_id: data.climb_id, member_id: data.member_id,
      attempts: data.attempts || 1, sent: data.sent ? 1 : 0,
      logged_via: data.logged_via || 'desk', notes: data.notes || null,
    });
    return db.prepare('SELECT * FROM climb_logs WHERE id = ?').get(id);
  },

  getMemberLogbook(memberId, { limit = 50, offset = 0 } = {}) {
    return getDb().prepare(`
      SELECT cl.*, c.grade, c.colour, c.wall_id, w.name as wall_name
      FROM climb_logs cl
      JOIN climbs c ON cl.climb_id = c.id
      JOIN walls w ON c.wall_id = w.id
      WHERE cl.member_id = ?
      ORDER BY cl.logged_at DESC
      LIMIT ? OFFSET ?
    `).all(memberId, limit, offset);
  },

  getMemberStats(memberId) {
    const db = getDb();
    const total = db.prepare('SELECT count(*) as c FROM climb_logs WHERE member_id = ?').get(memberId).c;
    const sends = db.prepare('SELECT count(*) as c FROM climb_logs WHERE member_id = ? AND sent = 1').get(memberId).c;
    const hardest = db.prepare(`
      SELECT c.grade FROM climb_logs cl JOIN climbs c ON cl.climb_id = c.id
      WHERE cl.member_id = ? AND cl.sent = 1
      ORDER BY c.grade DESC LIMIT 1
    `).get(memberId);

    const byGrade = db.prepare(`
      SELECT c.grade, count(*) as sends FROM climb_logs cl JOIN climbs c ON cl.climb_id = c.id
      WHERE cl.member_id = ? AND cl.sent = 1
      GROUP BY c.grade ORDER BY c.grade
    `).all(memberId);

    const sessions = db.prepare(`
      SELECT date(logged_at) as session_date, count(*) as logs
      FROM climb_logs WHERE member_id = ?
      GROUP BY date(logged_at) ORDER BY session_date DESC LIMIT 30
    `).all(memberId);

    return { total_attempts: total, total_sends: sends, hardest_send: hardest ? hardest.grade : null, by_grade: byGrade, recent_sessions: sessions };
  },

  // ---- Feedback ----

  addFeedback(data) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO climb_feedback (id, climb_id, member_id, rating, grade_opinion, comment)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.climb_id, data.member_id || null, data.rating || null, data.grade_opinion || null, data.comment || null);
    return db.prepare('SELECT * FROM climb_feedback WHERE id = ?').get(id);
  },

  getClimbFeedback(climbId) {
    return getDb().prepare(`
      SELECT cf.*, m.first_name, m.last_name
      FROM climb_feedback cf
      LEFT JOIN members m ON cf.member_id = m.id
      WHERE cf.climb_id = ?
      ORDER BY cf.created_at DESC
    `).all(climbId);
  },

  // ---- Grade & Style Distribution ----

  getGradeDistribution(wallId = null) {
    const db = getDb();
    let sql = "SELECT grade, count(*) as count FROM climbs WHERE status = 'active'";
    const params = {};
    if (wallId) { sql += ' AND wall_id = @wallId'; params.wallId = wallId; }
    sql += ' GROUP BY grade ORDER BY grade';
    return db.prepare(sql).all(params);
  },

  getStyleDistribution(wallId = null) {
    const db = getDb();
    const climbs = wallId
      ? db.prepare("SELECT style_tags FROM climbs WHERE status = 'active' AND wall_id = ?").all(wallId)
      : db.prepare("SELECT style_tags FROM climbs WHERE status = 'active'").all();

    const styles = {};
    for (const climb of climbs) {
      if (!climb.style_tags) continue;
      for (const tag of climb.style_tags.split(',')) {
        const t = tag.trim().toLowerCase();
        if (t) styles[t] = (styles[t] || 0) + 1;
      }
    }

    return Object.entries(styles).map(([style, count]) => ({ style, count })).sort((a, b) => b.count - a.count);
  },

  getColourDistribution(wallId = null) {
    const db = getDb();
    let sql = "SELECT colour, count(*) as count FROM climbs WHERE status = 'active'";
    const params = {};
    if (wallId) { sql += ' AND wall_id = @wallId'; params.wallId = wallId; }
    sql += ' GROUP BY colour ORDER BY count DESC';
    return db.prepare(sql).all(params);
  },

  // ---- Hold Inventory ----

  createHold(data) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO hold_inventory (id, brand, type, colour, quantity, condition, storage_location, in_use_count, notes)
      VALUES (@id, @brand, @type, @colour, @quantity, @condition, @storage_location, @in_use_count, @notes)
    `).run({
      id, brand: data.brand || null, type: data.type || null,
      colour: data.colour || null, quantity: data.quantity || 0,
      condition: data.condition || 'good', storage_location: data.storage_location || null,
      in_use_count: data.in_use_count || 0, notes: data.notes || null,
    });
    return db.prepare('SELECT * FROM hold_inventory WHERE id = ?').get(id);
  },

  listHolds({ condition, type, brand } = {}) {
    const db = getDb();
    let sql = 'SELECT * FROM hold_inventory WHERE 1=1';
    const params = {};
    if (condition) { sql += ' AND condition = @condition'; params.condition = condition; }
    if (type) { sql += ' AND type = @type'; params.type = type; }
    if (brand) { sql += ' AND brand LIKE @brand'; params.brand = `%${brand}%`; }
    sql += ' ORDER BY brand, type, colour';
    return db.prepare(sql).all(params);
  },

  updateHold(id, data) {
    const db = getDb();
    const fields = ['brand', 'type', 'colour', 'quantity', 'condition', 'storage_location', 'in_use_count', 'notes'];
    const updates = []; const params = { id };
    for (const f of fields) { if (data[f] !== undefined) { updates.push(`${f} = @${f}`); params[f] = data[f]; } }
    if (updates.length) {
      updates.push("updated_at = datetime('now')");
      db.prepare(`UPDATE hold_inventory SET ${updates.join(', ')} WHERE id = @id`).run(params);
    }
    return db.prepare('SELECT * FROM hold_inventory WHERE id = ?').get(id);
  },

  // ---- Competitions ----

  createCompetition(data) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO competitions (id, event_id, name, format, scoring_rules_json, status)
      VALUES (?, ?, ?, ?, ?, 'upcoming')
    `).run(id, data.event_id || null, data.name, data.format, data.scoring_rules ? JSON.stringify(data.scoring_rules) : '{}');
    return this.getCompetitionById(id);
  },

  getCompetitionById(id) {
    const db = getDb();
    const comp = db.prepare('SELECT * FROM competitions WHERE id = ?').get(id);
    if (comp) {
      comp.scoring_rules = JSON.parse(comp.scoring_rules_json || '{}');
      comp.entries = db.prepare(`
        SELECT ce.*, m.first_name, m.last_name
        FROM competition_entries ce
        JOIN members m ON ce.member_id = m.id
        WHERE ce.competition_id = ?
        ORDER BY ce.total_score DESC
      `).all(id);
    }
    return comp;
  },

  listCompetitions(status = null) {
    const db = getDb();
    const sql = status
      ? 'SELECT * FROM competitions WHERE status = ? ORDER BY created_at DESC'
      : 'SELECT * FROM competitions ORDER BY created_at DESC';
    return status ? db.prepare(sql).all(status) : db.prepare(sql).all();
  },

  registerForCompetition(compId, memberId, category = null) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO competition_entries (id, competition_id, member_id, category)
      VALUES (?, ?, ?, ?)
    `).run(id, compId, memberId, category);
    return db.prepare('SELECT * FROM competition_entries WHERE id = ?').get(id);
  },

  submitScore(data) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO competition_scores (id, competition_id, entry_id, climb_id, score, topped, zones, attempts_to_top, attempts_to_zone)
      VALUES (@id, @competition_id, @entry_id, @climb_id, @score, @topped, @zones, @attempts_to_top, @attempts_to_zone)
    `).run({
      id, competition_id: data.competition_id, entry_id: data.entry_id,
      climb_id: data.climb_id || null, score: data.score || 0,
      topped: data.topped || 0, zones: data.zones || 0,
      attempts_to_top: data.attempts_to_top || null, attempts_to_zone: data.attempts_to_zone || null,
    });

    // Update entry total
    const totalScore = db.prepare('SELECT COALESCE(sum(score), 0) as total FROM competition_scores WHERE entry_id = ?').get(data.entry_id).total;
    db.prepare('UPDATE competition_entries SET total_score = ? WHERE id = ?').run(totalScore, data.entry_id);

    return db.prepare('SELECT * FROM competition_scores WHERE id = ?').get(id);
  },

  getLeaderboard(compId) {
    return getDb().prepare(`
      SELECT ce.*, m.first_name, m.last_name,
        (SELECT count(*) FROM competition_scores cs WHERE cs.entry_id = ce.id AND cs.topped = 1) as tops,
        (SELECT count(*) FROM competition_scores cs WHERE cs.entry_id = ce.id AND cs.zones > 0) as total_zones
      FROM competition_entries ce
      JOIN members m ON ce.member_id = m.id
      WHERE ce.competition_id = ?
      ORDER BY ce.total_score DESC
    `).all(compId);
  },

  startCompetition(id) {
    getDb().prepare("UPDATE competitions SET status = 'active' WHERE id = ?").run(id);
    return this.getCompetitionById(id);
  },

  completeCompetition(id) {
    const db = getDb();
    // Calculate rankings
    const entries = db.prepare('SELECT id FROM competition_entries WHERE competition_id = ? ORDER BY total_score DESC').all(id);
    entries.forEach((entry, i) => {
      db.prepare('UPDATE competition_entries SET rank = ? WHERE id = ?').run(i + 1, entry.id);
    });
    db.prepare("UPDATE competitions SET status = 'completed' WHERE id = ?").run(id);
    return this.getCompetitionById(id);
  },

  // ---- Map position batch update ----

  updateClimbMapPositions(positions) {
    const db = getDb();
    const stmt = db.prepare('UPDATE climbs SET map_x = @map_x, map_y = @map_y WHERE id = @id');
    const updateMany = db.transaction((items) => {
      for (const item of items) {
        stmt.run({ id: item.id, map_x: item.map_x, map_y: item.map_y });
      }
    });
    updateMany(positions);
    return { updated: positions.length };
  },

  // ---- Routes due for stripping ----

  getDueForStripping(days = 7) {
    return getDb().prepare(`
      SELECT c.*, w.name as wall_name
      FROM climbs c JOIN walls w ON c.wall_id = w.id
      WHERE c.status = 'active' AND c.date_strip_planned IS NOT NULL
        AND c.date_strip_planned <= date('now', '+' || ? || ' days')
      ORDER BY c.date_strip_planned ASC
    `).all(days);
  },
};

module.exports = Route;
