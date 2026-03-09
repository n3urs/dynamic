/**
 * Gym context — AsyncLocalStorage singleton that threads the current
 * gym_id through the entire async call chain for each request.
 *
 * Usage (in middleware):
 *   gymContext.run({ gymId: 'mygym' }, next);
 *
 * Usage (anywhere in models/routes):
 *   const { gymId } = gymContext.getStore() ?? {};
 *
 * db.js reads this automatically — no other code needs to change.
 */

const { AsyncLocalStorage } = require('async_hooks');

const gymContext = new AsyncLocalStorage();

module.exports = gymContext;
