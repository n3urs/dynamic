/**
 * Seed default gym products
 */

const { getDb } = require('../database/db');

function seedProducts() {
  const db = getDb();
  
  // Check if products already seeded
  const existing = db.prepare('SELECT count(*) as c FROM products').get().c;
  if (existing > 0) return 0;

  const insertProduct = db.prepare(`
    INSERT INTO products (id, category_id, name, description, price, product_code, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);

  const { v4: uuidv4 } = require('uuid');
  let codeCounter = { C: 1, EVT: 1, M: 1, P: 1 };

  function code(prefix) {
    const n = codeCounter[prefix]++;
    if (prefix === 'EVT') return `EVT-${String(n).padStart(4, '0')}`;
    return `${prefix}-${String(n).padStart(5, '0')}`;
  }

  function add(catId, name, price, prefix = 'C', desc = null, sort = 0) {
    insertProduct.run(uuidv4(), catId, name, desc, price, code(prefix), sort);
  }

  // Cold Drinks
  add('cat_cold_drinks', 'Kombucha', 1.80, 'C', null, 1);
  add('cat_cold_drinks', 'Whole Earth Can', 1.80, 'C', null, 2);
  add('cat_cold_drinks', 'Water', 1.50, 'C', null, 3);
  add('cat_cold_drinks', 'Juice', 2.00, 'C', null, 4);

  // Day Entry
  add('cat_day_entry', 'Adult Peak', 15.00, 'C', 'Adult peak entry', 1);
  add('cat_day_entry', 'Adult Off Peak', 12.50, 'C', 'Adult off-peak entry (Mon-Fri 10am-4pm)', 2);
  add('cat_day_entry', 'Concession/U18', 12.50, 'C', 'Student/Concession/Under 18', 3);
  add('cat_day_entry', 'U16', 12.00, 'C', 'Under 16 entry', 4);
  add('cat_day_entry', '8-10 Entry', 10.50, 'C', 'Ages 8-10 entry', 5);
  add('cat_day_entry', 'FalClimb', 10.50, 'C', 'Falmouth Climbing Club member', 6);
  add('cat_day_entry', 'Off Peak to Peak Upgrade', 2.50, 'C', null, 7);
  add('cat_day_entry', 'Registration Fee', 3.00, 'C', 'First-time registration fee', 8);
  add('cat_day_entry', 'Family Entry (2A+2C)', 42.00, 'C', '2 adults + 2 children', 9);

  // Events
  add('cat_events', 'Birthday Party (8 kids)', 120.00, 'EVT', '8 children, 1.5hrs', 1);
  add('cat_events', 'Birthday Party (12 kids)', 170.00, 'EVT', '12 children, 1.5hrs', 2);
  add('cat_events', 'Birthday Party (16 kids)', 220.00, 'EVT', '16 children, 1.5hrs', 3);
  add('cat_events', 'Birthday Party (20 kids)', 280.00, 'EVT', '20 children, 2hrs', 4);
  add('cat_events', 'Group Coaching 1hr', 50.00, 'EVT', 'Private group coaching (1 hour)', 5);
  add('cat_events', 'Group Coaching 1.5hr', 75.00, 'EVT', 'Private group coaching (1.5 hours)', 6);
  add('cat_events', 'Yoga Session', 10.00, 'EVT', null, 7);
  add('cat_events', 'Yoga Concession', 8.00, 'EVT', null, 8);
  add('cat_events', 'Group Event', 280.00, 'EVT', 'Corporate / large group', 9);
  add('cat_events', 'Intro to Climbing Session', 12.00, 'EVT', null, 10);

  // Food
  add('cat_food', 'Clif Bar', 2.50, 'C', null, 1);
  add('cat_food', 'Clif Bar Staff', 2.00, 'C', 'Staff price', 2);
  add('cat_food', 'Flapjack', 2.50, 'C', null, 3);
  add('cat_food', 'Fruit', 1.00, 'C', null, 4);
  add('cat_food', 'Brownie', 2.50, 'C', null, 5);
  add('cat_food', 'Cookie', 2.00, 'C', null, 6);
  add('cat_food', 'Protein Bar', 3.00, 'C', null, 7);

  // Hire
  add('cat_hire', 'Chalk Bag Hire', 2.50, 'C', null, 1);
  add('cat_hire', 'Hire Shoes', 3.50, 'C', null, 2);

  // Hot Drinks
  add('cat_hot_drinks', 'Americano', 3.50, 'C', null, 1);
  add('cat_hot_drinks', 'Cappuccino', 3.50, 'C', null, 2);
  add('cat_hot_drinks', 'Cortado', 3.00, 'C', null, 3);
  add('cat_hot_drinks', 'Flat White', 3.50, 'C', null, 4);
  add('cat_hot_drinks', 'Hot Choc', 3.50, 'C', null, 5);
  add('cat_hot_drinks', 'Latte', 3.50, 'C', null, 6);
  add('cat_hot_drinks', 'Tea', 2.50, 'C', null, 7);
  add('cat_hot_drinks', 'Mocha', 3.50, 'C', null, 8);
  add('cat_hot_drinks', 'Babyccino', 1.50, 'C', null, 9);
  add('cat_hot_drinks', 'Chai Latte', 3.50, 'C', null, 10);

  // Membership
  add('cat_membership', 'Adult Peak DD', 42.00, 'M', 'Adult peak monthly direct debit', 1);
  add('cat_membership', 'Adult Off Peak DD', 32.00, 'M', 'Adult off-peak monthly direct debit', 2);
  add('cat_membership', 'Concession Peak DD', 35.00, 'M', null, 3);
  add('cat_membership', 'Concession Off Peak DD', 30.00, 'M', null, 4);
  add('cat_membership', 'Family Peak DD', 85.00, 'M', null, 5);
  add('cat_membership', 'Family Off Peak DD', 65.00, 'M', null, 6);
  add('cat_membership', 'FalClimb DD', 32.00, 'M', 'Falmouth Climbing Club DD', 7);
  add('cat_membership', 'Family Youth Add On DD', 10.00, 'M', null, 8);

  // Prepaid
  add('cat_prepaid', 'Adult 5-Visit Card', 67.50, 'P', '5 visits, peak/off-peak', 1);
  add('cat_prepaid', 'Adult 10-Visit Card', 135.00, 'P', '10 visits, peak/off-peak', 2);
  add('cat_prepaid', 'Concession 5-Visit Card', 56.25, 'P', null, 3);
  add('cat_prepaid', 'Concession 10-Visit Card', 112.50, 'P', null, 4);
  add('cat_prepaid', 'U16 5-Visit Card', 54.00, 'P', null, 5);
  add('cat_prepaid', 'U16 10-Visit Card', 108.00, 'P', null, 6);
  add('cat_prepaid', '8-10 5-Visit Card', 47.25, 'P', null, 7);
  add('cat_prepaid', '8-10 10-Visit Card', 94.50, 'P', null, 8);
  add('cat_prepaid', 'FalClimb 5-Visit Card', 47.25, 'P', null, 9);
  add('cat_prepaid', 'FalClimb 10-Visit Card', 94.50, 'P', null, 10);
  add('cat_prepaid', 'Adult Monthly Pass', 45.00, 'P', '30-day pass', 11);
  add('cat_prepaid', 'Concession Monthly Pass', 38.00, 'P', null, 12);
  add('cat_prepaid', 'Family Monthly Pass', 90.00, 'P', null, 13);
  add('cat_prepaid', 'U16 Monthly Pass', 35.00, 'P', null, 14);
  add('cat_prepaid', 'Gift Voucher £10', 10.00, 'P', null, 15);
  add('cat_prepaid', 'Gift Voucher £25', 25.00, 'P', null, 16);
  add('cat_prepaid', 'Gift Voucher £50', 50.00, 'P', null, 17);

  // Products (climbing gear)
  add('cat_products', 'Chalk Ball', 3.75, 'C', null, 1);
  add('cat_products', 'Chalk Bag Small', 12.00, 'C', null, 2);
  add('cat_products', 'Chalk Bag Medium', 18.00, 'C', null, 3);
  add('cat_products', 'Chalk Bag Large', 25.00, 'C', null, 4);
  add('cat_products', 'Liquid Chalk', 10.00, 'C', null, 5);
  add('cat_products', 'Finger Tape 1.25cm', 3.75, 'C', null, 6);
  add('cat_products', 'Finger Tape 2.5cm', 4.00, 'C', null, 7);
  add('cat_products', 'Brush Small', 8.00, 'C', null, 8);
  add('cat_products', 'Brush Large', 12.00, 'C', null, 9);
  add('cat_products', 'Chalk Bucket', 15.00, 'C', null, 10);
  add('cat_products', 'Skin Balm', 8.50, 'C', null, 11);
  add('cat_products', 'Resistance Band Light', 6.00, 'C', null, 12);
  add('cat_products', 'Resistance Band Medium', 8.00, 'C', null, 13);
  add('cat_products', 'Resistance Band Heavy', 10.00, 'C', null, 14);
  add('cat_products', 'Grip Trainer', 12.00, 'C', null, 15);
  add('cat_products', 'Beanie', 15.00, 'C', 'Gym branded', 16);
  add('cat_products', 'T-Shirt', 20.00, 'C', 'Gym branded', 17);
  add('cat_products', 'Hoodie', 35.00, 'C', 'Gym branded', 18);
  add('cat_products', 'Sticker', 2.00, 'C', 'Gym sticker', 19);
  add('cat_products', 'Water Bottle', 12.00, 'C', 'Gym branded', 20);
  add('cat_products', 'Chalk Loose 100g', 5.00, 'C', null, 21);
  add('cat_products', 'Chalk Loose 250g', 10.00, 'C', null, 22);
  add('cat_products', 'Hangboard', 45.00, 'C', null, 23);
  add('cat_products', 'Climbing Guidebook', 15.00, 'C', 'Local crag guide', 24);
  add('cat_products', 'Carabiner', 8.00, 'C', null, 25);

  const count = db.prepare('SELECT count(*) as c FROM products').get().c;
  console.log(`Seeded ${count} products.`);
  return count;
}

module.exports = { seedProducts };
