/**
 * Transaction model — sales, payments, receipts
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');

const Transaction = {
  /**
   * Create a full transaction with line items
   * @param {Object} data - { member_id?, staff_id?, payment_method, items: [{ product_id?, description, quantity, unit_price }], notes? }
   */
  create(data) {
    const db = getDb();
    const txnId = uuidv4();

    // Calculate total
    const items = data.items || [];
    const totalAmount = items.reduce((sum, item) => sum + (item.unit_price * (item.quantity || 1)), 0);

    // Create transaction
    db.prepare(`
      INSERT INTO transactions (id, member_id, staff_id, total_amount, payment_method, payment_status, payment_reference, notes)
      VALUES (@id, @member_id, @staff_id, @total_amount, @payment_method, @payment_status, @payment_reference, @notes)
    `).run({
      id: txnId,
      member_id: data.member_id || null,
      staff_id: data.staff_id || null,
      total_amount: totalAmount,
      payment_method: data.payment_method || 'dojo_card',
      payment_status: data.payment_status || 'completed',
      payment_reference: data.payment_reference || null,
      notes: data.notes || null,
    });

    // Create line items
    const insertItem = db.prepare(`
      INSERT INTO transaction_items (id, transaction_id, product_id, description, quantity, unit_price, total_price)
      VALUES (@id, @transaction_id, @product_id, @description, @quantity, @unit_price, @total_price)
    `);

    for (const item of items) {
      const qty = item.quantity || 1;
      insertItem.run({
        id: uuidv4(),
        transaction_id: txnId,
        product_id: item.product_id || null,
        description: item.description,
        quantity: qty,
        unit_price: item.unit_price,
        total_price: item.unit_price * qty,
      });

      // Deduct stock if product tracked
      if (item.product_id) {
        db.prepare(`
          UPDATE products SET stock_count = stock_count - ?, updated_at = datetime('now')
          WHERE id = ? AND stock_count IS NOT NULL
        `).run(qty, item.product_id);
      }

      // Auto-issue pass if smart product
      if (item.product_id && data.member_id) {
        const product = db.prepare('SELECT linked_pass_type_id FROM products WHERE id = ?').get(item.product_id);
        if (product && product.linked_pass_type_id) {
          this._autoIssuePass(data.member_id, product.linked_pass_type_id, item.unit_price * qty);
        }
      }
    }

    return this.getById(txnId);
  },

  /**
   * Auto-issue a pass from a smart product purchase
   */
  _autoIssuePass(memberId, passTypeId, pricePaid) {
    const db = getDb();
    const passType = db.prepare('SELECT * FROM pass_types WHERE id = ?').get(passTypeId);
    if (!passType) return;

    const passId = uuidv4();
    const expiresAt = passType.duration_days
      ? `datetime('now', '+${passType.duration_days} days')`
      : null;

    db.prepare(`
      INSERT INTO member_passes (id, member_id, pass_type_id, status, is_peak, price_paid, visits_remaining, expires_at)
      VALUES (?, ?, ?, 'active', 1, ?, ?, ${expiresAt ? expiresAt : 'NULL'})
    `).run(passId, memberId, passTypeId, pricePaid, passType.visits_included);
  },

  getById(id) {
    const db = getDb();
    const txn = db.prepare(`
      SELECT t.*, s.first_name || ' ' || s.last_name as staff_name,
        m.first_name || ' ' || m.last_name as member_name
      FROM transactions t
      LEFT JOIN staff s ON t.staff_id = s.id
      LEFT JOIN members m ON t.member_id = m.id
      WHERE t.id = ?
    `).get(id);

    if (!txn) return null;

    txn.items = db.prepare(`
      SELECT ti.*, p.name as product_name, p.category_id
      FROM transaction_items ti
      LEFT JOIN products p ON ti.product_id = p.id
      WHERE ti.transaction_id = ?
    `).all(id);

    return txn;
  },

  /**
   * List transactions with filters
   */
  list({ page = 1, perPage = 50, dateFrom, dateTo, memberId, paymentMethod, status } = {}) {
    const db = getDb();
    let sql = `
      SELECT t.*, m.first_name || ' ' || m.last_name as member_name,
        s.first_name || ' ' || s.last_name as staff_name
      FROM transactions t
      LEFT JOIN members m ON t.member_id = m.id
      LEFT JOIN staff s ON t.staff_id = s.id
      WHERE 1=1
    `;
    const params = {};

    if (dateFrom) { sql += " AND t.created_at >= @dateFrom"; params.dateFrom = dateFrom; }
    if (dateTo) { sql += " AND t.created_at <= @dateTo"; params.dateTo = dateTo; }
    if (memberId) { sql += " AND t.member_id = @memberId"; params.memberId = memberId; }
    if (paymentMethod) { sql += " AND t.payment_method = @paymentMethod"; params.paymentMethod = paymentMethod; }
    if (status) { sql += " AND t.payment_status = @status"; params.status = status; }

    sql += " ORDER BY t.created_at DESC LIMIT @limit OFFSET @offset";
    params.limit = perPage;
    params.offset = (page - 1) * perPage;

    const transactions = db.prepare(sql).all(params);

    // Count total
    let countSql = 'SELECT count(*) as c FROM transactions t WHERE 1=1';
    const countParams = {};
    if (dateFrom) { countSql += " AND t.created_at >= @dateFrom"; countParams.dateFrom = dateFrom; }
    if (dateTo) { countSql += " AND t.created_at <= @dateTo"; countParams.dateTo = dateTo; }
    if (memberId) { countSql += " AND t.member_id = @memberId"; countParams.memberId = memberId; }
    if (paymentMethod) { countSql += " AND t.payment_method = @paymentMethod"; countParams.paymentMethod = paymentMethod; }
    if (status) { countSql += " AND t.payment_status = @status"; countParams.status = status; }

    const total = db.prepare(countSql).get(countParams).c;

    return { transactions, total, page, perPage, totalPages: Math.ceil(total / perPage) };
  },

  /**
   * Refund a transaction (full or partial)
   */
  refund(transactionId, amount = null) {
    const db = getDb();
    const original = this.getById(transactionId);
    if (!original) throw new Error('Transaction not found');

    const refundAmount = amount || original.total_amount;

    // Create refund transaction
    const refundId = uuidv4();
    db.prepare(`
      INSERT INTO transactions (id, member_id, staff_id, total_amount, payment_method, payment_status, payment_reference, notes)
      VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)
    `).run(
      refundId,
      original.member_id,
      original.staff_id,
      -refundAmount,
      original.payment_method,
      `refund_of_${transactionId}`,
      `Refund of transaction ${transactionId}`
    );

    // Mark original as refunded
    db.prepare("UPDATE transactions SET payment_status = 'refunded' WHERE id = ?").run(transactionId);

    return this.getById(refundId);
  },

  /**
   * Daily summary for reconciliation
   */
  dailySummary(date = null) {
    const db = getDb();
    const targetDate = date || new Date().toISOString().split('T')[0];

    const byMethod = db.prepare(`
      SELECT payment_method,
        count(*) as transaction_count,
        COALESCE(sum(CASE WHEN total_amount > 0 THEN total_amount ELSE 0 END), 0) as total_sales,
        COALESCE(sum(CASE WHEN total_amount < 0 THEN total_amount ELSE 0 END), 0) as total_refunds,
        COALESCE(sum(total_amount), 0) as net_total
      FROM transactions
      WHERE date(created_at) = ? AND payment_status IN ('completed', 'refunded')
      GROUP BY payment_method
    `).all(targetDate);

    const byCategory = db.prepare(`
      SELECT pc.name as category, COALESCE(sum(ti.total_price), 0) as total
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      LEFT JOIN products p ON ti.product_id = p.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE date(t.created_at) = ? AND t.payment_status IN ('completed', 'refunded') AND t.total_amount > 0
      GROUP BY pc.name
      ORDER BY total DESC
    `).all(targetDate);

    const totals = db.prepare(`
      SELECT
        count(*) as transaction_count,
        COALESCE(sum(CASE WHEN total_amount > 0 THEN total_amount ELSE 0 END), 0) as total_sales,
        COALESCE(sum(CASE WHEN total_amount < 0 THEN abs(total_amount) ELSE 0 END), 0) as total_refunds,
        COALESCE(sum(total_amount), 0) as net_total
      FROM transactions
      WHERE date(created_at) = ? AND payment_status IN ('completed', 'refunded')
    `).get(targetDate);

    const topProducts = db.prepare(`
      SELECT ti.description, sum(ti.quantity) as qty, sum(ti.total_price) as revenue
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      WHERE date(t.created_at) = ? AND t.payment_status IN ('completed', 'refunded') AND t.total_amount > 0
      GROUP BY ti.description
      ORDER BY revenue DESC
      LIMIT 10
    `).all(targetDate);

    return { date: targetDate, byMethod, byCategory, totals, topProducts };
  },

  /**
   * Mark receipt as sent
   */
  markReceiptSent(id) {
    getDb().prepare("UPDATE transactions SET receipt_sent = 1 WHERE id = ?").run(id);
  },

  /**
   * Send email receipt
   */
  async sendReceipt(transactionId) {
    const db = getDb();
    const txn = this.getById(transactionId);
    if (!txn || !txn.member_id) throw new Error('Transaction not found or no member');

    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(txn.member_id);
    if (!member || !member.email) throw new Error('Member has no email');

    const nodemailer = require('nodemailer');
    const getSetting = (key) => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return row ? row.value : '';
    };

    const smtpUser = getSetting('email_smtp_user');
    const smtpPass = getSetting('email_smtp_pass');
    if (!smtpUser || !smtpPass) throw new Error('Email not configured');

    const transporter = nodemailer.createTransport({
      host: getSetting('email_smtp_host') || 'smtp.gmail.com',
      port: parseInt(getSetting('email_smtp_port') || '587'),
      secure: false,
      auth: { user: smtpUser, pass: smtpPass }
    });

    const itemsHtml = txn.items.map(i =>
      `<tr><td style="padding:4px 8px">${i.description}</td><td style="padding:4px 8px;text-align:center">${i.quantity}</td><td style="padding:4px 8px;text-align:right">£${i.total_price.toFixed(2)}</td></tr>`
    ).join('');

    const gymName = getSetting('gym_name') || 'the gym';
    await transporter.sendMail({
      from: getSetting('email_from') || smtpUser,
      to: member.email,
      subject: `${gymName} Receipt — £${txn.total_amount.toFixed(2)}`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
          <h2 style="color:#1E3A5F">${gymName}</h2>
          <p>Hi ${member.first_name},</p>
          <p>Here's your receipt:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead><tr style="border-bottom:2px solid #E2E8F0">
              <th style="text-align:left;padding:4px 8px">Item</th>
              <th style="text-align:center;padding:4px 8px">Qty</th>
              <th style="text-align:right;padding:4px 8px">Price</th>
            </tr></thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot><tr style="border-top:2px solid #1E3A5F;font-weight:bold">
              <td colspan="2" style="padding:8px">Total</td>
              <td style="text-align:right;padding:8px">£${txn.total_amount.toFixed(2)}</td>
            </tr></tfoot>
          </table>
          <p style="color:#64748B;font-size:13px">Payment: ${txn.payment_method === 'dojo_card' ? 'Card' : txn.payment_method}</p>
          <p style="color:#64748B;font-size:13px">Date: ${new Date(txn.created_at).toLocaleString('en-GB')}</p>
          <p style="color:#64748B;font-size:13px">Ref: ${txn.id.split('-')[0]}</p>
          <p style="margin-top:24px">See you on the wall!<br/>${gymName}</p>
        </div>
      `,
    });

    this.markReceiptSent(transactionId);
    return true;
  },
};

module.exports = Transaction;
